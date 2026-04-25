// server/src/services/gmailService.ts
/**
 * GmailService — reads job-related emails using the Gmail API.
 *
 * Requires the user to have granted the following scopes (via Google OAuth):
 *   - https://www.googleapis.com/auth/gmail.readonly
 *   - https://www.googleapis.com/auth/gmail.labels
 *   - https://www.googleapis.com/auth/gmail.modify  (for adding the processed label)
 * 
 * Note: If users have old tokens without gmail.modify scope, they will need to
 * re-authenticate. Run scripts/clear-gmail-tokens.ts to force re-authentication.
 */
import { google, gmail_v1 } from 'googleapis';
import Profile from '../models/Profile';
import { decrypt, encrypt } from '../utils/encryption';
import { env } from '../config/env';

const PROCESSED_LABEL_NAME = 'vibe-hired-processed';

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
 * Returns true if the user has Google connected AND the stored token includes
 * the gmail.modify scope (required for batchModify / label operations).
 */
export async function hasGmailScope(userId: string): Promise<boolean> {
    try {
        const profile = await Profile.findOne({ userId });
        const g = profile?.integrations?.google;
        if (!g?.enabled || !g?.accessToken) return false;
        const scope = g.scope ?? '';
        return scope.includes('https://www.googleapis.com/auth/gmail.modify');
    } catch {
        return false;
    }
}

/**
 * Returns true if the user has Google connected AND the stored token includes
 * the gmail.compose scope (required for sending emails).
 */
export async function hasGmailComposeScope(userId: string): Promise<boolean> {
    try {
        const profile = await Profile.findOne({ userId });
        const g = profile?.integrations?.google;
        if (!g?.enabled || !g?.accessToken) return false;
        const scope = g.scope ?? '';
        return scope.includes('https://www.googleapis.com/auth/gmail.compose');
    } catch {
        return false;
    }
}

/** Get or create the "vibe-hired-processed" label, returning its ID. */
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

