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
function buildDetailedClassificationPrompt(emails: BatchEmailInput[]): string {
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

// ── Pass 1: lightweight title screening ──────────────────────────────────────

interface BatchTitleInput {
    idx: number;
    sender: string;  // domain only
    subject: string;
}

interface TitleScreeningResult {
    idx: number;
    isJobRelated: boolean;
    confidence: 'high' | 'medium' | 'low';
    /** Preliminary category — enough to pre-filter before Pass 2 */
    emailCategory: 'application_response' | 'job_offer' | null;
}

/**
 * Builds a lightweight screening prompt — subjects + sender domains only.
 * The AI returns only { idx, isJobRelated, emailCategory, confidence } per email,
 * keeping the token footprint small and the response fast.
 * When a categoryFilter is provided the prompt instructs the model to pre-classify
 * category so Pass 2 only runs on emails that actually match the desired type.
 */
function buildTitleScreeningPrompt(
    emails: BatchTitleInput[],
    categoryFilter?: 'application_response' | 'job_offer'
): string {
    const categoryHint = categoryFilter
        ? `\nIMPORTANT: The user ONLY wants to see "${categoryFilter === 'application_response' ? 'application_response' : 'job_offer'}" emails.
- "application_response" = a company or recruiter replying to something the user already applied to (acknowledgement, interview invite, rejection, offer).
- "job_offer" = recruiter or job board proactively suggesting new positions the user has NOT applied to yet.
Set isJobRelated=false for emails that are clearly the wrong category — they will be skipped entirely.`
        : '';

    return `You are filtering emails for a job-hunting application. Today's date is ${new Date().toISOString().split('T')[0]}.

Below is a JSON array of emails (sender domain + subject only).

${JSON.stringify(emails)}

For EACH email decide:
1. isJobRelated — true if this email relates to job hunting (applications, interviews, assessments, offers, rejections, recruiter outreach, job board alerts). false for newsletters, order confirmations, surveys, banking, social, or clearly unrelated content.
2. emailCategory — "application_response" if the company/recruiter is responding to something the user already applied to; "job_offer" if a recruiter or job board is proactively suggesting new positions. null if not job-related.
3. confidence — "high" | "medium" | "low".
${categoryHint}
IMPORTANT: When in doubt about isJobRelated, set isJobRelated=true. It is safer to include a borderline email than to miss a real one.

Return ONLY a valid JSON object (no markdown, no extra keys):
{ "results": [{ "idx": 0, "isJobRelated": true, "emailCategory": "application_response", "confidence": "high" }, ...] }`;
}

interface BatchEmailClassification extends EmailClassification {
    idx: number;
}

// ── Job matching ──────────────────────────────────────────────────────────────

function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

type JobMatch = { id: string; companyName: string; jobTitle: string };

function matchJobApplication(
    jobs: Array<{ _id: any; companyName?: string; jobTitle?: string }>,
    extractedCompany: string | null,
    extractedRole: string | null
): JobMatch | null {
    if (jobs.length === 0) return null;

    const normCompany = normalize(extractedCompany ?? '');
    const normRole = normalize(extractedRole ?? '');

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

    return { id: String(best._id), companyName: best.companyName ?? '', jobTitle: best.jobTitle ?? '' };
}

// ── Core polling function ─────────────────────────────────────────────────────

export interface PollResult {
    /** Total suggestions created in this run */
    created: number;
    /** Total emails retrieved from Gmail (before dedup) */
    scanned: number;
    /** Suggestions created with emailCategory = 'application_response' */
    applicationResponses: number;
    /** Suggestions created with emailCategory = 'job_offer' */
    jobLeads: number;
}

const ZERO_RESULT: PollResult = { created: 0, scanned: 0, applicationResponses: 0, jobLeads: 0 };

/**
 * Polls Gmail for new messages for a single user, classifies them, and stores
 * pending EmailSuggestion documents.  Returns a PollResult breakdown.
 * @param category - Optional category filter: 'application_response' or 'job_offer'
 * @param includeReadEmails - Whether to include already-read emails in the scan
 */
export async function pollEmailsForUser(userId: string, limit?: number, category?: 'application_response' | 'job_offer', includeReadEmails = false): Promise<PollResult> {
    const tPoll = Date.now();
    const effectiveLimit = limit ?? 50;
    console.log(`\n[EmailSuggestionService] ── pollEmailsForUser START (userId=${userId}, limit=${effectiveLimit}, category=${category ?? 'all'}, includeReadEmails=${includeReadEmails}) ──`);

    // Check Gmail scope is available before attempting any API calls
    const hasSco = await hasGmailScope(userId);
    if (!hasSco) {
        console.log(`[EmailSuggestionService] No Gmail scope for user ${userId}, skipping`);
        return ZERO_RESULT;
    }

    const messages = await fetchNewMessages(userId, effectiveLimit, includeReadEmails);
    const scanned = messages.length;
    console.log(`[EmailSuggestionService] ${scanned} message(s) fetched from Gmail`);
    if (scanned === 0) {
        console.log(`[EmailSuggestionService] ── pollEmailsForUser END — 0 suggestions, ${Date.now() - tPoll}ms ──\n`);
        return ZERO_RESULT;
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
        return { ...ZERO_RESULT, scanned };
    }

    // ── 1.5. Fetch user's jobs once (cached for all match operations) ────────
    const tJobs = Date.now();
    const userJobs = await JobApplication.find({ userId, deletedAt: { $exists: false } })
        .select('_id companyName jobTitle')
        .lean();
    console.log(`[EmailSuggestionService] Fetched ${userJobs.length} job(s) in ${Date.now() - tJobs}ms`);

    // ── 2. Two-pass AI classification ────────────────────────────────────────
    //   Pass 1 — title screening (subjects + sender domains only, very fast)
    //   Pass 2 — detailed analysis of job-related emails only (smaller batch)
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('Email scanning requires an AI key (GEMINI_API_KEY) to be configured on the server.');
    }

    let classifications: BatchEmailClassification[] = [];

    // ── Pass 1: screen subjects ──────────────────────────────────────────────
    const titleInputs: BatchTitleInput[] = newMessages.map((m, i) => ({
        idx: i,
        sender: senderDomain(m.senderEmail),
        subject: m.subject,
    }));

    const tPass1 = Date.now();
    console.log(`[EmailSuggestionService] Pass 1: screening ${newMessages.length} subject(s)${category ? ` (filter: ${category})` : ''}...`);
    let jobRelatedIdxs: Set<number>;
    try {
        const screeningPrompt = buildTitleScreeningPrompt(titleInputs, category);
        const screeningRaw = await generateStructuredResponse<{ results: TitleScreeningResult[] }>(userId, screeningPrompt);
        const screeningArr: TitleScreeningResult[] = Array.isArray(screeningRaw)
            ? screeningRaw as unknown as TitleScreeningResult[]
            : Array.isArray((screeningRaw as any).results)
                ? (screeningRaw as any).results
                : Object.values(screeningRaw as any);
        // Keep emails that are job-related (or borderline confidence) AND match the category filter
        jobRelatedIdxs = new Set(
            screeningArr
                .filter((r) => {
                    if (!r.isJobRelated && r.confidence === 'high') return false; // definitely not job-related
                    if (category && r.emailCategory && r.emailCategory !== category && r.confidence === 'high') return false; // wrong category, AI is certain
                    return true;
                })
                .map((r) => r.idx)
        );
        const skippedByCategory = screeningArr.filter((r) => category && r.emailCategory && r.emailCategory !== category && r.confidence === 'high').length;
        console.log(`[EmailSuggestionService] Pass 1: ${Date.now() - tPass1}ms — ${jobRelatedIdxs.size}/${newMessages.length} flagged for detailed analysis (${skippedByCategory} skipped by category)`);
    } catch (err: any) {
        const msg = `Pass 1 (title screening) failed after ${Date.now() - tPass1}ms: ${err?.message ?? err}`;
        console.error(`[EmailSuggestionService] ${msg}`);
        throw new Error(msg);
    }

    if (jobRelatedIdxs.size === 0) {
        console.log(`[EmailSuggestionService] ── pollEmailsForUser END — no job-related emails found, ${Date.now() - tPoll}ms ──\n`);
        return { ...ZERO_RESULT, scanned };
    }

    // ── Pass 2: detailed classification of flagged emails only ───────────────
    const detailInputs: BatchEmailInput[] = [];
    for (let i = 0; i < newMessages.length; i++) {
        if (jobRelatedIdxs.has(i)) {
            detailInputs.push({
                idx: i,  // original index preserved so newMessages[cls.idx] lookup works
                sender: senderDomain(newMessages[i].senderEmail),
                subject: newMessages[i].subject,
                excerpt: sanitizeEmailBody(newMessages[i].body).slice(0, 600),
            });
        }
    }

    const tPass2 = Date.now();
    console.log(`[EmailSuggestionService] Pass 2: full analysis of ${detailInputs.length} email(s)...`);
    try {
        const detailPrompt = buildDetailedClassificationPrompt(detailInputs);
        const detailRaw = await generateStructuredResponse<{ results: BatchEmailClassification[] }>(userId, detailPrompt);
        // Normalise: handle both { results: [...] } and bare arrays defensively
        const arr: BatchEmailClassification[] = Array.isArray(detailRaw)
            ? detailRaw as unknown as BatchEmailClassification[]
            : Array.isArray((detailRaw as any).results)
                ? (detailRaw as any).results
                : Object.values(detailRaw as any);
        classifications = arr;
        console.log(`[EmailSuggestionService] Pass 2: ${Date.now() - tPass2}ms — got ${classifications.length} classification(s)`);
    } catch (err: any) {
        const msg = `Pass 2 (detailed classification) failed after ${Date.now() - tPass2}ms: ${err?.message ?? err}`;
        console.error(`[EmailSuggestionService] ${msg}`);
        throw new Error(msg);
    }

    // ── 3. Save suggestions ──────────────────────────────────────────────────
    let created = 0;
    let applicationResponses = 0;
    let jobLeads = 0;

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
        const match = matchJobApplication(userJobs, cls.extractedCompany, cls.extractedRole);
        console.log(`[EmailSuggestionService] ${label} job match: ${Date.now() - tMatch}ms — ${match ? `matched "${match.companyName}"` : 'no match'}`);

        // If this looks like a response to an existing application, record the latest response time.
        if (match && (cls.emailCategory ?? 'application_response') === 'application_response') {
            await JobApplication.updateOne(
                { _id: match.id, userId },
                { $set: { lastResponseAt: new Date() } }
            );
        }

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
        if ((cls.emailCategory ?? 'application_response') === 'job_offer') jobLeads++;
        else applicationResponses++;
        console.log(`[EmailSuggestionService] ${label} ✓ suggestion saved (total: ${created})`);
    }

    console.log(`[EmailSuggestionService] ── pollEmailsForUser END — ${created} suggestion(s) created (${applicationResponses} app responses, ${jobLeads} job leads) from ${newMessages.length} new message(s) in ${Date.now() - tPoll}ms ──\n`);
    return { created, scanned, applicationResponses, jobLeads };
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
                const r = await pollEmailsForUser(String(profile.userId), undefined, 'application_response');
                if (r.created > 0) {
                    console.log(`[EmailSuggestionService] Created ${r.created} application response suggestion(s) for user ${profile.userId}`);
                    totalCreated += r.created;
                }
            }

            // Poll for job leads if enabled
            if (autoPollJobLeads) {
                const r = await pollEmailsForUser(String(profile.userId), undefined, 'job_offer');
                if (r.created > 0) {
                    console.log(`[EmailSuggestionService] Created ${r.created} job lead suggestion(s) for user ${profile.userId}`);
                    totalCreated += r.created;
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
