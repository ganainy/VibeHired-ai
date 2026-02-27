// server/src/services/gmailService.ts
/**
 * GmailService — reads job-related emails using the Gmail API.
 *
 * Requires the user to have granted the following scopes (via Google OAuth):
 *   - https://www.googleapis.com/auth/gmail.readonly
 *   - https://www.googleapis.com/auth/gmail.labels
 *   - https://www.googleapis.com/auth/gmail.modify  (for adding the processed label)
 */
import { google, gmail_v1 } from 'googleapis';
import Profile from '../models/Profile';
import { decrypt, encrypt } from '../utils/encryption';
import { env } from '../config/env';

const PROCESSED_LABEL_NAME = 'job-tracker-processed';

export interface GmailMessage {
    id: string;
    subject: string;
    snippet: string;
    body: string;
    senderName: string;
    senderEmail: string;
    receivedAt: Date;
}

/** Build an OAuth2Client for a given userId, refreshing tokens automatically. */
async function getOAuth2Client(userId: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
        throw new Error('Google OAuth credentials are not configured on the server.');
    }

    const profile = await Profile.findOne({ userId });
    const googleIntegration = profile?.integrations?.google;

    if (!googleIntegration?.enabled || !googleIntegration?.accessToken) {
        throw new Error('Google account is not connected for this user.');
    }

    const accessToken = decrypt(googleIntegration.accessToken);
    const refreshToken = googleIntegration.refreshToken ? decrypt(googleIntegration.refreshToken) : null;

    if (!accessToken) {
        throw new Error('Failed to decrypt Google access token.');
    }

    const oauth2Client = new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken ?? undefined,
    });

    // Persist refreshed tokens
    oauth2Client.on('tokens', async (tokens) => {
        try {
            const updateData: Record<string, unknown> = {};
            if (tokens.access_token) updateData['integrations.google.accessToken'] = encrypt(tokens.access_token);
            if (tokens.refresh_token) updateData['integrations.google.refreshToken'] = encrypt(tokens.refresh_token);
            if (Object.keys(updateData).length > 0) {
                await Profile.updateOne({ userId }, { $set: updateData });
            }
        } catch (err) {
            console.error('[GmailService] Failed to persist refreshed tokens:', err);
        }
    });

    return oauth2Client;
}

/**
 * Returns true if the user has Google connected (token stored).
 * We don't make a live probe call here because any transient API error would
 * incorrectly report "no scope" to the user.  Scope/permission errors surface
 * naturally when fetchNewMessages is called and are logged server-side.
 */
export async function hasGmailScope(userId: string): Promise<boolean> {
    try {
        const profile = await Profile.findOne({ userId });
        const g = profile?.integrations?.google;
        return !!(g?.enabled && g?.accessToken);
    } catch {
        return false;
    }
}

/** Get or create the "job-tracker-processed" label, returning its ID. */
async function getOrCreateProcessedLabel(gmail: gmail_v1.Gmail): Promise<string> {
    const list = await gmail.users.labels.list({ userId: 'me' });
    const existing = list.data.labels?.find((l) => l.name === PROCESSED_LABEL_NAME);
    if (existing?.id) return existing.id;

    const created = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
            name: PROCESSED_LABEL_NAME,
            labelListVisibility: 'labelHide',
            messageListVisibility: 'hide',
        },
    });
    return created.data.id!;
}

/** Decode base64url-encoded Gmail message part. */
function decodeBase64(data: string): string {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/** Recursively extract plain-text body from a MIME message part. */
function extractBody(payload: gmail_v1.Schema$MessagePart): string {
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
        return decodeBase64(payload.body.data);
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            const text = extractBody(part);
            if (text) return text;
        }
    }
    return payload.body?.data ? decodeBase64(payload.body.data) : '';
}

/** Fetch new (unprocessed) messages since `since` date. Marks them processed. */
export async function fetchNewMessages(userId: string, since: Date): Promise<GmailMessage[]> {
    const auth = await getOAuth2Client(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    // Build query: unread, received after timestamp, NOT already labelled
    const sinceUnix = Math.floor(since.getTime() / 1000);
    const q = `is:unread after:${sinceUnix} -label:${PROCESSED_LABEL_NAME}`;

    const listResp = await gmail.users.messages.list({
        userId: 'me',
        q,
        maxResults: 50,
    });

    const messageIds = listResp.data.messages?.map((m) => m.id!) ?? [];
    if (messageIds.length === 0) return [];

    const processedLabelId = await getOrCreateProcessedLabel(gmail);
    const results: GmailMessage[] = [];

    for (const id of messageIds) {
        try {
            const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
            const payload = msg.data.payload;
            if (!payload) continue;

            const headers = payload.headers ?? [];
            const getHeader = (name: string) =>
                headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

            const subject = getHeader('Subject');
            const from = getHeader('From');
            const snippet = msg.data.snippet ?? '';

            // Parse "Name <email>" or plain "email"
            const fromMatch = from.match(/^(.*?)\s*<(.+)>$/) ?? null;
            const senderName = fromMatch ? fromMatch[1].trim().replace(/^"|"$/g, '') : from;
            const senderEmail = fromMatch ? fromMatch[2] : from;

            const body = extractBody(payload);
            const internalDate = msg.data.internalDate ? new Date(Number(msg.data.internalDate)) : new Date();

            results.push({ id, subject, snippet, body, senderName, senderEmail, receivedAt: internalDate });

            // Mark as processed (non-fatal if this fails)
            try {
                await gmail.users.messages.modify({
                    userId: 'me',
                    id,
                    requestBody: { addLabelIds: [processedLabelId] },
                });
            } catch (labelErr) {
                console.warn(`[GmailService] Could not label message ${id}:`, labelErr);
            }
        } catch (msgErr) {
            console.error(`[GmailService] Error fetching message ${id}:`, msgErr);
        }
    }

    return results;
}
