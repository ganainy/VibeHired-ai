// server/src/services/googleCalendarService.ts
import { google } from 'googleapis';
import Profile from '../models/Profile';
import { encrypt, decrypt } from '../utils/encryption';
import { env } from '../config/env';
import { IReminder } from '../models/JobApplication';
import { AuthorizationError, AuthenticationError } from '../utils/errors/AppError';

export interface CalendarEventItem {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    location?: string;
    description?: string;
}

/** Returns a configured OAuth2Client for the given user, refreshing tokens if needed. */
async function getOAuth2Client(userId: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new Error('Google OAuth credentials are not configured on the server.');
    }

    const profile = await Profile.findOne({ userId });
    const googleIntegration = profile?.integrations?.google;

    if (!googleIntegration?.enabled || !googleIntegration?.accessToken) {
        throw new AuthenticationError('Google Calendar is not connected for this account.');
    }

    const accessToken = decrypt(googleIntegration.accessToken);
    const refreshToken = googleIntegration.refreshToken ? decrypt(googleIntegration.refreshToken) : null;

    if (!accessToken) {
        throw new AuthenticationError('Google Calendar credentials are invalid. Please reconnect your Google account.');
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
    if (isNaN(startDateTime.getTime())) {
        throw new Error(`Invalid dateTimeISO for calendar event: "${reminder.dateTimeISO}"`);
    }
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
 * Create a general Google Calendar event.
 */
export async function createEvent(
    userId: string,
    eventData: {
        summary: string;
        description?: string;
        location?: string;
        start: { dateTime: string; timeZone?: string };
        end: { dateTime: string; timeZone?: string };
    }
): Promise<CalendarEventItem> {
    const auth = await getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventData,
    });

    const item = response.data;
    return {
        id: item.id ?? '',
        summary: item.summary ?? '',
        start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined },
        end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined },
        location: item.location ?? undefined,
        description: item.description ?? undefined,
    };
}

/**
 * Update a Google Calendar event.
 */
export async function updateEvent(
    userId: string,
    eventId: string,
    eventData: {
        summary: string;
        description?: string;
        location?: string;
        start: { dateTime: string; timeZone?: string };
        end: { dateTime: string; timeZone?: string };
    }
): Promise<CalendarEventItem> {
    const auth = await getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const response = await calendar.events.update({
            calendarId: 'primary',
            eventId,
            requestBody: eventData,
        });

        const item = response.data;
        return {
            id: item.id ?? '',
            summary: item.summary ?? '',
            start: { dateTime: item.start?.dateTime ?? undefined, date: item.start?.date ?? undefined },
            end: { dateTime: item.end?.dateTime ?? undefined, date: item.end?.date ?? undefined },
            location: item.location ?? undefined,
            description: item.description ?? undefined,
        };
    } catch (err: any) {
        // Google returns 403 when the user is not the organizer of the event
        // (e.g. interview invites created by a recruiter).
        const message: string = err?.message ?? err?.errors?.[0]?.message ?? '';
        if (
            err?.code === 403 ||
            err?.status === 403 ||
            message.toLowerCase().includes('organizer')
        ) {
            throw new AuthorizationError(
                "This event was created by someone else (e.g. a recruiter invite). " +
                "Only the organizer can change its shared properties. " +
                "You can edit your own copy of the event directly in Google Calendar."
            );
        }
        throw err;
    }
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

/**
 * List events from the user's primary Google Calendar.
 */
export async function listUpcomingEvents(
    userId: string,
    options: { maxResults?: number; timeMin?: string; timeMax?: string } = {}
): Promise<CalendarEventItem[]> {
    const auth = await getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: options.timeMin || new Date().toISOString(),
            timeMax: options.timeMax || undefined,
            maxResults: options.maxResults || 50,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const items = response.data.items ?? [];
        return items.map((item) => ({
            id: item.id ?? '',
            summary: item.summary ?? '(No title)',
            start: {
                dateTime: item.start?.dateTime ?? undefined,
                date: item.start?.date ?? undefined,
            },
            end: {
                dateTime: item.end?.dateTime ?? undefined,
                date: item.end?.date ?? undefined,
            },
            location: item.location ?? undefined,
            description: item.description ?? undefined,
        }));
    } catch (err: any) {
        const status = err?.code ?? err?.status ?? err?.response?.status;
        const message = String(err?.message ?? err?.response?.data?.error?.message ?? '').toLowerCase();
        const isAuthFailure =
            status === 401 ||
            status === 403 ||
            message.includes('invalid credentials') ||
            message.includes('invalid_grant') ||
            message.includes('login required') ||
            message.includes('unauthorized');

        if (isAuthFailure) {
            await Profile.updateOne(
                { userId },
                {
                    $set: {
                        'integrations.google.accessToken': null,
                        'integrations.google.refreshToken': null,
                        'integrations.google.enabled': false,
                    },
                }
            );
            throw new AuthenticationError('Google Calendar connection expired. Please reconnect your Google account.');
        }

        throw err;
    }
}
