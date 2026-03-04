// server/src/services/emailSuggestionService.ts
/**
 * EmailSuggestionService — processes Gmail messages, classifies them with AI,
 * matches them to job applications, and saves pending suggestions.
 */
import Profile from '../models/Profile';
import JobApplication from '../models/JobApplication';
import EmailSuggestion, { JobStatus } from '../models/EmailSuggestion';
import { fetchNewMessages, hasGmailScope } from './gmailService';
import { generateStructuredResponse } from '../utils/aiService';

// ── AI classification result ────────────────────────────────────────────────

interface SuggestedCalendarEvent {
    title: string;
    description: string;
    /** ISO 8601 datetime string, e.g. "2026-03-10T14:00:00Z" */
    dateTimeISO: string;
    notificationMinutesBefore: number;
}

interface EmailClassification {
    isJobRelated: boolean;
    /** One of the valid job statuses, or null if email doesn't warrant a change */
    suggestedStatus: JobStatus | null;
    /** Richer note summarising key info from the email (salary, advice, prep tips, etc.) */
    suggestedNote: string;
    /** Calendar event to create, if the email contains a concrete date/time */
    suggestedCalendarEvent: SuggestedCalendarEvent | null;
    /** Company name extracted from the email */
    extractedCompany: string;
    /** Job title extracted from the email */
    extractedRole: string;
    confidence: 'high' | 'medium' | 'low';
    /**
     * 'application_response' — a reply/update on a job the user already applied to.
     * 'job_offer'            — a recruiter or job board proactively offering the user a new position.
     */
    emailCategory: 'application_response' | 'job_offer';
}

// ── PII helpers ──────────────────────────────────────────────────────────────

/**
 * Strips common PII patterns from an email body before it is sent to an
 * external AI provider.  Removes email addresses, phone numbers, and
 * standalone personal names that appear in common signature patterns.
 */
function sanitizeEmailBody(body: string): string {
    return body
        // Remove email addresses
        .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email]')
        // Remove phone numbers (international and common local formats)
        .replace(/(\+?\d[\d\s\-().]{7,}\d)/g, '[phone]');
}

/**
 * Extracts the registrable domain from an email address.
 * e.g. "recruiter@greenhouse.io" → "greenhouse.io"
 */
function senderDomain(email: string): string {
    return email.includes('@') ? email.split('@')[1] : email;
}

// ── AI prompt (batch) ────────────────────────────────────────────────────────

interface BatchEmailInput {
    idx: number;
    sender: string;   // domain only
    subject: string;
    excerpt: string;  // sanitized body, truncated to 600 chars
}

/**
 * Builds a single prompt that classifies ALL emails in one AI call.
 * Each email is represented by idx, sender domain, subject, and a short excerpt.
 */
function buildBatchClassificationPrompt(emails: BatchEmailInput[]): string {
    const today = new Date().toISOString().split('T')[0];
    return `You are an assistant that analyses job application emails. Today's date is ${today}.

Below is a JSON array of emails. Classify every one of them.

${JSON.stringify(emails)}

For EACH email return one object with these fields:
- idx: (same number as input)
- isJobRelated: boolean — true if this email is related to job hunting (application reply, recruiter outreach, job board alert, interview, offer, rejection, assessment, acknowledgement). false for newsletters, news, unrelated marketing.
- suggestedStatus: "Interview" | "Assessment" | "Rejected" | "Offer" | null — use null for acknowledgements, job recommendations without a status change, or if unclear.
- suggestedNote: string — 2-4 sentences summarising key info (interview details, salary, prep tips, deadlines). Empty string if nothing actionable.
- suggestedCalendarEvent: { "title": string, "description": string, "dateTimeISO": string (ISO 8601 full datetime — if only a date given use 09:00:00Z, assume nearest future year if ambiguous), "notificationMinutesBefore": number } | null — ONLY if a specific date/time for an event is mentioned in the excerpt.
- extractedCompany: string
- extractedRole: string
- confidence: "high" | "medium" | "low"
- emailCategory: "application_response" | "job_offer" — "application_response" = the company replies to something the user already applied to; "job_offer" = recruiter/headhunter/job board proactively reaching out with new positions.

Return ONLY a valid JSON object in this exact shape (no markdown, no extra keys):
{ "results": [{ "idx": 0, ... }, { "idx": 1, ... }, ...] }`;
}

interface BatchEmailClassification extends EmailClassification {
    idx: number;
}

// ── Job matching ──────────────────────────────────────────────────────────────

function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

