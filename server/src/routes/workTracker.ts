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
import AppointmentType from '../models/AppointmentType';
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
    .populate('appointmentTypeId', 'name')
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
      { $group: { _id: null, totalHours: { $sum: { $cond: [{ $eq: ['$type', 'shift'] }, '$hours', 0] } }, totalEntries: { $sum: 1 } } },
    ]),
    WorkEntry.aggregate([
      { $match: { userId, date: { $gte: monthStart, $lt: monthEnd } } },
      { $group: { _id: null, monthHours: { $sum: { $cond: [{ $eq: ['$type', 'shift'] }, '$hours', 0] } } } },
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
 * GET /api/work-tracker/analytics
 * Detailed analytics for charts (daily hours, employer breakdown).
 * Query params: ?month=YYYY-MM
 */
router.get('/analytics', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const monthStr = req.query.month as string; // 'YYYY-MM'

  let start: Date;
  let end: Date;

  if (monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    start = new Date(Date.UTC(year, month - 1, 1));
    end = new Date(Date.UTC(year, month, 1));
  } else {
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }

  // 1. Daily Hours & Breakdown by Employer (for stacked bar chart)
  const entries = await WorkEntry.find({
    userId,
    date: { $gte: start, $lt: end },
    status: 'done' // Usually analytics focus on completed work
  }).populate('employerId', 'name');

  const dailyMap: Record<string, any> = {};
  const employerMap: Record<string, any> = {};

  entries.forEach(entry => {
    const dateKey = entry.date.toISOString().split('T')[0];
    const empName = entry.type === 'shift' ? ((entry.employerId as any)?.name || 'Unknown') : 'Appointment';
    const hours = entry.hours || 0;

    // Daily breakdown
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { date: dateKey, totalHours: 0, entries: [] };
    }
    dailyMap[dateKey].totalHours += hours;
    dailyMap[dateKey].entries.push({
      type: entry.type,
      employer: empName,
      hours: hours,
      breakMinutes: entry.breakMinutes || 0,
      paidKm: entry.paidKilometers || 0
    });

    // Employer breakdown (Only for shifts)
    if (entry.type === 'shift') {
      const empId = String(entry.employerId?._id || 'unknown');
      if (!employerMap[empId]) {
        employerMap[empId] = { id: empId, name: empName, hours: 0, count: 0 };
      }
      employerMap[empId].hours += hours;
      employerMap[empId].count += 1;
    }
  });

  const dailyHours = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const employerBreakdown = Object.values(employerMap).sort((a, b) => b.hours - a.hours);

  // 2. Aggregated Summary
  const summary = {
    totalHours: entries.reduce((acc, curr) => acc + (curr.hours || 0), 0),
    totalEntries: entries.length,
    avgHoursPerDay: dailyHours.length > 0
      ? entries.reduce((acc, curr) => acc + (curr.hours || 0), 0) / dailyHours.length
      : 0,
    totalBreakMinutes: entries.reduce((acc, curr) => acc + (curr.breakMinutes || 0), 0),
    totalPaidKm: entries.reduce((acc, curr) => acc + (curr.paidKilometers || 0), 0)
  };

  res.json({
    dailyHours,
    employerBreakdown,
    summary
  });
}));

/**
 * GET /api/work-tracker/months
 * Get all unique months (YYYY-MM) that have work entries for the user.
 */
router.get('/months', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const months = await WorkEntry.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId as string) } },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' }
        }
      }
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: [
                { $lt: ['$_id.month', 10] },
                { $concat: ['0', { $toString: '$_id.month' }] },
                { $toString: '$_id.month' }
              ]
            }
          ]
        }
      }
    },
    { $sort: { month: -1 } }
  ]);

  res.json(months.map(m => m.month));
}));

/**
 * GET /api/work-tracker/appointment-types
 */
router.get('/appointment-types', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const types = await AppointmentType.find({ userId }).sort({ name: 1 });
  res.json(types);
}));

/**
 * POST /api/work-tracker/appointment-types
 */
router.post('/appointment-types', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { name } = req.body;
  if (!name) throw new ValidationError('Name is required.');
  const type = await AppointmentType.create({ userId, name: name.trim() });
  res.status(201).json(type);
}));

/**
 * PUT /api/work-tracker/appointment-types/:id
 */
router.put('/appointment-types/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const type = await AppointmentType.findOne({ _id: req.params.id, userId });
  if (!type) throw new NotFoundError('Appointment type not found.');
  if (req.body.name) type.name = req.body.name.trim();
  await type.save();
  res.json(type);
}));

/**
 * DELETE /api/work-tracker/appointment-types/:id
 */
router.delete('/appointment-types/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id;
  await AppointmentType.findOneAndDelete({ _id: req.params.id, userId });
  res.json({ message: 'Deleted' });
}));

