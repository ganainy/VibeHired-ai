// server/src/routes/emailSuggestions.ts
/**
 * Email Suggestion Routes — /api/email-suggestions
 *
 * All routes require authentication.
 *
 * GET    /                  — list pending suggestions for the current user
 * GET    /preferences       — get email suggestion preferences
 * PUT    /preferences       — update email suggestion preferences
 * POST   /:id/accept        — accept a suggestion (apply status + optional calendar event)
 * POST   /:id/add-note      — independently append suggested note to job
 * POST   /:id/reject        — reject / dismiss a suggestion
 * POST   /poll              — manually trigger Gmail poll for the current user
 * GET    /gmail-scope-status — check if the user's Google token has Gmail scope
 */
import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import EmailSuggestion from '../models/EmailSuggestion';
import JobApplication from '../models/JobApplication';
import Profile from '../models/Profile';
import { asyncHandler } from '../utils/asyncHandler';
import { pollEmailsForUser } from '../services/emailSuggestionService';
import { hasGmailScope } from '../services/gmailService';
import { createCalendarEvent, isGoogleConnected } from '../services/googleCalendarService';

const router: Router = express.Router();

// Simple in-memory rate limiter: one manual /poll per user per 60 seconds
const pollCooldowns = new Map<string, number>();
const POLL_COOLDOWN_MS = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/email-suggestions
// Returns all pending suggestions, populated with job info.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);

        const suggestions = await EmailSuggestion.find({ userId, status: 'pending' })
            .sort({ createdAt: -1 })
            .populate('jobApplicationId', 'jobTitle companyName status')
            .lean();

        res.json(suggestions);
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/email-suggestions/gmail-scope-status
// Returns { hasScope: boolean } — whether the user's Google token has Gmail scope.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/gmail-scope-status',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const scopeOk = await hasGmailScope(userId);
        res.json({ hasScope: scopeOk });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/email-suggestions/preferences
// Returns the user's email suggestion preferences.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
    '/preferences',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);

        let profile = await Profile.findOne({ userId }).lean();
        if (!profile) {
            // Return defaults if profile doesn't exist
            res.json({ lookbackDays: 14 });
            return;
        }

        res.json({
            lookbackDays: profile.settings?.emailSuggestions?.lookbackDays ?? 14,
            defaultProvider: profile.aiProviderSettings?.defaultProvider ?? null,
            inboxProvider: profile.aiProviderSettings?.inboxProvider ?? null,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/email-suggestions/preferences
// Updates the user's email suggestion preferences.
// ─────────────────────────────────────────────────────────────────────────────
router.put(
    '/preferences',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { lookbackDays, inboxProvider } = req.body;

        // Validate lookbackDays
        if (lookbackDays !== undefined) {
            const days = Number(lookbackDays);
            if (isNaN(days) || days < 1 || days > 30) {
                res.status(400).json({ message: 'lookbackDays must be a number between 1 and 30.' });
                return;
            }
        }

        // Validate inboxProvider
        const validProviders = ['gemini', 'openrouter', 'ollama', null, ''];
        if (inboxProvider !== undefined && !validProviders.includes(inboxProvider)) {
            res.status(400).json({ message: 'inboxProvider must be one of: gemini, openrouter, ollama, or null.' });
            return;
        }

        // Find or create profile
        let profile = await Profile.findOne({ userId });
        if (!profile) {
            profile = new Profile({ userId });
        }

        // Initialize settings if not present
        if (!profile.settings) {
            profile.settings = {};
        }
        if (!profile.settings.emailSuggestions) {
            profile.settings.emailSuggestions = {};
        }

        // Update the preference
        if (lookbackDays !== undefined) {
            profile.settings.emailSuggestions.lookbackDays = Number(lookbackDays);
        }

        // Update inboxProvider override (empty string or null clears the override)
        if (inboxProvider !== undefined) {
            if (!profile.aiProviderSettings) profile.aiProviderSettings = {};
            profile.aiProviderSettings.inboxProvider = inboxProvider || undefined;
        }

        await profile.save();

        res.json({
            lookbackDays: profile.settings.emailSuggestions.lookbackDays,
            defaultProvider: profile.aiProviderSettings?.defaultProvider ?? null,
            inboxProvider: profile.aiProviderSettings?.inboxProvider ?? null,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/poll
// Manually trigger Gmail polling for the current user.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/poll',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);

        // Rate-limit: allow at most one manual poll per user per 60 seconds
        const lastPoll = pollCooldowns.get(userId);
        const now = Date.now();
        if (lastPoll && (now - lastPoll) < POLL_COOLDOWN_MS) {
            const retryAfter = Math.ceil((POLL_COOLDOWN_MS - (now - lastPoll)) / 1000);
            res.status(429).json({
                message: `Too many requests. Wait ${retryAfter}s before scanning again.`,
                retryAfter,
            });
            return;
        }
        pollCooldowns.set(userId, now);

        // Allow caller to specify a custom lookback window (days), default 7
        const days = Number(req.body?.lookbackDays) || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const count = await pollEmailsForUser(userId, since);
        res.json({ message: `Poll complete. ${count} new suggestion(s) created.`, count });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/:id/add-note
// Independently append the suggested note to the matched job (without changing
// the suggestion's status or the job's status).
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/add-note',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid suggestion ID.' });
            return;
        }

        const suggestion = await EmailSuggestion.findOne({ _id: id, userId });
        if (!suggestion) {
            res.status(404).json({ message: 'Suggestion not found.' });
            return;
        }
        if (!suggestion.suggestedNote) {
            res.status(400).json({ message: 'This suggestion has no note to add.' });
            return;
        }
        if (suggestion.noteAdded) {
            res.status(409).json({ message: 'Note has already been added to the job.' });
            return;
        }

        if (suggestion.jobApplicationId) {
            const job = await JobApplication.findOne({ _id: suggestion.jobApplicationId, userId });
            if (job) {
                const timestamp = new Date().toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                });
                const noteEntry = `[${timestamp}] ${suggestion.suggestedNote}`;
                job.notes = job.notes ? `${job.notes}\n\n${noteEntry}` : noteEntry;
                await job.save();
            }
        }

        suggestion.noteAdded = true;
        await suggestion.save();

        res.json({ message: 'Note added to job.', suggestion });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/:id/accept