async function matchJobApplication(
    userId: string,
    extractedCompany: string,
    extractedRole: string
): Promise<{ id: string; companyName: string; jobTitle: string } | null> {
    // Fetch all active jobs for the user (exclude soft-deleted)
    const jobs = await JobApplication.find({ userId, deletedAt: { $exists: false } })
        .select('_id companyName jobTitle')
        .lean();

    if (jobs.length === 0) return null;

    const normCompany = normalize(extractedCompany);
    const normRole = normalize(extractedRole);

    // Score each job: company match is worth more than title match
    let best: typeof jobs[0] | null = null;
    let bestScore = 0;

    for (const job of jobs) {
        const jCompany = normalize(job.companyName ?? '');
        const jTitle = normalize(job.jobTitle ?? '');

        let score = 0;
        if (normCompany && jCompany && (jCompany.includes(normCompany) || normCompany.includes(jCompany))) score += 3;
        if (normRole && jTitle && (jTitle.includes(normRole) || normRole.includes(jTitle))) score += 1;

        if (score > bestScore) {
            bestScore = score;
            best = job;
        }
    }

    // Require at least a company name match
    if (bestScore < 3 || !best) return null;

    return { id: String(best._id), companyName: best.companyName, jobTitle: best.jobTitle };
}

// ── Core polling function ─────────────────────────────────────────────────────

/**
 * Polls Gmail for new messages for a single user, classifies them, and stores
 * pending EmailSuggestion documents.  Returns number of suggestions created.
 * @param category - Optional category filter: 'application_response' or 'job_offer'
 */
export async function pollEmailsForUser(userId: string, limit?: number, category?: 'application_response' | 'job_offer'): Promise<number> {
    const tPoll = Date.now();
    const effectiveLimit = limit ?? 50;
    console.log(`\n[EmailSuggestionService] ── pollEmailsForUser START (userId=${userId}, limit=${effectiveLimit}, category=${category ?? 'all'}) ──`);

    // Check Gmail scope is available before attempting any API calls
    const hasSco = await hasGmailScope(userId);
    if (!hasSco) {
        console.log(`[EmailSuggestionService] No Gmail scope for user ${userId}, skipping`);
        return 0;
    }

    const messages = await fetchNewMessages(userId, effectiveLimit);
    console.log(`[EmailSuggestionService] ${messages.length} message(s) fetched from Gmail`);
    if (messages.length === 0) {
        console.log(`[EmailSuggestionService] ── pollEmailsForUser END — 0 suggestions, ${Date.now() - tPoll}ms ──\n`);
        return 0;
    }

    // ── 1. Bulk duplicate check (one DB query for all messages) ──────────────
    const tDup = Date.now();
    const allIds = messages.map((m) => m.id);
    const existingDocs = await EmailSuggestion.find({ userId, gmailMessageId: { $in: allIds } }).select('gmailMessageId').lean();
    const existingIds = new Set(existingDocs.map((d) => d.gmailMessageId));
    const newMessages = messages.filter((m) => !existingIds.has(m.id));
    console.log(`[EmailSuggestionService] Duplicate check: ${Date.now() - tDup}ms — ${existingIds.size} duplicate(s) skipped, ${newMessages.length} new to classify`);

    if (newMessages.length === 0) {
        console.log(`[EmailSuggestionService] ── pollEmailsForUser END — all duplicates, ${Date.now() - tPoll}ms ──\n`);
        return 0;
    }

    // ── 2. Single batch AI classification call ───────────────────────────────
    const aiAvailable = !!process.env.GEMINI_API_KEY;
    let classifications: BatchEmailClassification[] = [];

    if (aiAvailable) {
        const batchInput: BatchEmailInput[] = newMessages.map((m, i) => ({
            idx: i,
            sender: senderDomain(m.senderEmail),
            subject: m.subject,
            excerpt: sanitizeEmailBody(m.body).slice(0, 600),
        }));

        const tAI = Date.now();
        console.log(`[EmailSuggestionService] Sending batch of ${newMessages.length} email(s) to AI...`);
        try {
            const prompt = buildBatchClassificationPrompt(batchInput);
            const raw = await generateStructuredResponse<{ results: BatchEmailClassification[] }>(userId, prompt);
            // Normalise: handle both { results: [...] } and bare arrays defensively
            const arr: BatchEmailClassification[] = Array.isArray(raw)
                ? raw as unknown as BatchEmailClassification[]
                : Array.isArray((raw as any).results)
                    ? (raw as any).results
                    : Object.values(raw as any);
            classifications = arr;
            console.log(`[EmailSuggestionService] Batch AI call: ${Date.now() - tAI}ms — got ${classifications.length} classification(s)`);
        } catch (aiErr: any) {
            const msg = `AI batch classification failed after ${Date.now() - tAI}ms: ${aiErr?.message ?? aiErr}`;
            console.error(`[EmailSuggestionService] ${msg}`);
            throw new Error(msg);
        }
    } else {
        throw new Error('Email scanning requires an AI key (GEMINI_API_KEY) to be configured on the server.');
    }

    // ── 3. Save suggestions ──────────────────────────────────────────────────
    let created = 0;

    for (const cls of classifications) {
        const msg = newMessages[cls.idx];
        if (!msg) {
            console.warn(`[EmailSuggestionService] No message for idx ${cls.idx}, skipping`);
            continue;
        }

        const label = `[${cls.idx + 1}/${newMessages.length}] "${msg.subject.slice(0, 50)}"`;
        console.log(`[EmailSuggestionService] ${label} → isJobRelated=${cls.isJobRelated}, status=${cls.suggestedStatus}, confidence=${cls.confidence}, category=${cls.emailCategory}`);

        if (!cls.isJobRelated) {
            console.log(`[EmailSuggestionService] ${label} not job-related, skipping`);
            continue;
        }
        if (
            cls.confidence === 'low' &&
            !cls.suggestedStatus &&
            !cls.suggestedNote &&
            !cls.suggestedCalendarEvent
        ) {
            console.log(`[EmailSuggestionService] ${label} low confidence + nothing to surface, skipping`);
            continue;
        }
        if (category && cls.emailCategory !== category) {
            console.log(`[EmailSuggestionService] ${label} category mismatch (got ${cls.emailCategory}, want ${category}), skipping`);
            continue;
        }

        const tMatch = Date.now();
        const match = await matchJobApplication(userId, cls.extractedCompany, cls.extractedRole);
        console.log(`[EmailSuggestionService] ${label} job match: ${Date.now() - tMatch}ms — ${match ? `matched "${match.companyName}"` : 'no match'}`);

        await EmailSuggestion.create({
            userId,
            jobApplicationId: match ? match.id : undefined,
            gmailMessageId: msg.id,
            emailSubject: msg.subject,
            emailSnippet: msg.snippet || msg.body.slice(0, 300),
            senderName: msg.senderName,
            senderEmail: msg.senderEmail,
            suggestedStatus: cls.suggestedStatus,
            suggestedNote: cls.suggestedNote || undefined,
            suggestedCalendarEvent: cls.suggestedCalendarEvent || undefined,
            confidence: cls.confidence,
            emailCategory: cls.emailCategory ?? 'application_response',
            matchedCompanyName: match?.companyName ?? cls.extractedCompany,
            matchedJobTitle: match?.jobTitle ?? cls.extractedRole,
            status: 'pending',
        });

        created++;
        console.log(`[EmailSuggestionService] ${label} ✓ suggestion saved (total: ${created})`);
    }

    console.log(`[EmailSuggestionService] ── pollEmailsForUser END — ${created} suggestion(s) created from ${newMessages.length} new message(s) in ${Date.now() - tPoll}ms ──\n`);
    return created;
}

