// server/src/routes/workTracker.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import authMiddleware from '../middleware/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors/AppError';
import WorkEntry, { computeHours } from '../models/WorkEntry';
import Employer from '../models/Employer';
import Profile from '../models/Profile';
import { env } from '../config/env';
import { decrypt, encrypt } from '../utils/encryption';
import { GEMINI_FLASH } from '../constants/geminiModels';

const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler);

// ── Multer: schedule import (images + PDFs up to 10 MB) ──────────────────────
const SCHEDULE_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'application/pdf',
]);
const scheduleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    SCHEDULE_MIMES.has(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`Unsupported file type: ${file.mimetype}. Upload an image or PDF.`));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the user's Gemini API key (profile → env fallback). */
async function getGeminiKey(userId: string): Promise<string> {
  const profile = await Profile.findOne({ userId });
  const encryptedKey =
    (profile as any)?.aiProviderSettings?.providers?.gemini?.accessToken ??
    (profile as any)?.integrations?.gemini?.accessToken;
  if (encryptedKey) {
    const key = decrypt(encryptedKey);
    if (key) return key;
  }
  const envKey = process.env.GEMINI_API_KEY;
  if (!envKey) throw new Error('Gemini API key not configured. Please add it in Settings → AI.');
  return envKey;
}

async function getOAuth2Client(userId: string) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials are not configured on the server.');
  }
  const profile = await Profile.findOne({ userId });
  const g = profile?.integrations?.google;
  if (!g?.enabled || !g?.accessToken) {
    throw new Error('Google Calendar is not connected for this account.');
  }
  const accessToken = decrypt(g.accessToken);
  const refreshToken = g.refreshToken ? decrypt(g.refreshToken) : null;
  if (!accessToken) throw new Error('Failed to decrypt Google access token.');

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    try {
      const update: Record<string, unknown> = {};
      if (tokens.access_token) update['integrations.google.accessToken'] = encrypt(tokens.access_token);
      if (tokens.refresh_token) update['integrations.google.refreshToken'] = encrypt(tokens.refresh_token);
      if (Object.keys(update).length) await Profile.updateOne({ userId }, { $set: update });
    } catch { /* Non-fatal */ }
  });

  return oauth2Client;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * GET /api/work-tracker
 * List entries (populated with employer).
 * Query params: ?month=YYYY-MM, ?status=planned|done, ?employerId=<id>
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const filter: Record<string, unknown> = { userId };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.employerId) filter.employerId = req.query.employerId;

  if (req.query.month) {
    const [year, month] = (req.query.month as string).split('-').map(Number);
    if (!isNaN(year) && !isNaN(month)) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      filter.date = { $gte: start, $lt: end };
    }
  }

  const entries = await WorkEntry.find(filter)
    .populate('employerId', 'name logoUrl')
    .sort({ date: 1, startTime: 1 });

  res.json(entries);
}));

