// server/src/services/reminderParserService.ts
import { generateStructuredResponse } from '../utils/aiService';
import { z } from 'zod';

/** Shape the AI must return */
export interface ParsedReminder {
    title: string;
    description: string;
    dateTimeISO: string;
    notificationMinutesBefore: number;
}

const ParsedReminderSchema = z.object({
    title: z.string().min(1),
    description: z.string(),
    dateTimeISO: z.string().refine((v) => !isNaN(Date.parse(v)), {
        message: 'dateTimeISO must be a valid ISO 8601 date string',
    }),
    notificationMinutesBefore: z.number().int().min(0).max(10080).default(30),
});

/**
 * Uses the user's configured AI model to convert a natural language reminder
 * (e.g. "send follow-up email if no answer in one week") into a structured
 * Google Calendar event object.
 *
 * @param userId            Authenticated user id — used to resolve the AI model adapter.
 * @param naturalText       Raw reminder text the user typed.
 * @param jobContext        Basic job info to give the AI better context.
 * @param nowISO            Current ISO timestamp (injected so we can mock it in tests).
 */
export async function parseReminder(
    userId: string,
    naturalText: string,
    jobContext: { jobTitle: string; companyName: string },
    nowISO: string = new Date().toISOString()
): Promise<ParsedReminder> {
    const prompt = `You are a calendar assistant. A user is tracking a job application and wants to schedule a reminder.

Current date and time (ISO 8601): ${nowISO}

Job context:
- Job Title: ${jobContext.jobTitle}
- Company: ${jobContext.companyName}

User's reminder request:
"${naturalText}"

Your task: Interpret the user's natural language reminder and return a structured calendar event JSON.

Rules:
1. Calculate the exact date/time in ISO 8601 format based on "now" (${nowISO}) and the user's intent (e.g. "in one week" = now + 7 days).
2. If no time of day is specified, default to 09:00:00 in the UTC+0 timezone.
3. "title" should be a short, clear event title (max ~60 chars), written as an action (e.g. "Follow up with Acme Corp").
4. "description" should be a 1-2 sentence human-readable explanation of what to do.
5. "notificationMinutesBefore" is how many minutes before the event to send a notification — default 30.
6. Respond ONLY with a valid JSON object — no markdown, no explanation text.

Required JSON schema:
{
  "title": "string",
  "description": "string",
  "dateTimeISO": "ISO 8601 string (e.g. 2026-03-04T09:00:00.000Z)",
  "notificationMinutesBefore": number
}`;

    const raw = await generateStructuredResponse<unknown>(userId, prompt);

    // Validate the AI output with Zod
    const parsed = ParsedReminderSchema.safeParse(raw);
    if (!parsed.success) {
        console.error('reminderParserService: AI returned invalid JSON', raw, parsed.error);
        throw new Error(`AI returned an invalid reminder structure: ${parsed.error.message}`);
    }

    return parsed.data as ParsedReminder;
}
