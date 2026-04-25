// server/src/routes/googleAuth.ts
/**
 * Google OAuth 2.0 routes — two separate flows:
 *
 * ── Calendar Integration (existing) ──
 *   GET  /api/auth/google/connect     — Returns consent URL (authenticated, calendar scopes)
 *   GET  /api/auth/google/callback    — Stores tokens after calendar auth
 *   GET  /api/auth/google/status      — Returns { connected, email }
 *   DELETE /api/auth/google/disconnect
 *
 * ── Google Sign-In (new) ──
 *   GET  /api/auth/google/login       — Returns consent URL (public, email+profile scopes)
 *   GET  /api/auth/google/auth-callback — Handles login redirect; issues JWT
 */
import express, { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import authMiddleware from '../middleware/authMiddleware';
import Profile from '../models/Profile';
import User from '../models/User';
import { env } from '../config/env';
import { getPrimaryFrontendUrl } from '../config/frontend';
import { encrypt } from '../utils/encryption';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors/AppError';
import {
    listUpcomingEvents,
    createEvent,
    updateEvent,
    deleteCalendarEvent
} from '../services/googleCalendarService';

const router: Router = express.Router();

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.modify',      // required for batchModify to apply processed label
    'https://www.googleapis.com/auth/gmail.compose', // required for sending emails
];

function buildOAuth2Client(redirectUri?: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
        throw new ValidationError(
            'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.'
        );
    }
    return new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        redirectUri ?? env.GOOGLE_REDIRECT_URI
    );
}

/**
 * GET /api/auth/google/status
 * Returns whether the current user has Google Calendar connected.
 * Also checks if the stored token has the required gmail.modify scope.
 */
router.get('/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const profile = await Profile.findOne({ userId });
    const g = profile?.integrations?.google;
    const connected = !!(g?.enabled && g?.accessToken);
    const hasModifyScope = connected && (g?.scope ?? '').includes('https://www.googleapis.com/auth/gmail.modify');
    res.json({
        connected,
        email: g?.email ?? null,
        needsReauth: connected && !hasModifyScope,
    });
}));

/**
 * GET /api/auth/google/connect
 * Returns `{ url }` — the Google OAuth consent screen URL.
 * The frontend should redirect the user there.
 */
router.get('/connect', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const oauth2Client = buildOAuth2Client();

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: userId, // We pass userId so the callback knows which account to update
    });

    res.json({ url });
}));

/**
 * GET /api/auth/google/callback
 * Google redirects here after user grants consent.
 * Exchanges the auth code for tokens and stores them encrypted in the Profile.
 */
router.get('/callback', asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId, error } = req.query as Record<string, string>;

    const frontendUrl = getPrimaryFrontendUrl();

    if (error || !code || !userId) {
        return res.redirect(`${frontendUrl}/settings?googleCalendar=error&reason=${encodeURIComponent(error || 'missing_code')}`);
    }

    const oauth2Client = buildOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
        return res.redirect(`${frontendUrl}/settings?googleCalendar=error&reason=no_access_token`);
    }

    // Fetch the user's Google email address
    oauth2Client.setCredentials(tokens);
    let googleEmail = '';
    try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const info = await oauth2.userinfo.get();
        googleEmail = info.data.email ?? '';
    } catch {
        // Best-effort; email is only for display purposes
    }

    await Profile.findOneAndUpdate(
        { userId },
        {
            $set: {
                'integrations.google.accessToken': encrypt(tokens.access_token),
                'integrations.google.refreshToken': tokens.refresh_token
                    ? encrypt(tokens.refresh_token)
                    : undefined,
                'integrations.google.email': googleEmail,
                'integrations.google.enabled': true,
                'integrations.google.scope': tokens.scope ?? undefined,
            },
        },
        { upsert: true }
    );

    return res.redirect(`${frontendUrl}/calendar?googleCalendar=connected`);
}));

/**
 * DELETE /api/auth/google/disconnect
 * Clears stored Google tokens from the Profile.
 */
router.delete('/disconnect', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);

    // Optional: revoke the token on Google's side
    const profile = await Profile.findOne({ userId });
    if (profile?.integrations?.google?.accessToken) {
        try {
            const { decrypt } = await import('../utils/encryption');
            const accessToken = decrypt(profile.integrations.google.accessToken);
            if (accessToken) {
                const oauth2Client = buildOAuth2Client();
                await oauth2Client.revokeToken(accessToken);
            }
        } catch {
            // Non-fatal — proceed with clearing the stored tokens
        }
    }

    await Profile.findOneAndUpdate(
        { userId },
        {
            $set: {
                'integrations.google.accessToken': null,
                'integrations.google.refreshToken': null,
                'integrations.google.email': null,
                'integrations.google.enabled': false,
            },
        }
    );

    res.json({ message: 'Google Calendar disconnected.' });
}));

/**
 * GET /api/auth/google/events
 * Returns upcoming Google Calendar events for the authenticated user.
 * Query param: maxResults (optional, default 20)
 */