/**
 * GET /api/work-tracker/stats
 * Summary stats for the current user.
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [overall, monthly, statusBreakdown, activeEmployers] = await Promise.all([
    WorkEntry.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalHours: { $sum: '$hours' }, totalEntries: { $sum: 1 } } },
    ]),
    WorkEntry.aggregate([
      { $match: { userId, date: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, monthHours: { $sum: '$hours' } } },
    ]),
    WorkEntry.aggregate([
      { $match: { userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    WorkEntry.distinct('employerId', { userId }),
  ]);

  const planned = statusBreakdown.find((s) => s._id === 'planned')?.count ?? 0;
  const done = statusBreakdown.find((s) => s._id === 'done')?.count ?? 0;

  res.json({
    totalHours: overall[0]?.totalHours ?? 0,
    totalEntries: overall[0]?.totalEntries ?? 0,
    monthHours: monthly[0]?.monthHours ?? 0,
    plannedCount: planned,
    doneCount: done,
    activeEmployersCount: activeEmployers.length,
  });
}));

/**
 * POST /api/work-tracker
 * Create a new work entry.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { employerId, title, type, date, startTime, endTime, notes, subLocationId } = req.body;

  if (!employerId) throw new ValidationError('employerId is required.');
  if (!type || !['shift', 'appointment'].includes(type)) throw new ValidationError('type must be "shift" or "appointment".');
  if (!date) throw new ValidationError('date is required.');
  if (!startTime || !endTime) throw new ValidationError('startTime and endTime are required.');

  // Verify employer belongs to this user
  const employer = await Employer.findOne({ _id: employerId, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  // Resolve sub-location name snapshot
  let subLocationName: string | undefined;
  let resolvedSubId: string | undefined;
  if (subLocationId) {
    const sub = employer.subLocations.find((s) => String(s._id) === subLocationId);
    if (!sub) throw new NotFoundError('Sub-location not found.');
    subLocationName = sub.name;
    resolvedSubId = subLocationId;
  }

  const entry = await WorkEntry.create({
    userId,
    employerId,
    title: title?.trim() || undefined,
    type,
    date: new Date(date),
    startTime,
    endTime,
    hours: computeHours(startTime, endTime),
    notes: notes?.trim() || undefined,
    subLocationId: resolvedSubId,
    subLocationName,
  });

  const populated = await entry.populate('employerId', 'name logoUrl subLocations');
  res.status(201).json(populated);
}));

/**
 * PUT /api/work-tracker/:id
 * Update entry fields or toggle status.
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const entry = await WorkEntry.findOne({ _id: req.params.id, userId });
  if (!entry) throw new NotFoundError('Work entry not found.');

  const { employerId, title, type, date, startTime, endTime, notes, status, subLocationId } = req.body;

  if (employerId !== undefined) {
    const employer = await Employer.findOne({ _id: employerId, userId });
    if (!employer) throw new NotFoundError('Employer not found.');
    entry.employerId = new mongoose.Types.ObjectId(employerId);

    // Re-resolve sub-location against the new (or same) employer
    if (subLocationId !== undefined) {
      if (subLocationId === null || subLocationId === '') {
        (entry as any).subLocationId = undefined;
        (entry as any).subLocationName = undefined;
      } else {
        const sub = employer.subLocations.find((s) => String(s._id) === subLocationId);
        if (!sub) throw new NotFoundError('Sub-location not found.');
        (entry as any).subLocationId = subLocationId;
        (entry as any).subLocationName = sub.name;
      }
    }
  } else if (subLocationId !== undefined) {
    // Employer unchanged – still need to validate sub-location
    const employer = await Employer.findOne({ _id: entry.employerId, userId });
    if (!employer) throw new NotFoundError('Employer not found.');
    if (subLocationId === null || subLocationId === '') {
      (entry as any).subLocationId = undefined;
      (entry as any).subLocationName = undefined;
    } else {
      const sub = employer.subLocations.find((s) => String(s._id) === subLocationId);
      if (!sub) throw new NotFoundError('Sub-location not found.');
      (entry as any).subLocationId = subLocationId;
      (entry as any).subLocationName = sub.name;
    }
  }
  if (title !== undefined) entry.title = title?.trim() || undefined;
  if (type !== undefined) {
    if (!['shift', 'appointment'].includes(type)) throw new ValidationError('type must be "shift" or "appointment".');
    entry.type = type;
  }
  if (date !== undefined) entry.date = new Date(date);
  if (startTime !== undefined) entry.startTime = startTime;
  if (endTime !== undefined) entry.endTime = endTime;
  if (notes !== undefined) entry.notes = notes?.trim() || undefined;
  if (status !== undefined) {
    if (!['planned', 'done'].includes(status)) throw new ValidationError('status must be "planned" or "done".');
    entry.status = status;
  }

  // Recompute hours if times changed
  if (startTime !== undefined || endTime !== undefined) {
    entry.hours = computeHours(entry.startTime, entry.endTime);
  }

  await entry.save();
  const populated = await entry.populate('employerId', 'name logoUrl subLocations');
  res.json(populated);
}));

/**
 * DELETE /api/work-tracker/:id
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const entry = await WorkEntry.findOne({ _id: req.params.id, userId });
  if (!entry) throw new NotFoundError('Work entry not found.');

  // Remove Google Calendar event if was created
  if (entry.googleCalendarEventId) {
    try {
      const auth = await getOAuth2Client(userId);
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({ calendarId: 'primary', eventId: entry.googleCalendarEventId });
    } catch { /* Non-fatal */ }
  }

  await entry.deleteOne();
  res.json({ message: 'Entry deleted.' });
}));

/**
 * POST /api/work-tracker/:id/remind
 * Creates a Google Calendar event for the entry with a 1-day popup reminder.
 */
router.post('/:id/remind', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const entry = await WorkEntry.findOne({ _id: req.params.id, userId }).populate<{
    employerId: { name: string; logoUrl?: string };
  }>('employerId', 'name logoUrl');

  if (!entry) throw new NotFoundError('Work entry not found.');
  if (entry.reminderCreated && entry.googleCalendarEventId) {
    return res.json({ message: 'Reminder already created.', eventId: entry.googleCalendarEventId });
  }

  const auth = await getOAuth2Client(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const employerName = (entry.employerId as unknown as { name: string }).name;
  const entryTitle = entry.title ? `${employerName} — ${entry.title}` : employerName;

  // Build start/end DateTimes from date + startTime + endTime
  const dateStr = entry.date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const startDateTime = new Date(`${dateStr}T${entry.startTime}:00`);
  const endDateTime = new Date(`${dateStr}T${entry.endTime}:00`);
  if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1); // overnight

  const event = {
    summary: entryTitle,
    description: [
      `Type: ${entry.type === 'shift' ? 'Work Shift' : 'Appointment'}`,
      `Hours: ${entry.hours}h (${entry.startTime} – ${entry.endTime})`,
      entry.notes ? `Notes: ${entry.notes}` : '',
      '',
      'Added via VibeHired Time Tracker',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: startDateTime.toISOString(), timeZone: 'UTC' },
    end: { dateTime: endDateTime.toISOString(), timeZone: 'UTC' },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 1440 }], // 24h before
    },
  };

  const response = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
  const eventId = response.data.id;
  if (!eventId) throw new Error('Google Calendar did not return an event ID.');

  entry.googleCalendarEventId = eventId;
  entry.reminderCreated = true;
  await entry.save();

  res.json({ message: 'Reminder created.', eventId });
}));