/** Run up to `concurrency` async tasks in parallel, preserving result order. */
async function pAll<T>(
    tasks: (() => Promise<T>)[],
    concurrency: number
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length);
    let next = 0;
    async function worker() {
        while (next < tasks.length) {
            const i = next++;
            try {
                results[i] = { status: 'fulfilled', value: await tasks[i]() };
            } catch (err) {
                results[i] = { status: 'rejected', reason: err };
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
    return results;
}

const FETCH_CONCURRENCY = 10;

/** Fetch the most recent `limit` unprocessed messages. Marks them processed. */
export async function fetchNewMessages(userId: string, limit: number, includeReadEmails = false): Promise<GmailMessage[]> {
    const t0 = Date.now();
    console.log(`[GmailService] fetchNewMessages start — limit=${limit}, includeReadEmails=${includeReadEmails}`);

    try {
        const auth = await getOAuth2Client(userId);
        const gmail = google.gmail({ version: 'v1', auth });

        // Query the real last N emails — with optional unread filter
        const q = includeReadEmails ? `` : `is:unread`;

        const tList = Date.now();
        const listResp = await gmail.users.messages.list({
            userId: 'me',
            q,
            maxResults: limit,
        });
        console.log(`[GmailService] messages.list took ${Date.now() - tList}ms`);

        const allIds = listResp.data.messages?.map((m) => m.id!) ?? [];
        console.log(`[GmailService] ${allIds.length} message(s) in window`);
        if (allIds.length === 0) return [];

        const tLabel = Date.now();
        const processedLabelId = await getOrCreateProcessedLabel(gmail);
        console.log(`[GmailService] getOrCreateProcessedLabel took ${Date.now() - tLabel}ms`);

        // ── Step 1: fast metadata check — find which IDs are already labelled ─────
        // format=metadata with no extra headers returns just labelIds; much cheaper
        // than a full fetch and runs in parallel.
        const tMeta = Date.now();
        const metaTasks = allIds.map((id) => async () => {
            const res = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: [] });
            return { id, labelIds: res.data.labelIds ?? [] };
        });
        const metaSettled = await pAll(metaTasks, FETCH_CONCURRENCY);
        const alreadyLabelledIds = new Set(
            metaSettled
                .filter((r): r is PromiseFulfilledResult<{ id: string; labelIds: string[] }> => r.status === 'fulfilled')
                .filter((r) => r.value.labelIds.includes(processedLabelId))
                .map((r) => r.value.id)
        );
        const newIds = allIds.filter((id) => !alreadyLabelledIds.has(id));
        console.log(`[GmailService] Metadata check: ${Date.now() - tMeta}ms — ${alreadyLabelledIds.size} already labelled, ${newIds.length} new to process`);

        if (newIds.length === 0) return [];

        // ── Step 2: full fetch only the unlabelled messages ───────────────────────
        const tasks = newIds.map((id, i) => async (): Promise<GmailMessage | null> => {
            const tMsg = Date.now();
            try {
                const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
                const payload = msg.data.payload;
                if (!payload) {
                    console.warn(`[GmailService] [${i + 1}/${newIds.length}] message ${id} has no payload, skipping`);
                    return null;
                }

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
                console.log(`[GmailService] [${i + 1}/${newIds.length}] fetched in ${Date.now() - tMsg}ms — "${subject.slice(0, 60)}" from ${senderEmail}`);

                return { id, subject, snippet, body, senderName, senderEmail, receivedAt: internalDate };
            } catch (msgErr) {
                console.error(`[GmailService] [${i + 1}/${newIds.length}] Error fetching message ${id} (${Date.now() - tMsg}ms):`, msgErr);
                return null;
            }
        });

        const settled = await pAll(tasks, FETCH_CONCURRENCY);
        const results: GmailMessage[] = settled
            .filter((r): r is PromiseFulfilledResult<GmailMessage | null> => r.status === 'fulfilled' && r.value !== null)
            .map((r) => r.value!);

        // ── Step 3: batchModify only the newly-processed IDs ─────────────────────
        const tBatch = Date.now();
        try {
            await gmail.users.messages.batchModify({
                userId: 'me',
                requestBody: {
                    ids: newIds,
                    addLabelIds: [processedLabelId],
                },
            });
            console.log(`[GmailService] batchModify (labelled ${newIds.length} message(s)) took ${Date.now() - tBatch}ms`);
        } catch (batchErr) {
            console.warn(`[GmailService] batchModify failed after ${Date.now() - tBatch}ms — emails may be re-fetched on next scan:`, batchErr);
        }

        console.log(`[GmailService] fetchNewMessages done — ${results.length}/${newIds.length} messages fetched (${alreadyLabelledIds.size}/${allIds.length} already labelled) in ${Date.now() - t0}ms total`);
        return results;
    } catch (err: any) {
        // Handle invalid_grant error from Google
        if (err?.response?.data?.error === 'invalid_grant' || err?.message?.includes('invalid_grant')) {
            console.error('[GmailService] Detected invalid_grant, clearing user tokens');
            // Clear tokens for this user
            await Profile.updateOne(
                { userId },
                {
                    $set: {
                        'integrations.google.accessToken': null,
                        'integrations.google.refreshToken': null,
                        'integrations.google.email': null,
                        'integrations.google.enabled': false,
                        'integrations.google.scope': null,
                    },
                }
            );
            // Throw a special error for the route handler
            const e: any = new Error('Gmail authorization expired. Please reconnect your account.');
            e.code = 'GMAIL_AUTH_EXPIRED';
            throw e;
        }

        // Handle 403 Insufficient Permission (old token missing gmail.modify scope)
        const status = err?.response?.status;
        const errorCode = err?.response?.data?.error?.code;
        const errorMessage = err?.response?.data?.error?.message ?? err?.message ?? '';
        if (status === 403 || errorCode === 403 || errorMessage.toLowerCase().includes('insufficient permission')) {
            console.error('[GmailService] Detected insufficient scopes (403). User needs to re-authenticate.');
            const e: any = new Error('Gmail access is limited. Please reconnect your Google account to enable full email processing.');
            e.code = 'GMAIL_INSUFFICIENT_SCOPES';
            throw e;
        }

        throw err;
    }
}

/**
 * Send an email via Gmail API.
 */
export interface SendEmailOptions {
    to: string;
    subject: string;
    body: string;
}

export async function sendEmail(userId: string, options: SendEmailOptions): Promise<{ messageId: string }> {
    const { to, subject, body } = options;
    const t0 = Date.now();
    console.log(`[GmailService] sendEmail start — to=${to}, subject="${subject}"`);

    try {
        const hasScope = await hasGmailComposeScope(userId);
        if (!hasScope) {
            throw new Error('Gmail compose access not authorized. Please reconnect your Google account.');
        }

        const auth = await getOAuth2Client(userId);
        const gmail = google.gmail({ version: 'v1', auth });

        const message =
            `To: ${to}\r\n` +
            `Subject: ${subject}\r\n` +
            `Content-Type: text/plain; charset=UTF-8\r\n` +
            `\r\n` +
            `${body}`;

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const sent = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log(`[GmailService] sendEmail done — messageId=${sent.data.id} in ${Date.now() - t0}ms`);
        return { messageId: sent.data.id! };
    } catch (err: any) {
        console.error('[GmailService] sendEmail failed:', err.message);

        if (err?.response?.data?.error === 'invalid_grant' || err?.message?.includes('invalid_grant')) {
            await Profile.updateOne(
                { userId },
                {
                    $set: {
                        'integrations.google.accessToken': null,
                        'integrations.google.refreshToken': null,
                        'integrations.google.email': null,
                        'integrations.google.enabled': false,
                        'integrations.google.scope': null,
                    },
                }
            );
            const e: any = new Error('Gmail authorization expired. Please reconnect your account.');
            e.code = 'GMAIL_AUTH_EXPIRED';
            throw e;
        }

        throw err;
    }
}
