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

// ── AI prompt ────────────────────────────────────────────────────────────────

function buildClassificationPrompt(subject: string, body: string, sender: string): string {
    const truncatedBody = body.slice(0, 3000);
    const today = new Date().toISOString().split('T')[0];
    return `You are an assistant that analyses job application emails. Today's date is ${today}.

Email Details:
- From (domain only): ${sender}
- Subject: ${subject}
- Body (truncated to 3000 chars, PII redacted):
${truncatedBody}

Task:
1. Determine if this email is related to a job application (e.g. rejection, interview invite, assessment, offer, acknowledgement, recruiter info, job board alert).
2. If job-related, extract:
   - The company name
   - The job title / role (best guess from email context)
   - The appropriate new status from ONLY these values: "Interview", "Assessment", "Rejected", "Offer". Use null if the email is an acknowledgment, job recommendation, or contains info without a real status change.
   - A detailed note (2-4 sentences) summarising ALL key information from the email: interview details, salary/compensation figures, preparation tips, important context, or any actionable advice. Leave empty string if nothing useful.
   - A calendar event if — and only if — the email mentions a specific date and/or time for an interview, assessment, deadline or similar scheduled event. Use null if no concrete datetime is mentioned.
   - Your confidence level: "high" if the intent is very clear, "medium" if reasonably inferred, "low" if uncertain.
   - The email category:
     * "application_response" — the company is replying to a job application the user already submitted (rejection, interview invite, offer, assessment, acknowledgement).
     * "job_offer" — a recruiter, headhunter, or job board (e.g. LinkedIn, XING, Stepstone, Indeed, Glassdoor) is proactively reaching out to suggest or offer the user new positions to apply to.

For suggestedCalendarEvent.dateTimeISO: produce a full ISO 8601 datetime string. If only a date is given (no time), use 09:00:00 UTC on that date. If the year is ambiguous, assume the nearest future occurrence.

Return ONLY valid JSON with this exact structure (no markdown, no extra keys):
{
  "isJobRelated": boolean,
  "suggestedStatus": "Interview" | "Assessment" | "Rejected" | "Offer" | null,
  "suggestedNote": string,
  "suggestedCalendarEvent": { "title": string, "description": string, "dateTimeISO": string, "notificationMinutesBefore": number } | null,
  "extractedCompany": string,
  "extractedRole": string,
  "confidence": "high" | "medium" | "low",
  "emailCategory": "application_response" | "job_offer"
}`;
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
 */
export async function pollEmailsForUser(userId: string, since?: Date): Promise<number> {
    // Check Gmail scope is available before attempting any API calls
    const hasSco = await hasGmailScope(userId);
    if (!hasSco) return 0;

    const lookback = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default: last 7 days
    const messages = await fetchNewMessages(userId, lookback);
    if (messages.length === 0) return 0;

    // Check if user has an AI provider configured (non-fatal if not)
    let aiAvailable = true;
    let inboxProvider: string | undefined;
    try {
        const profile = await Profile.findOne({ userId });
        if (!profile?.aiProviderSettings?.defaultProvider) aiAvailable = false;
        // inboxProvider overrides defaultProvider for email classification only
        inboxProvider = profile?.aiProviderSettings?.inboxProvider;
    } catch {
        aiAvailable = false;
    }

    let created = 0;

    for (const msg of messages) {
        // Skip if we already have a suggestion for this Gmail message ID
        const exists = await EmailSuggestion.exists({ userId, gmailMessageId: msg.id });
        if (exists) continue;

        let classification: EmailClassification = {
            isJobRelated: false,
            suggestedStatus: null,
            suggestedNote: '',
            suggestedCalendarEvent: null,
            extractedCompany: '',
            extractedRole: '',
            confidence: 'low',
            emailCategory: 'application_response',
        };

        if (aiAvailable) {
            try {
                const prompt = buildClassificationPrompt(
                    msg.subject,
                    sanitizeEmailBody(msg.body),
                    senderDomain(msg.senderEmail),
                );
                classification = await generateStructuredResponse<EmailClassification>(userId, prompt, undefined, inboxProvider);
            } catch (aiErr) {
                console.error(`[EmailSuggestionService] AI classification failed for message ${msg.id}:`, aiErr);
                // Fall back to simple keyword heuristic
                classification = fallbackClassify(msg.subject, msg.body, msg.senderEmail);
            }
        } else {
            // No AI: use simple heuristic only
            classification = fallbackClassify(msg.subject, msg.body, msg.senderEmail);
        }

        // Skip if not job-related, or if low confidence and there's genuinely nothing to surface
        if (!classification.isJobRelated) continue;
        if (
            classification.confidence === 'low' &&
            !classification.suggestedStatus &&
            !classification.suggestedNote &&
            !classification.suggestedCalendarEvent
        ) {
            continue;
        }

        const match = await matchJobApplication(userId, classification.extractedCompany, classification.extractedRole);

        await EmailSuggestion.create({
            userId,
            jobApplicationId: match ? match.id : undefined,
            gmailMessageId: msg.id,
            emailSubject: msg.subject,
            emailSnippet: msg.snippet || msg.body.slice(0, 300),
            senderName: msg.senderName,
            senderEmail: msg.senderEmail,
            suggestedStatus: classification.suggestedStatus,
            suggestedNote: classification.suggestedNote || undefined,
            suggestedCalendarEvent: classification.suggestedCalendarEvent || undefined,
            confidence: classification.confidence,
            emailCategory: classification.emailCategory ?? 'application_response',
            matchedCompanyName: match?.companyName ?? classification.extractedCompany,
            matchedJobTitle: match?.jobTitle ?? classification.extractedRole,
            status: 'pending',
        });

        created++;
    }

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
            { 'settings.emailSuggestions.autoPoll': { $exists: false } },
            { 'settings.emailSuggestions.autoPoll': true },
        ],
    }).select('userId').lean();

    console.log(`[EmailSuggestionService] Polling ${profiles.length} Google-connected users`);

    for (const profile of profiles) {
        try {
            const count = await pollEmailsForUser(String(profile.userId));
            if (count > 0) {
                console.log(`[EmailSuggestionService] Created ${count} suggestion(s) for user ${profile.userId}`);
            }
        } catch (err) {
            console.error(`[EmailSuggestionService] Error polling user ${profile.userId}:`, err);
        }
    }
}

