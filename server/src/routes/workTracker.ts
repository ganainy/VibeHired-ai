// server/src/routes/workTracker.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors/AppError';
import WorkEntry, { computeHours } from '../models/WorkEntry';
import Employer from '../models/Employer';
import AppointmentType from '../models/AppointmentType';
import Profile from '../models/Profile';
import { env } from '../config/env';
import { decrypt, encrypt } from '../utils/encryption';
import { GEMINI_FLASH } from '../constants/geminiModels';
import { calculateEffectiveHourlyRate, BonusInput } from '../utils/bonusCalculator';

import { PDFParse } from 'pdf-parse';

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

/** Resolve the user's Gemini API key (master key only). */
async function getGeminiKey(_userId: string): Promise<string> {
  const envKey = process.env.GEMINI_API_KEY;
  if (!envKey) throw new Error('GEMINI_API_KEY not configured on server');
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

  // ── Auto-flip stale 'planned' entries to 'done' ────────────────────────────
  // Find every planned entry for this user and promote any whose end datetime
  // has already passed to 'done', so the UI always reflects reality on load.
  const now = new Date();
  const plannedEntries = await WorkEntry.find({ userId, status: 'planned' });
  const staleIds = plannedEntries
    .filter((e) => {
      const [eh, em] = e.endTime.split(':').map(Number);
      const endDt = new Date(e.date);
      endDt.setUTCHours(eh, em, 0, 0);
      return endDt < now;
    })
    .map((e) => e._id);
  if (staleIds.length > 0) {
    await WorkEntry.updateMany({ _id: { $in: staleIds } }, { $set: { status: 'done' } });
  }
  // ──────────────────────────────────────────────────────────────────────────

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
    .populate('employerId', 'name logoUrl hourlyRate bonuses')
    .populate('appointmentTypeId', 'name')
    .sort({ date: 1, startTime: 1 });

  // Log bonus data for shift entries to help debug bonus application
  for (const entry of entries) {
    const emp = entry.employerId as any;
    if (entry.type === 'shift' && emp?.bonuses?.length > 0) {
      console.log('[GET /work-tracker] Entry:', entry._id, '| Employer:', emp.name, '| Bonuses:', JSON.stringify(emp.bonuses), '| Date:', entry.date, '| Time:', entry.startTime, '-', entry.endTime);
    }
  }

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
  const monthStr = req.query.month as string; // 'YYYY-MM' or special values like 'current-month', 'last-month'

  let start: Date;
  let end: Date;

  // Try to parse as YYYY-MM format
  const isValidYearMonth = monthStr && /^[0-9]{4}-[0-9]{2}$/.test(monthStr);

  if (isValidYearMonth) {
    const [year, month] = monthStr.split('-').map(Number);
    if (month >= 1 && month <= 12) {
      start = new Date(Date.UTC(year, month - 1, 1));
      end = new Date(Date.UTC(year, month, 1));
    } else {
      // Invalid month, default to current month
      const now = new Date();
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    }
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
  }).populate('employerId', 'name hourlyRate bonuses');

  const dailyMap: Record<string, any> = {};
  const employerMap: Record<string, any> = {};

  entries.forEach(entry => {
    // Skip entries with invalid dates
    if (!entry.date || isNaN(entry.date.getTime())) {
      return;
    }
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
        const rate = (entry.employerId as any)?.hourlyRate ?? null;
        employerMap[empId] = { id: empId, name: empName, hours: 0, count: 0, hourlyRate: rate, earnings: 0 };
      }
      employerMap[empId].hours += hours;
      employerMap[empId].count += 1;
      const effectiveRate = calculateEffectiveHourlyRate(
        (entry.employerId as any)?.hourlyRate ?? null,
        (entry.employerId as any)?.bonuses ?? [] as BonusInput[],
        dateKey,
        entry.startTime,
        entry.endTime
      );
      if ((entry.employerId as any)?.bonuses?.length > 0) {
        console.log('[GET /work-tracker/analytics] Entry:', entry._id, '| Employer:', (entry.employerId as any)?.name, '| Base rate:', (entry.employerId as any)?.hourlyRate, '| Bonuses:', JSON.stringify((entry.employerId as any)?.bonuses), '| Effective rate:', effectiveRate);
      }
      if (typeof effectiveRate === 'number' && effectiveRate > 0) {
        employerMap[empId].earnings += hours * effectiveRate;
      }
    }
  });

  const dailyHours = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
  const employerBreakdown = Object.values(employerMap)
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      hours: item.hours,
      count: item.count,
      earnings: item.earnings > 0 ? Math.round(item.earnings * 100) / 100 : undefined,
    }))
    .sort((a, b) => b.hours - a.hours);

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
  const { employerId, appointmentTypeId, title, type, date, startTime, endTime, breakMinutes = 0, paidKilometers = 0, notes, subLocationId, addToCalendar } = req.body;

  if (!type || !['shift', 'appointment'].includes(type)) throw new ValidationError('type must be "shift" or "appointment".');
  if (type === 'shift' && !employerId) throw new ValidationError('employerId is required for shifts.');
  if (type === 'appointment' && !appointmentTypeId && !employerId) throw new ValidationError('appointmentTypeId or employerId is required for appointments.');
  if (!date) throw new ValidationError('date is required.');
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) throw new ValidationError('Invalid date format.');
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
    date: parsedDate,
    startTime,
    endTime,
    breakMinutes,
    paidKilometers,
    hours: computeHours(startTime, endTime, breakMinutes),
    notes: notes?.trim() || undefined,
    subLocationId: resolvedSubId,
    subLocationName,
  });

  // Create calendar event if requested
  let calendarEventCreated = false;
  if (addToCalendar) {
    try {
      const auth = await getOAuth2Client(userId);
      const calendar = google.calendar({ version: 'v3', auth });

      const entityName = employer?.name || appointmentType?.name || 'Work Entry';
      const entryTitle = title ? `${entityName} — ${title}` : entityName;

      const startDateTime = new Date(`${parsedDate.toISOString().split('T')[0]}T${startTime}:00`);
      const endDateTime = new Date(`${parsedDate.toISOString().split('T')[0]}T${endTime}:00`);
      if (endDateTime <= startDateTime) endDateTime.setDate(endDateTime.getDate() + 1);

      const event = {
        summary: entryTitle,
        description: [
          `Type: ${type === 'shift' ? 'Work Shift' : 'Appointment'}`,
          `Hours: ${computeHours(startTime, endTime, breakMinutes)}h (${startTime} – ${endTime})`,
          notes ? `Notes: ${notes}` : '',
          '',
          'Added via VibeHired Time Tracker',
        ].filter(Boolean).join('\n'),
        start: { dateTime: startDateTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: endDateTime.toISOString(), timeZone: 'UTC' },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 1440 }],
        },
      };

      const response = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      const eventId = response.data.id;
      if (eventId) {
        entry.googleCalendarEventId = eventId;
        entry.reminderCreated = true;
        await entry.save();
        calendarEventCreated = true;
      }
    } catch (calErr) {
      console.error('Failed to create calendar event:', calErr);
    }
  }

  const populated = await entry.populate([
    { path: 'employerId', select: 'name logoUrl subLocations' },
    { path: 'appointmentTypeId', select: 'name' }
  ]);
  res.status(201).json({ ...populated.toObject(), calendarEventCreated });
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
  usageLimiter('jobExtraction'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = String(req.user!._id);
    const { text, defaultStartTime = '09:00', defaultEndTime = '17:00', importMode = 'shift' } = req.body;

    if (!req.file && !String(text ?? '').trim()) {
      throw new ValidationError('Provide a file (image or PDF) or paste schedule text.');
    }

    const apiKey = await getGeminiKey(userId);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    const today = new Date().toISOString().split('T')[0];

    // Build prompt based on import mode
    const shouldDetectType = importMode === 'auto';
    const typeInstructions = shouldDetectType
      ? `  "type": "shift" or "appointment" — distinguish based on context:\n` +
        `    - Use "appointment" for: interviews, doctor visits, meetings, consultations, exams, etc.\n` +
        `    - Use "shift" for: work shifts, jobs, employment schedules, etc.\n` +
        `    - Default to "shift" when ambiguous\n`
      : `  "type": "${importMode}" (all entries are ${importMode}s)\n`;

    const systemPrompt =
      `You are a work-schedule parser. Extract every individual work shift or appointment.\n` +
      `Return ONLY a valid JSON array — no markdown, no explanation.\n` +
      `Each element must have:\n` +
      `  "date": "YYYY-MM-DD"\n` +
      `  "startTime": "HH:MM" 24h (use "${defaultStartTime}" when not shown)\n` +
      `  "endTime": "HH:MM" 24h (use "${defaultEndTime}" when not shown)\n` +
      `  "notes": brief context string or null\n` +
      typeInstructions +
      `Today is ${today}. Infer the year when only month/day is given (nearest future).\n` +
      `Example: [{"date":"2026-03-01","startTime":"09:00","endTime":"17:00","notes":null,"type":"shift"}]`;

    let responseText: string;

    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const parser = new PDFParse({ data: req.file.buffer });
        const { text: pdfText } = await parser.getText();
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
      .map((e: any) => {
        const startTimeDetected = TIME_RE.test(e.startTime);
        const endTimeDetected = TIME_RE.test(e.endTime);
        // Determine type: use AI's detection in auto mode, otherwise use importMode
        const detectedType = shouldDetectType && e.type && ['shift', 'appointment'].includes(e.type)
          ? e.type
          : importMode;
        return {
          date: e.date as string,
          startTime: startTimeDetected ? e.startTime : defaultStartTime,
          endTime: endTimeDetected ? e.endTime : defaultEndTime,
          startTimeInferred: !startTimeDetected,
          endTimeInferred: !endTimeDetected,
          notes: typeof e.notes === 'string' && e.notes ? e.notes : null,
          type: detectedType as 'shift' | 'appointment',
        };
      });

    res.json({ entries, count: entries.length });
  }),
);

