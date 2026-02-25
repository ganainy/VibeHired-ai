// server/src/services/googleCalendarService.ts
import { google } from 'googleapis';
import Profile from '../models/Profile';
import { encrypt, decrypt } from '../utils/encryption';
import { env } from '../config/env';
import { IReminder } from '../models/JobApplication';

/** Returns a configured OAuth2Client for the given user, refreshing tokens if needed. */
async function getOAuth2Client(userId: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials are not configured on the server.');
    }

    const profile = await Profile.findOne({ userId });
    const googleIntegration = profile?.integrations?.google;

    if (!googleIntegration?.enabled || !googleIntegration?.accessToken) {
        throw new Error('Google Calendar is not connected for this account.');
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

    // Persist refreshed tokens automatically
    oauth2Client.on('tokens', async (tokens) => {
        try {
            const updateData: Record<string, unknown> = {};
            if (tokens.access_token) {
                updateData['integrations.google.accessToken'] = encrypt(tokens.access_token);
            }
            if (tokens.refresh_token) {
                updateData['integrations.google.refreshToken'] = encrypt(tokens.refresh_token);
            }
            if (Object.keys(updateData).length > 0) {
                await Profile.updateOne({ userId }, { $set: updateData });
            }
        } catch (err) {
            console.error('Failed to persist refreshed Google tokens:', err);
        }
    });

    return oauth2Client;
}

/**
 * Create a Google Calendar event for a reminder.
 * Returns the newly created event's ID.
 */
export async function createCalendarEvent(
    userId: string,
    reminder: IReminder,
    jobContext: { jobTitle: string; companyName: string }
): Promise<string> {
    const auth = await getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const startDateTime = new Date(reminder.dateTimeISO);
    // 30-min duration by default
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60 * 1000);

    const event = {
        summary: reminder.title,
        description: `${reminder.description}\n\n---\nJob: ${jobContext.jobTitle} @ ${jobContext.companyName}\nAdded via Job App Assistant`,
        start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'UTC',
        },
        end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'UTC',
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: reminder.notificationMinutesBefore },
                { method: 'email', minutes: reminder.notificationMinutesBefore },
            ],
        },
    };

    const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
    });

    const eventId = response.data.id;
    if (!eventId) throw new Error('Google Calendar did not return an event ID.');
    return eventId;
}

/**
 * Delete a Google Calendar event.
 * Silently ignores 404 errors (event already deleted on Google's side).
 */
export async function deleteCalendarEvent(
    userId: string,
    calendarEventId: string
): Promise<void> {
    const auth = await getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: calendarEventId,
        });
    } catch (err: any) {
        // 404 — event was already removed on Google's side, nothing to do
        if (err?.code === 404 || err?.status === 404) return;
        throw err;
    }
}

/**
 * Check whether a user has Google Calendar connected and operational.
 */
export async function isGoogleConnected(userId: string): Promise<boolean> {
    try {
        const profile = await Profile.findOne({ userId });
        const g = profile?.integrations?.google;
        return !!(g?.enabled && g?.accessToken);
    } catch {
        return false;
    }
}
