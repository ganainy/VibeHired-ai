import mongoose from 'mongoose';
import JobApplication, { IJobApplication } from '../models/JobApplication';
import { generateStructuredResponse } from '../utils/aiService';
import Profile from '../models/Profile';
import CV from '../models/CV';
import User from '../models/User';

const NO_RESPONSE_DAYS = 14;
const SNOOZE_DAYS = 7;

type FollowUpStatus = 'none' | 'suggested' | 'snoozed' | 'dismissed' | 'sent';

interface FollowUpDraftResponse {
  subject: string;
  body: string;
}

export interface FollowUpSuggestionPayload {
  jobId: string;
  companyName?: string;
  jobTitle?: string;
  status: FollowUpStatus;
  isDue: boolean;
  daysWithoutResponse: number;
  dueDateISO: string;
  recipientEmail?: string;
  suggestedAt?: string;
  snoozedUntil?: string;
  draftSubject?: string;
  draftBody?: string;
  draftGeneratedAt?: string;
}

function extractRecipientEmail(job: IJobApplication): string | undefined {
  const direct = job.contactEmail?.trim();
  if (direct) return direct;

  const legacy = job.contact?.trim();
  if (!legacy) return undefined;

  const match = legacy.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0];
}

function formatElapsedTime(daysWithoutResponse: number): string {
  if (daysWithoutResponse < 30) {
    return `${daysWithoutResponse} day${daysWithoutResponse === 1 ? '' : 's'}`;
  }

  const months = Math.max(1, Math.round(daysWithoutResponse / 30));
  return `${daysWithoutResponse} days (about ${months} month${months === 1 ? '' : 's'})`;
}

async function getSenderNameForUser(userId: string): Promise<string | undefined> {
  const profile = await Profile.findOne({ userId: new mongoose.Types.ObjectId(userId) }).select('name').lean();
  const profileName = typeof profile?.name === 'string' ? profile.name.trim() : '';
  if (profileName) return profileName;

  const primaryCv = await CV.findOne({ userId: new mongoose.Types.ObjectId(userId), isDefault: true }).select('cvJson').lean();
  const cvName =
    typeof (primaryCv as any)?.cvJson?.basics?.name === 'string'
      ? String((primaryCv as any).cvJson.basics.name).trim()
      : '';
  if (cvName) return cvName;

  const user = await User.findById(userId).select('username').lean();
  const username = typeof user?.username === 'string' ? user.username.trim() : '';
  if (username) return username;

  return undefined;
}

function getReferenceDate(job: IJobApplication): Date {
  if (job.dateApplied) {
    return new Date(job.dateApplied);
  }
  return new Date(job.createdAt);
}

function getDueDate(job: IJobApplication): Date {
  const reference = getReferenceDate(job);
  const due = new Date(reference);
  due.setDate(due.getDate() + NO_RESPONSE_DAYS);
  return due;
}