/**
 * DELETE /api/work-tracker/:id/remind
 * Deletes the associated Google Calendar event and clears reminder status.
 */
router.delete('/:id/remind', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const entry = await WorkEntry.findOne({ _id: req.params.id, userId });
  if (!entry) throw new NotFoundError('Work entry not found.');

  if (entry.googleCalendarEventId) {
    try {
      const auth = await getOAuth2Client(userId);
      const calendar = google.calendar({ version: 'v3', auth });
      await calendar.events.delete({ calendarId: 'primary', eventId: entry.googleCalendarEventId });
    } catch { /* Ignore if already deleted in calendar */ }
    entry.googleCalendarEventId = undefined;
    entry.reminderCreated = false;
    await entry.save();
  }

  res.json({ message: 'Reminder removed.' });
}));

// ── AI Schedule Import ────────────────────────────────────────────────────────

/**
 * POST /api/work-tracker/import-schedule/parse
 * Accepts a file (image / PDF) or raw text; returns extracted entry candidates.
 */
router.post(
  '/import-schedule/parse',
  scheduleUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const { text, defaultStartTime = '09:00', defaultEndTime = '17:00' } = req.body;

    if (!req.file && !String(text ?? '').trim()) {
      throw new ValidationError('Provide a file (image or PDF) or paste schedule text.');
    }

    const apiKey = await getGeminiKey(userId);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt =
      `You are a work-schedule parser. Extract every individual work shift or appointment.\n` +
      `Return ONLY a valid JSON array — no markdown, no explanation.\n` +
      `Each element must have:\n` +
      `  "date": "YYYY-MM-DD"\n` +
      `  "startTime": "HH:MM" 24h (use "${defaultStartTime}" when not shown)\n` +
      `  "endTime": "HH:MM" 24h (use "${defaultEndTime}" when not shown)\n` +
      `  "notes": brief context string or null\n` +
      `Today is ${today}. Infer the year when only month/day is given (nearest future).\n` +
      `Example: [{"date":"2026-03-01","startTime":"09:00","endTime":"17:00","notes":null}]`;

    let responseText: string;

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const { text: pdfText } = await pdfParse(req.file.buffer);
        const result = await model.generateContent(`${systemPrompt}\n\nSchedule text:\n${pdfText}`);
        responseText = result.response.text();
      } else {
        // Image — pass inline base64
        const imagePart = {
          inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype },
        };
        const result = await model.generateContent([
          systemPrompt + '\n\nThe schedule is in the attached image.',
          imagePart,
        ]);
        responseText = result.response.text();
      }
    } else {
      const result = await model.generateContent(`${systemPrompt}\n\nSchedule text:\n${text}`);
      responseText = result.response.text();
    }

    // Strip markdown fences and parse JSON array
    let raw: any[];
    try {
      const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1) throw new Error('No JSON array in AI response.');
      raw = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e: any) {
      throw new ValidationError(`AI could not parse the schedule into entries. ${e.message}`);
    }

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_RE = /^\d{2}:\d{2}$/;
    const entries = (Array.isArray(raw) ? raw : [])
      .filter((e: any) => e && DATE_RE.test(e.date))
      .map((e: any) => ({
        date: e.date as string,
        startTime: TIME_RE.test(e.startTime) ? e.startTime : defaultStartTime,
        endTime: TIME_RE.test(e.endTime) ? e.endTime : defaultEndTime,
        notes: typeof e.notes === 'string' && e.notes ? e.notes : null,
      }));

    res.json({ entries, count: entries.length });
  }),
);

/**
 * POST /api/work-tracker/import-schedule/confirm
 * Bulk-creates confirmed work entries from the parsed schedule.
 */
router.post('/import-schedule/confirm', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { entries, employerId } = req.body;

  if (!employerId) throw new ValidationError('employerId is required.');
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ValidationError('entries array must not be empty.');
  }

  const employer = await Employer.findOne({ _id: employerId, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  const today = new Date().toISOString().split('T')[0];

  const created = await Promise.all(
    entries.map(async (e: any) => {
      const status: 'planned' | 'done' = e.date <= today ? 'done' : 'planned';

      let subLocationName: string | undefined;
      let resolvedSubId: string | undefined;
      if (e.subLocationId) {
        const sub = employer.subLocations.find((s: any) => String(s._id) === e.subLocationId);
        if (sub) { subLocationName = sub.name; resolvedSubId = e.subLocationId; }
      }

      const doc = await WorkEntry.create({
        userId,
        employerId,
        subLocationId: resolvedSubId,
        subLocationName,
        title: e.title || undefined,
        type: e.type || 'shift',
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        notes: e.notes || undefined,
        status,
      });
      return doc._id;
    }),
  );

  res.status(201).json({ message: `${created.length} entr${created.length === 1 ? 'y' : 'ies'} added.`, count: created.length, ids: created });
}));

export default router;