// ── Fallback heuristic (no AI) ──────────────────────────────────────────────

function fallbackClassify(subject: string, body: string, senderEmail: string): EmailClassification {
    const text = `${subject} ${body}`.toLowerCase();

    const isJobRelated =
        /\b(application|applied|position|role|opportunity|candidate|hiring|recruiter|interview|offer|assessment|unfortunately|regret|not selected|moving forward)\b/.test(text);

    if (!isJobRelated) {
        return { isJobRelated: false, suggestedStatus: null, suggestedNote: '', suggestedCalendarEvent: null, extractedCompany: '', extractedRole: '', confidence: 'low', emailCategory: 'application_response' };
    }

    let suggestedStatus: JobStatus | null = null;
    if (/\b(rejected|unfortunately|regret|not selected|not moving forward|no longer considering|other candidates)\b/.test(text)) {
        suggestedStatus = 'Rejected';
    } else if (/\b(interview|speak with you|schedule a call|meeting with)\b/.test(text)) {
        suggestedStatus = 'Interview';
    } else if (/\b(assessment|task|test|challenge|coding exercise|take-home)\b/.test(text)) {
        suggestedStatus = 'Assessment';
    } else if (/\b(offer|congratulations|pleased to offer|we would like to offer)\b/.test(text)) {
        suggestedStatus = 'Offer';
    }

    // Heuristic: job boards / recruiters proactively reaching out → job_offer
    const jobOfferDomains = /xing\.com|linkedin\.com|stepstone\.de|indeed\.com|glassdoor\.com|monster\.com|jobware\.de|arbeitsagentur\.de|experteer\.com|instaffo\.com|hays\.de|michael-page\.de|robertwalters\.de/;
    const jobOfferKeywords = /\b(job recommendations?|new opportunities|jobs? that match|recommended jobs?|open positions? for you|we found .* jobs?|new jobs? near you|job alert|jobs? you might like)\b/;
    const isJobOffer = jobOfferDomains.test(senderEmail) || jobOfferKeywords.test(text);

    // Try to extract company from sender domain
    const domain = senderEmail.split('@')[1]?.replace(/\.(com|co\..+|io|net|org|de)$/, '') ?? '';
    const extractedCompany = domain.charAt(0).toUpperCase() + domain.slice(1);

    return {
        isJobRelated: true,
        suggestedStatus,
        suggestedNote: suggestedStatus ? `Email received: ${subject.slice(0, 100)}` : '',
        suggestedCalendarEvent: null,
        extractedCompany,
        extractedRole: '',
        confidence: suggestedStatus ? 'medium' : 'low',
        emailCategory: isJobOffer ? 'job_offer' : 'application_response',
    };
}
