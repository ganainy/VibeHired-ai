// server/src/routes/googleAuth.ts
/**
 * Google OAuth 2.0 routes for Calendar integration.
 *
 * Endpoints:
 *   GET  /api/auth/google/connect   — Returns the Google OAuth consent URL
 *   GET  /api/auth/google/callback  — Handles the OAuth callback; stores tokens
 *   GET  /api/auth/google/status    — Returns { connected, email }
 *   DELETE /api/auth/google/disconnect — Revokes & removes stored tokens
 */
import express, { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import authMiddleware from '../middleware/authMiddleware';
import Profile from '../models/Profile';
import { env } from '../config/env';
import { encrypt } from '../utils/encryption';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError } from '../utils/errors/AppError';

const router: Router = express.Router();

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
];

function buildOAuth2Client() {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
        throw new ValidationError(
            'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.'
        );
    }
    return new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI
    );
}

/**
 * GET /api/auth/google/status
 * Returns whether the current user has Google Calendar connected.
 */
router.get('/status', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const profile = await Profile.findOne({ userId });
    const g = profile?.integrations?.google;
    res.json({
        connected: !!(g?.enabled && g?.accessToken),
        email: g?.email ?? null,
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

    const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';

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
            },
        },
        { upsert: true }
    );

    return res.redirect(`${frontendUrl}/settings?googleCalendar=connected`);
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

export default router;