function addDays(baseDate: Date, days: number): Date {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function getDaysWithoutResponse(job: IJobApplication, now: Date): number {
  const reference = getReferenceDate(job);
  const millis = now.getTime() - reference.getTime();
  return Math.max(0, Math.floor(millis / (1000 * 60 * 60 * 24)));
}

export function isJobDueForFollowUp(job: IJobApplication, now: Date = new Date()): boolean {
  if (job.status !== 'Applied') return false;
  if (job.lastResponseAt) return false;

  const followUp = job.followUpSuggestion;
  if (followUp?.status === 'dismissed' || followUp?.status === 'sent') return false;

  if (followUp?.status === 'snoozed' && followUp.snoozedUntil) {
    const snoozedUntil = new Date(followUp.snoozedUntil);
    if (snoozedUntil > now) return false;
  }

  return now >= getDueDate(job);
}

function toPayload(job: IJobApplication, now: Date = new Date()): FollowUpSuggestionPayload {
  const followUp = job.followUpSuggestion;
  const dueDate = getDueDate(job);
  const isDue = isJobDueForFollowUp(job, now);

  return {
    jobId: String(job._id),
    companyName: job.companyName,
    jobTitle: job.jobTitle,
    status: followUp?.status ?? 'none',
    isDue,
    daysWithoutResponse: getDaysWithoutResponse(job, now),
    dueDateISO: dueDate.toISOString(),
    recipientEmail: extractRecipientEmail(job),
    suggestedAt: followUp?.suggestedAt?.toISOString(),
    snoozedUntil: followUp?.snoozedUntil?.toISOString(),
    draftSubject: followUp?.draftSubject,
    draftBody: followUp?.draftBody,
    draftGeneratedAt: followUp?.draftGeneratedAt?.toISOString(),
  };
}

export async function refreshFollowUpState(job: IJobApplication, now: Date = new Date()): Promise<IJobApplication> {
  const followUp = job.followUpSuggestion;

  // If user got a response or moved out of Applied, clear pending/snoozed/suggested reminder state.
  if (job.status !== 'Applied' || job.lastResponseAt) {
    if (followUp && (followUp.status === 'suggested' || followUp.status === 'snoozed')) {
      job.followUpSuggestion = {
        ...followUp,
        status: 'none',
      } as any;
      await job.save();
    }
    return job;
  }

  if (!isJobDueForFollowUp(job, now)) {
    return job;
  }

  if (!followUp || followUp.status === 'none' || followUp.status === 'snoozed') {
    const isExpiredSnooze = followUp?.status === 'snoozed' && followUp.snoozedUntil && new Date(followUp.snoozedUntil) <= now;
    if (!followUp || followUp.status === 'none' || isExpiredSnooze) {
      job.followUpSuggestion = {
        ...followUp,
        status: 'suggested',
        suggestedAt: followUp?.suggestedAt ?? now,
      } as any;
      await job.save();
    }
  }

  return job;
}

export async function getFollowUpSuggestionForJob(userId: string, jobId: string): Promise<FollowUpSuggestionPayload | null> {
  const job = await JobApplication.findOne({ _id: jobId, userId });
  if (!job) {
    return null;
  }

  const refreshed = await refreshFollowUpState(job);
  return toPayload(refreshed);
}

export async function snoozeFollowUpOneWeek(userId: string, jobId: string): Promise<FollowUpSuggestionPayload | null> {
  const job = await JobApplication.findOne({ _id: jobId, userId });
  if (!job) return null;

  const now = new Date();
  const snoozedUntil = addDays(now, SNOOZE_DAYS);

  job.followUpSuggestion = {
    ...(job.followUpSuggestion ?? { status: 'none' }),
    status: 'snoozed',
    snoozedUntil,
  } as any;
  await job.save();

  return toPayload(job, now);
}

export async function dismissFollowUpSuggestion(userId: string, jobId: string): Promise<FollowUpSuggestionPayload | null> {
  const job = await JobApplication.findOne({ _id: jobId, userId });
  if (!job) return null;

  const now = new Date();
  job.followUpSuggestion = {
    ...(job.followUpSuggestion ?? { status: 'none' }),
    status: 'dismissed',
    dismissedAt: now,
  } as any;
  await job.save();

  return toPayload(job, now);
}

export async function markFollowUpSent(userId: string, jobId: string): Promise<FollowUpSuggestionPayload | null> {
  const job = await JobApplication.findOne({ _id: jobId, userId });
  if (!job) return null;

  const now = new Date();
  job.followUpSuggestion = {
    ...(job.followUpSuggestion ?? { status: 'none' }),
    status: 'sent',
    sentAt: now,
  } as any;
  await job.save();

  return toPayload(job, now);
}

function buildFollowUpPrompt(job: IJobApplication, senderName?: string): string {
  const contactName = job.hiringManagerName?.trim() || 'Hiring Team';
  const company = job.companyName;
  const role = job.jobTitle;
  const appliedDate = getReferenceDate(job).toISOString().split('T')[0];
  const daysWithoutResponse = getDaysWithoutResponse(job, new Date());
  const elapsedTime = formatElapsedTime(daysWithoutResponse);
  const recipientEmail = extractRecipientEmail(job) || 'N/A';
  const notes = (job.notes || '').slice(0, 1000);
  const signatureInstruction = senderName
    ? `- End with "Best regards," and then sign with exactly this sender name: ${senderName}.`
    : '- End with "Best regards," but do not add a made-up personal name.';

  const language = job.language?.trim() || 'en';
  const languageInstruction = language !== 'en'
    ? `- Write the email in ${language} language (the language of the job posting).`
    : '';

  return `You are writing a concise professional follow-up email for a job application.

Context:
- Company: ${company}
- Role: ${role}
- Contact: ${contactName}
- Recipient email: ${recipientEmail}
- Application date: ${appliedDate}
- Time since application: ${elapsedTime}
- Candidate notes (optional): ${notes || 'N/A'}
- Job language: ${language}

Requirements:
- Keep tone warm, confident, and professional.
- Mention the elapsed time naturally using the context above. Do not say "two weeks" unless it is actually around 14 days.
- Express continued interest and ask for a brief update.
- Keep body under 170 words.
- Avoid placeholders like [Your Name].
- Do not invent names (sender or recipient).
${signatureInstruction}
${languageInstruction}
- Return JSON only.

Return this exact JSON shape:
{
  "subject": "string",
  "body": "string"
}`;
}

export async function generateFollowUpDraft(userId: string, jobId: string): Promise<FollowUpSuggestionPayload | null> {
  const job = await JobApplication.findOne({ _id: jobId, userId });
  if (!job) return null;

  await refreshFollowUpState(job);
  const updatedJob = await JobApplication.findById(jobId);
  if (!updatedJob) return null;

  const senderName = await getSenderNameForUser(userId);
  const prompt = buildFollowUpPrompt(updatedJob, senderName);
  const generated = await generateStructuredResponse<FollowUpDraftResponse>(userId, prompt);

  const now = new Date();
  updatedJob.followUpSuggestion = {
    ...(updatedJob.followUpSuggestion ?? { status: 'suggested' }),
    status: 'suggested',
    suggestedAt: updatedJob.followUpSuggestion?.suggestedAt ?? now,
    draftSubject: String((generated as any).subject || '').trim(),
    draftBody: String((generated as any).body || '').trim(),
    draftGeneratedAt: now,
  } as any;

  await updatedJob.save();
  return toPayload(updatedJob, now);
}

export async function runFollowUpSuggestionSweep(): Promise<{ checked: number; suggested: number }> {
  const now = new Date();

  const jobs = await JobApplication.find({
    status: 'Applied',
    showInDashboard: true,
    deletedAt: { $exists: false },
  });

  let suggested = 0;

  for (const job of jobs) {
    const before = job.followUpSuggestion?.status ?? 'none';
    const refreshed = await refreshFollowUpState(job, now);
    const after = refreshed.followUpSuggestion?.status ?? 'none';
    if (before !== 'suggested' && after === 'suggested') {
      suggested += 1;
    }
  }

  return {
    checked: jobs.length,
    suggested,
  };
}

export async function getPendingFollowUpSuggestionsForUser(userId: string): Promise<FollowUpSuggestionPayload[]> {
  const jobs = await JobApplication.find({
    userId: new mongoose.Types.ObjectId(userId),
    showInDashboard: true,
    status: 'Applied',
    deletedAt: { $exists: false },
  });

  const results: FollowUpSuggestionPayload[] = [];

  for (const job of jobs) {
    const refreshed = await refreshFollowUpState(job);
    const payload = toPayload(refreshed);
    if (payload.status === 'suggested' && payload.isDue) {
      results.push(payload);
    }
  }

  return results;
}