/**
 * Polls all users who have Gmail connected and have the scope.
 * Called by the cron job.
 */
export async function pollAllUsers(): Promise<void> {
    const Profile = (await import('../models/Profile')).default;
    const profiles = await Profile.find({
        'integrations.google.enabled': true,
        'integrations.google.accessToken': { $exists: true, $ne: null },
        $or: [
            { 'settings.emailSuggestions.autoPollApplications': { $exists: false } },
            { 'settings.emailSuggestions.autoPollApplications': true },
            { 'settings.emailSuggestions.autoPollJobLeads': { $exists: false } },
            { 'settings.emailSuggestions.autoPollJobLeads': true },
        ],
    }).select('userId settings.emailSuggestions').lean();

    console.log(`[EmailSuggestionService] Polling ${profiles.length} Google-connected users`);

    for (const profile of profiles) {
        try {
            const settings = profile.settings?.emailSuggestions ?? {};
            const autoPollApplications = settings.autoPollApplications ?? true;
            const autoPollJobLeads = settings.autoPollJobLeads ?? true;

            let totalCreated = 0;

            // Poll for application responses if enabled
            if (autoPollApplications) {
                const count = await pollEmailsForUser(String(profile.userId), undefined, 'application_response');
                if (count > 0) {
                    console.log(`[EmailSuggestionService] Created ${count} application response suggestion(s) for user ${profile.userId}`);
                    totalCreated += count;
                }
            }

            // Poll for job leads if enabled
            if (autoPollJobLeads) {
                const count = await pollEmailsForUser(String(profile.userId), undefined, 'job_offer');
                if (count > 0) {
                    console.log(`[EmailSuggestionService] Created ${count} job lead suggestion(s) for user ${profile.userId}`);
                    totalCreated += count;
                }
            }

            if (totalCreated > 0) {
                console.log(`[EmailSuggestionService] Total: ${totalCreated} suggestion(s) for user ${profile.userId}`);
            }
        } catch (err) {
            console.error(`[EmailSuggestionService] Error polling user ${profile.userId}:`, err);
        }
    }
}
