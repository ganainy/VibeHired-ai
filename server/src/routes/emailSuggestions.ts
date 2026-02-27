// server/src/routes/emailSuggestions.ts
/**
 * Email Suggestion Routes — /api/email-suggestions
 *
 * All routes require authentication.
 *
 * GET    /                  — list pending suggestions for the current user
 * POST   /:id/accept        — accept a suggestion (apply status + note to job)
 * POST   /:id/reject        — reject / dismiss a suggestion
 * POST   /poll              — manually trigger Gmail poll for the current user
 * GET    /gmail-scope-status — check if the user's Google token has Gmail scope
 */
import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import EmailSuggestion from '../models/EmailSuggestion';
import JobApplication from '../models/JobApplication';
import { asyncHandler } from '../utils/asyncHandler';
import { pollEmailsForUser } from '../services/emailSuggestionService';
import { hasGmailScope } from '../services/gmailService';

const router: Router = express.Router();

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
// POST /api/email-suggestions/poll
// Manually trigger Gmail polling for the current user.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/poll',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);

        // Allow caller to specify a custom lookback window (days), default 7
        const days = Number(req.body?.lookbackDays) || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const count = await pollEmailsForUser(userId, since);
        res.json({ message: `Poll complete. ${count} new suggestion(s) created.`, count });
    })
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/email-suggestions/:id/accept
// Accept a suggestion: update the matched job's status and append a note.
// ─────────────────────────────────────────────────────────────────────────────
router.post(
    '/:id/accept',
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
        if (suggestion.status !== 'pending') {
            res.status(409).json({ message: `Suggestion is already ${suggestion.status}.` });
            return;
        }

        // Apply to the job application if one is matched
        if (suggestion.jobApplicationId) {
            const job = await JobApplication.findOne({ _id: suggestion.jobApplicationId, userId });
            if (job) {
                if (suggestion.suggestedStatus) {
                    job.status = suggestion.suggestedStatus;
                }
                if (suggestion.suggestedNote) {
                    const timestamp = new Date().toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                    });
                    const noteEntry = `[${timestamp}] ${suggestion.suggestedNote}`;
                    job.notes = job.notes ? `${job.notes}\n\n${noteEntry}` : noteEntry;
                }
                await job.save();
            }
        }

        suggestion.status = 'accepted';
        await suggestion.save();

        res.json({ message: 'Suggestion accepted.', suggestion });
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