/**
 * POST /api/work-tracker
 * Create a new work entry.
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { employerId, appointmentTypeId, title, type, date, startTime, endTime, breakMinutes = 0, paidKilometers = 0, notes, subLocationId } = req.body;

  if (!type || !['shift', 'appointment'].includes(type)) throw new ValidationError('type must be "shift" or "appointment".');
  if (type === 'shift' && !employerId) throw new ValidationError('employerId is required for shifts.');
  if (type === 'appointment' && !appointmentTypeId && !employerId) throw new ValidationError('appointmentTypeId or employerId is required for appointments.');
  if (!date) throw new ValidationError('date is required.');
  if (!startTime || !endTime) throw new ValidationError('startTime and endTime are required.');

  // Verify employer
  let employer;
  if (employerId) {
    employer = await Employer.findOne({ _id: employerId, userId });
    if (!employer) throw new NotFoundError('Employer not found.');
  }

  // Verify appointment type
  let appointmentType;
  if (appointmentTypeId) {
    appointmentType = await AppointmentType.findOne({ _id: appointmentTypeId, userId });
    if (!appointmentType) throw new NotFoundError('Appointment type not found.');
  }

  // Resolve sub-location name snapshot
  let subLocationName: string | undefined;
  let resolvedSubId: string | undefined;
  if (subLocationId && employer) {
    const sub = employer.subLocations.find((s) => String(s._id) === subLocationId);
    if (!sub) throw new NotFoundError('Sub-location not found.');
    subLocationName = sub.name;
    resolvedSubId = subLocationId;
  }

  const entry = await WorkEntry.create({
    userId,
    employerId: employerId || undefined,
    appointmentTypeId: appointmentTypeId || undefined,
    title: title?.trim() || undefined,
    type,
    date: new Date(date),
    startTime,
    endTime,
    breakMinutes,
    paidKilometers,
    hours: computeHours(startTime, endTime, breakMinutes),
    notes: notes?.trim() || undefined,
    subLocationId: resolvedSubId,
    subLocationName,
  });

  const populated = await entry.populate([
    { path: 'employerId', select: 'name logoUrl subLocations' },
    { path: 'appointmentTypeId', select: 'name' }
  ]);
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

  const { employerId, appointmentTypeId, title, type, date, startTime, endTime, breakMinutes, paidKilometers, notes, status, subLocationId } = req.body;

  if (employerId !== undefined) {
    if (employerId === null || employerId === '') {
      entry.employerId = undefined;
    } else {
      const employer = await Employer.findOne({ _id: employerId, userId });
      if (!employer) throw new NotFoundError('Employer not found.');
      entry.employerId = new mongoose.Types.ObjectId(employerId);

      // Re-resolve sub-location against the new employer
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
    }
  } else if (subLocationId !== undefined && entry.employerId) {
    // Employer unchanged – still need to validate sub-location
    const employer = await Employer.findOne({ _id: entry.employerId, userId });
    if (employer) {
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
  }

  if (appointmentTypeId !== undefined) {
    if (appointmentTypeId === null || appointmentTypeId === '') {
      entry.appointmentTypeId = undefined;
    } else {
      const apt = await AppointmentType.findOne({ _id: appointmentTypeId, userId });
      if (!apt) throw new NotFoundError('Appointment type not found.');
      entry.appointmentTypeId = new mongoose.Types.ObjectId(appointmentTypeId);
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
  if (breakMinutes !== undefined) entry.breakMinutes = breakMinutes;
  if (paidKilometers !== undefined) entry.paidKilometers = paidKilometers;
  if (notes !== undefined) entry.notes = notes?.trim() || undefined;
  if (status !== undefined) {
    if (!['planned', 'done'].includes(status)) throw new ValidationError('status must be "planned" or "done".');
    entry.status = status;
  }

  // Recompute hours if times changed
  if (startTime !== undefined || endTime !== undefined || breakMinutes !== undefined) {
    entry.hours = computeHours(entry.startTime, entry.endTime, entry.breakMinutes || 0);
  }

  await entry.save();
  const populated = await entry.populate([
    { path: 'employerId', select: 'name logoUrl subLocations' },
    { path: 'appointmentTypeId', select: 'name' }
  ]);
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
  const entry = await WorkEntry.findOne({ _id: req.params.id, userId }).populate([
    { path: 'employerId', select: 'name logoUrl' },
    { path: 'appointmentTypeId', select: 'name' }
  ]);

  if (!entry) throw new NotFoundError('Work entry not found.');
  if (entry.reminderCreated && entry.googleCalendarEventId) {
    return res.json({ message: 'Reminder already created.', eventId: entry.googleCalendarEventId });
  }

  const auth = await getOAuth2Client(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const entityName = entry.employerId ? (entry.employerId as any).name : (entry.appointmentTypeId as any)?.name ?? 'Appointment';
  const entryTitle = entry.title ? `${entityName} — ${entry.title}` : entityName;

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
        breakMinutes: e.breakMinutes || 0,
        paidKilometers: e.paidKilometers || 0,
        notes: e.notes || undefined,
        status,
      });
      return doc._id;
    }),
  );

  res.status(201).json({ message: `${created.length} entr${created.length === 1 ? 'y' : 'ies'} added.`, count: created.length, ids: created });
}));

export default router;