router.get('/events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const maxResults = parseInt(String(req.query.maxResults ?? '50'), 10) || 50;
    const { timeMin, timeMax } = req.query as Record<string, string>;
    const events = await listUpcomingEvents(userId, { maxResults, timeMin, timeMax });
    res.json(events);
}));

/**
 * POST /api/auth/google/events
 * Creates a new event in the user's primary Google Calendar.
 */
router.post('/events', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const event = await createEvent(userId, req.body);
    res.status(201).json(event);
}));

/**
 * PUT /api/auth/google/events/:id
 * Updates an existing event in the user's primary Google Calendar.
 */
router.put('/events/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const eventId = req.params.id;
    const event = await updateEvent(userId, eventId, req.body);
    res.json(event);
}));

/**
 * DELETE /api/auth/google/events/:id
 * Deletes an event from the user's primary Google Calendar.
 * Also clears the reminder status on any linked work entry.
 */
router.delete('/events/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const eventId = req.params.id;
    await deleteCalendarEvent(userId, eventId);

    // Clear reminder status on any linked work entry
    const WorkEntry = (await import('../models/WorkEntry')).default;
    await WorkEntry.updateMany(
        { userId, googleCalendarEventId: eventId },
        { $set: { googleCalendarEventId: undefined, reminderCreated: false } }
    );

    res.status(204).send();
}));

// ─────────────────────────────────────────────────────────────────────────────
// Google Sign-In routes (public — no authMiddleware)
// ─────────────────────────────────────────────────────────────────────────────

const LOGIN_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid',
];

const JWT_EXPIRY = '7d';

function getJwtSecret(): string {
    const secret = env.JWT_SECRET;
    if (!secret) throw new ValidationError('JWT_SECRET is not configured.');
    return secret;
}

/**
 * GET /api/auth/google/login
 * Public — returns `{ url }` for the Google consent page (email + profile scopes).
 * Frontend should redirect/open the returned URL.
 */
router.get('/login', asyncHandler(async (_req: Request, res: Response) => {
    const loginRedirectUri = env.GOOGLE_LOGIN_REDIRECT_URI || 'http://localhost:5001/api/auth/google/auth-callback';
    const oauth2Client = buildOAuth2Client(loginRedirectUri);
    const url = oauth2Client.generateAuthUrl({
        access_type: 'online',
        scope: LOGIN_SCOPES,
        prompt: 'select_account',
    });
    res.json({ url });
}));

/**
 * GET /api/auth/google/auth-callback
 * Public — Google redirects here after the user signs in.
 * Finds or creates the User, issues a JWT, and redirects to the frontend.
 */
router.get('/auth-callback', asyncHandler(async (req: Request, res: Response) => {
    const { code, error } = req.query as Record<string, string>;
    const frontendUrl = getPrimaryFrontendUrl();

    if (error || !code) {
        return res.redirect(`${frontendUrl}/login?error=google_failed`);
    }

    let googleEmail: string;
    let googleId: string;
    try {
        const loginRedirectUri = env.GOOGLE_LOGIN_REDIRECT_URI || 'http://localhost:5001/api/auth/google/auth-callback';
        const oauth2Client = buildOAuth2Client(loginRedirectUri);
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();

        if (!data.email || !data.id) {
            return res.redirect(`${frontendUrl}/login?error=google_failed`);
        }
        googleEmail = data.email.toLowerCase();
        googleId = data.id;
    } catch {
        return res.redirect(`${frontendUrl}/login?error=google_failed`);
    }

    // Find by googleId first, then by email (to link existing accounts)
    let user = await User.findOne({ googleId });

    // Ensure existing Google users are always marked as verified (backfill for
    // accounts created before this flag was set on OAuth sign-up).
    if (user && !user.emailVerified) {
        user.emailVerified = true;
        await user.save({ validateBeforeSave: false });
    }

    if (!user) {
        user = await User.findOne({ email: googleEmail });
        if (user) {
            // Link this Google account to the existing email account
            user.googleId = googleId;
            // Google has already verified this email address
            user.emailVerified = true;
            await user.save({ validateBeforeSave: false });
        } else {
            // Create a brand-new Google-only account
            let username = googleEmail.split('@')[0].replace(/[^a-z0-9_-]/gi, '').substring(0, 30) || 'user';
            const taken = await User.findOne({ username });
            if (taken) username = `${username}${Math.floor(Math.random() * 9000) + 1000}`;

            // emailVerified: true because Google has already verified this email
            user = new User({ email: googleEmail, googleId, username, emailVerified: true });
            await user.save({ validateBeforeSave: false });
        }
    }

    const token = jwt.sign(
        { userId: String(user._id), email: user.email },
        getJwtSecret(),
        { expiresIn: JWT_EXPIRY as jwt.SignOptions['expiresIn'] }
    );

    return res.redirect(`${frontendUrl}/auth/google?token=${token}`);
}));

export default router;