/**
 * POST /api/work-tracker/import-schedule/confirm
 * Bulk-creates confirmed work entries from the parsed schedule.
 */
router.post('/import-schedule/confirm', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { entries, employerId, appointmentTypeId } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new ValidationError('entries array must not be empty.');
  }

  // Validate that we have at least one entity ID
  if (!employerId && !appointmentTypeId) {
    throw new ValidationError('employerId or appointmentTypeId is required.');
  }

  // Fetch employer if provided
  let employer: any = null;
  if (employerId) {
    employer = await Employer.findOne({ _id: employerId, userId });
    if (!employer) throw new NotFoundError('Employer not found.');
  }

  // Fetch appointment type if provided
  let appointmentType;
  if (appointmentTypeId) {
    appointmentType = await AppointmentType.findOne({ _id: appointmentTypeId, userId });
    if (!appointmentType) throw new NotFoundError('Appointment type not found.');
  }

  const today = new Date().toISOString().split('T')[0];

  const created = await Promise.all(
    entries.map(async (e: any) => {
      const entryType = e.type || 'shift';
      const status: 'planned' | 'done' = e.date <= today ? 'done' : 'planned';

      // Determine which IDs to use based on entry type
      let entryEmployerId: string | undefined;
      let entryAppointmentTypeId: string | undefined;
      let subLocationName: string | undefined;
      let resolvedSubId: string | undefined;

      if (entryType === 'shift') {
        // Shifts require an employer
        if (!employerId) {
          throw new ValidationError('employerId is required for shift entries.');
        }
        entryEmployerId = employerId;

        // Handle sub-location for shifts
        if (e.subLocationId && employer) {
          const sub = (employer as any).subLocations?.find((s: any) => String(s._id) === e.subLocationId);
          if (sub) { subLocationName = sub.name; resolvedSubId = e.subLocationId; }
        }
      } else {
        // Appointments use appointmentTypeId if provided, otherwise can use employerId
        if (appointmentTypeId) {
          entryAppointmentTypeId = appointmentTypeId;
        }
        if (employerId) {
          entryEmployerId = employerId;
        }
        // Appointments need at least one of the two
        if (!entryAppointmentTypeId && !entryEmployerId) {
          throw new ValidationError('appointmentTypeId or employerId is required for appointment entries.');
        }
      }

      const doc = await WorkEntry.create({
        userId,
        employerId: entryEmployerId,
        appointmentTypeId: entryAppointmentTypeId,
        subLocationId: resolvedSubId,
        subLocationName,
        title: e.title || undefined,
        type: entryType,
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

/**
 * POST /api/work-tracker/parse-magic-prompt
 * Accepts a spoken or typed text prompt and returns a structured work entry object.
 */
router.post('/parse-magic-prompt', usageLimiter('jobExtraction'), asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { text, today, employers, appointmentTypes } = req.body;

  if (!text) throw new ValidationError('Text prompt is required.');

  const apiKey = await getGeminiKey(userId);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

  const systemPrompt = `You are an AI assistant parsing a voice/text command to log a work shift or appointment.
Today's date is ${today}.
Available Employers (JSON):
${JSON.stringify(employers)}
Available Appointment Types (JSON):
${JSON.stringify(appointmentTypes)}

Extract the requested work entry details. 
Return ONLY a valid JSON object matching this structure:
{
  "type": "shift" | "appointment",
  "employerId": "ID string or null if unable to match",
  "appointmentTypeId": "ID string or null if unable to match",
  "subLocationId": "ID string or null if matched from employer's subLocations",
  "title": "Short descriptive title or empty string",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM (24h format)",
  "endTime": "HH:MM (24h format)",
  "notes": "Any extra notes from the text"
}

If the user mentions an employer that fuzzy matches one of the 'Available Employers', set type: "shift" and employerId to its _id. Also match subLocation if mentioned.
If they mention an appointment type, set type: "appointment" and the appointmentTypeId.
Otherwise guess the type properly based on context.`;

  const result = await model.generateContent(`${systemPrompt}\n\nUser command: "${text}"`);

  try {
    const cleaned = result.response.text().replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const raw = JSON.parse(cleaned);
    res.json(raw);
  } catch (e: any) {
    throw new ValidationError(`AI could not parse the command. ${e.message}`);
  }
}));

export default router;
