// server/src/routes/emailSuggestions.ts
/**
 * Email Suggestion Routes — /api/email-suggestions
 *
 * All routes require authentication.
 *
 * GET    /                  — list pending suggestions for the current user
 * GET    /preferences       — get email suggestion preferences
 * PUT    /preferences       — update email suggestion preferences
 * PUT    /:id               — update an email suggestion (edit matched company/job)
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
import { usageLimiter } from '../middleware/usageLimiter';

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
            res.json({
                scanLimit: 50,
                autoPollApplications: true,
                autoPollJobLeads: true,
                includeReadEmails: false,
            });
            return;
        }

        res.json({
            scanLimit: profile.settings?.emailSuggestions?.scanLimit ?? 50,
            autoPollApplications: profile.settings?.emailSuggestions?.autoPollApplications ?? true,
            autoPollJobLeads: profile.settings?.emailSuggestions?.autoPollJobLeads ?? true,
            includeReadEmails: profile.settings?.emailSuggestions?.includeReadEmails ?? false,
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
        const { scanLimit, autoPollApplications, autoPollJobLeads, includeReadEmails } = req.body;

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
        if (scanLimit !== undefined) {
            profile.settings.emailSuggestions.scanLimit = Number(scanLimit);
        }

        if (autoPollApplications !== undefined) {
            profile.settings.emailSuggestions.autoPollApplications = Boolean(autoPollApplications);
        }

        if (autoPollJobLeads !== undefined) {
            profile.settings.emailSuggestions.autoPollJobLeads = Boolean(autoPollJobLeads);
        }

        if (includeReadEmails !== undefined) {
            profile.settings.emailSuggestions.includeReadEmails = Boolean(includeReadEmails);
        }


        await profile.save();

        res.json({
            scanLimit: profile.settings.emailSuggestions.scanLimit ?? 50,
            autoPollApplications: profile.settings.emailSuggestions.autoPollApplications ?? true,
            autoPollJobLeads: profile.settings.emailSuggestions.autoPollJobLeads ?? true,
            includeReadEmails: profile.settings.emailSuggestions.includeReadEmails ?? false,
        });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/email-suggestions/:id
// Update an email suggestion (edit matched company, job title, or job application)
// Body: { matchedCompanyName?: string; matchedJobTitle?: string; jobApplicationId?: string | null; suggestedStatus?: JobStatus | null; calendarEvent?: { title?, description?, dateTimeISO?, notificationMinutesBefore? } | null }
// ─────────────────────────────────────────────────────────────────────────────
router.put(
    '/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;
        const { matchedCompanyName, matchedJobTitle, jobApplicationId, suggestedStatus, emailCategory, calendarEvent } = req.body;

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
            res.status(409).json({ message: `Cannot edit a ${suggestion.status} suggestion.` });
            return;
        }

        // Update fields if provided
        if (matchedCompanyName !== undefined) {
            suggestion.matchedCompanyName = matchedCompanyName;
        }
        if (matchedJobTitle !== undefined) {
            suggestion.matchedJobTitle = matchedJobTitle;
        }
        if (jobApplicationId !== undefined) {
            // Allow setting to null to unmatch, or to a valid ObjectId to match
            if (jobApplicationId === null) {
                suggestion.jobApplicationId = undefined;
            } else if (mongoose.Types.ObjectId.isValid(jobApplicationId)) {
                // Verify the job application belongs to the user
                const job = await JobApplication.findOne({ _id: jobApplicationId, userId });
                if (!job) {
                    res.status(400).json({ message: 'Job application not found or does not belong to user.' });
                    return;
                }
                suggestion.jobApplicationId = new mongoose.Types.ObjectId(jobApplicationId) as any;
            }
        }
        if (emailCategory !== undefined) {
            if (!['application_response', 'job_offer'].includes(emailCategory)) {
                res.status(400).json({ message: 'emailCategory must be application_response or job_offer' });
                return;
            }
            suggestion.emailCategory = emailCategory;
        }

        if (suggestedStatus !== undefined) {
            const validStatuses = ['Applied', 'Not Applied', 'Interview', 'Assessment', 'Rejected', 'Offer', null];
            if (!validStatuses.includes(suggestedStatus)) {
                res.status(400).json({ message: 'Invalid suggested status.' });
                return;
            }
            suggestion.suggestedStatus = suggestedStatus;
        }

        if (calendarEvent !== undefined) {
            if (calendarEvent === null) {
                suggestion.suggestedCalendarEvent = undefined;
            } else {
                const existing = suggestion.suggestedCalendarEvent || { title: '', description: '', dateTimeISO: '', notificationMinutesBefore: 30 };
                if (calendarEvent.dateTimeISO !== undefined && calendarEvent.dateTimeISO !== '') {
                    if (isNaN(Date.parse(calendarEvent.dateTimeISO))) {
                        res.status(400).json({ message: 'calendarEvent.dateTimeISO must be a valid ISO 8601 date string.' });
                        return;
                    }
                }
                suggestion.suggestedCalendarEvent = {
                    title: calendarEvent.title !== undefined ? String(calendarEvent.title) : existing.title,
                    description: calendarEvent.description !== undefined ? String(calendarEvent.description) : existing.description,
                    dateTimeISO: calendarEvent.dateTimeISO !== undefined ? String(calendarEvent.dateTimeISO) : existing.dateTimeISO,
                    notificationMinutesBefore: calendarEvent.notificationMinutesBefore !== undefined
                        ? Number(calendarEvent.notificationMinutesBefore)
                        : existing.notificationMinutesBefore,
                };
            }
        }

        await suggestion.save();

        // Populate jobApplicationId before returning
        await suggestion.populate('jobApplicationId', 'jobTitle companyName status');

        res.json({ message: 'Suggestion updated.', suggestion });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/poll
// Manually trigger Gmail polling for the current user.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/poll',
    usageLimiter('emailScan'),
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

        // Guard: Gmail scope must be connected before scanning
        const scopeOk = await hasGmailScope(userId);
        if (!scopeOk) {
            res.status(403).json({
                message: 'Gmail account not connected. Please connect your Gmail account to scan for job emails.',
            });
            return;
        }

        // Allow caller to specify how many recent emails to scan, default 50
        const limit = Number(req.body?.scanLimit) || 50;
        const includeReadEmails = Boolean(req.body?.includeReadEmails);

        // Respect the user's category preferences
        const profile = await Profile.findOne({ userId });
        const emailSettings = profile?.settings?.emailSuggestions ?? {};
        const autoPollApplications = (emailSettings as any).autoPollApplications ?? true;
        const autoPollJobLeads = (emailSettings as any).autoPollJobLeads ?? true;

        if (!autoPollApplications && !autoPollJobLeads) {
            res.json({ message: 'Poll complete. 0 new suggestion(s) created.', count: 0 });
            return;
        }

        // Single AI pass: pass a category filter only when one type is disabled
        let category: 'application_response' | 'job_offer' | undefined;
        if (autoPollApplications && !autoPollJobLeads) category = 'application_response';
        else if (!autoPollApplications && autoPollJobLeads) category = 'job_offer';
        // else: both enabled → no filter

        // Keep-alive setup for long-running Heroku requests
        let headersSent = false;
        const keepAliveInterval = setInterval(() => {
            if (!headersSent) {
                res.setHeader('Content-Type', 'application/json');
                res.status(200);
                headersSent = true;
            }
            res.write(' ');
        }, 15000); // 15 seconds

        try {
            const result = await pollEmailsForUser(userId, limit, category, includeReadEmails);
            clearInterval(keepAliveInterval);
            
            const payload = {
                message: `Poll complete. ${result.created} new suggestion(s) created.`,
                count: result.created,
                scanned: result.scanned,
                applicationResponses: result.applicationResponses,
                jobLeads: result.jobLeads,
            };

            if (!headersSent) {
                res.json(payload);
            } else {
                res.write(JSON.stringify(payload));
                res.end();
            }
        } catch (err: any) {
            clearInterval(keepAliveInterval);
            
            if (headersSent) {
                // If headers already sent as 200, we just write the error in the body
                // The frontend won't easily catch it as a 4xx/5xx, but it prevents a crash/CORS error
                res.write(JSON.stringify({ error: err.message || 'Failed to poll Gmail' }));
                res.end();
                return;
            }

            if (err?.code === 'GMAIL_AUTH_EXPIRED') {
                res.status(401).json({
                    message: err.message || 'Gmail authorization expired. Please reconnect your account.',
                    code: 'GMAIL_AUTH_EXPIRED',
                });
                return;
            }

            if (err?.code === 'GMAIL_INSUFFICIENT_SCOPES') {
                res.status(403).json({
                    message: err.message || 'Gmail access is limited. Please reconnect your Google account to enable full email processing.',
                    code: 'GMAIL_INSUFFICIENT_SCOPES',
                });
                return;
            }

            // fallback: generic error
            res.status(500).json({ message: err?.message || 'Failed to poll Gmail.' });
        }
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/:id/add-note
// Independently append the suggested note to the matched job (without changing
// the suggestion's status or the job's status).
// Body: { includeEmailLink?: boolean }  (default true)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/add-note',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;
        const includeEmailLink: boolean = req.body?.includeEmailLink !== false; // default true

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
                let noteEntry = `[${timestamp}] ${suggestion.suggestedNote}`;
                if (includeEmailLink) {
                    noteEntry += `\n📧 Email: https://mail.google.com/mail/u/0/#all/${suggestion.gmailMessageId}`;
                }
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
// Body: { includeCalendarEvent?: boolean, includeEmailLink?: boolean }  (default true if suggestedCalendarEvent exists)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/accept',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { id } = req.params;
        const includeCalendarEvent: boolean = req.body?.includeCalendarEvent !== false; // default true
        const includeEmailLink: boolean = req.body?.includeEmailLink !== false; // default true

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

                if (suggestion.emailCategory === 'application_response') {
                    (job as any).lastResponseAt = new Date();
                }

                // Append note if it hasn't already been added via /add-note
                if (suggestion.suggestedNote && !suggestion.noteAdded) {
                    const timestamp = new Date().toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    });
                    let noteEntry = `[${timestamp}] ${suggestion.suggestedNote}`;
                    if (includeEmailLink) {
                        noteEntry += `\n📧 Email: https://mail.google.com/mail/u/0/#all/${suggestion.gmailMessageId}`;
                    }
                    job.notes = job.notes ? `${job.notes}\n\n${noteEntry}` : noteEntry;
                }

                // Create calendar event if requested and one was suggested with a valid date
                const calEventDate = suggestion.suggestedCalendarEvent?.dateTimeISO
                    ? new Date(suggestion.suggestedCalendarEvent.dateTimeISO)
                    : null;
                const hasValidCalEvent = calEventDate && !isNaN(calEventDate.getTime());

                if (includeCalendarEvent && suggestion.suggestedCalendarEvent && hasValidCalEvent) {
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