// Accept a suggestion: update the matched job's status.
// Body: { includeCalendarEvent?: boolean }  (default true if suggestedCalendarEvent exists)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/accept',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;
        const includeCalendarEvent: boolean = req.body?.includeCalendarEvent !== false; // default true

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid suggestion ID.' });
            return;
        }

        const suggestion = await EmailSuggestion.findOne({ _id: id, userId });
        if (!suggestion) {
            res.status(404).json({ message: 'Suggestion not found.' });
            return;
        }
        if (suggestion.status !== 'pending') {
            res.status(409).json({ message: `Suggestion is already ${suggestion.status}.` });
            return;
        }

        let calendarEventCreated = false;
        let calendarWarning: string | undefined;

        // Apply to the job application if one is matched
        if (suggestion.jobApplicationId) {
            const job = await JobApplication.findOne({ _id: suggestion.jobApplicationId, userId });
            if (job) {
                if (suggestion.suggestedStatus) {
                    job.status = suggestion.suggestedStatus;
                }

                // Append note if it hasn't already been added via /add-note
                if (suggestion.suggestedNote && !suggestion.noteAdded) {
                    const timestamp = new Date().toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    });
                    const noteEntry = `[${timestamp}] ${suggestion.suggestedNote}`;
                    job.notes = job.notes ? `${job.notes}\n\n${noteEntry}` : noteEntry;
                }

                // Create calendar event if requested and one was suggested
                if (includeCalendarEvent && suggestion.suggestedCalendarEvent) {
                    const calEvent = suggestion.suggestedCalendarEvent;
                    try {
                        const googleConnected = await isGoogleConnected(userId);
                        if (!googleConnected) {
                            calendarWarning = 'Google Calendar not connected — event was not created.';
                        } else {
                            const reminderObj = {
                                id: new mongoose.Types.ObjectId().toString(),
                                naturalText: calEvent.title,
                                title: calEvent.title,
                                description: calEvent.description,
                                dateTimeISO: calEvent.dateTimeISO,
                                notificationMinutesBefore: calEvent.notificationMinutesBefore ?? 30,
                                status: 'pending' as const,
                                createdAt: new Date(),
                            };
                            const calendarEventId = await createCalendarEvent(
                                userId,
                                reminderObj as any,
                                { jobTitle: job.jobTitle, companyName: job.companyName }
                            );
                            if (!job.reminders) job.reminders = [];
                            job.reminders.push({
                                ...reminderObj,
                                calendarEventId,
                                status: 'synced',
                            } as any);
                            calendarEventCreated = true;
                        }
                    } catch (calErr) {
                        console.error('[emailSuggestions] Failed to create calendar event:', calErr);
                        calendarWarning = 'Calendar event could not be created — Google Calendar may not be connected.';
                    }
                }

                await job.save();
            }
        }

        suggestion.status = 'accepted';
        if (suggestion.suggestedNote && !suggestion.noteAdded) suggestion.noteAdded = true;
        await suggestion.save();

        res.json({
            message: 'Suggestion accepted.',
            suggestion,
            calendarEventCreated,
            ...(calendarWarning ? { calendarWarning } : {}),
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/:id/reject
// Dismiss a suggestion without applying any changes.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid suggestion ID.' });
            return;
        }

        const suggestion = await EmailSuggestion.findOne({ _id: id, userId });
        if (!suggestion) {
            res.status(404).json({ message: 'Suggestion not found.' });
            return;
        }

        suggestion.status = 'rejected';
        await suggestion.save();

        res.json({ message: 'Suggestion dismissed.' });
    })
);

export default router;
