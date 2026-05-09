// server/src/routes/employers.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import authMiddleware from '../middleware/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors/AppError';
import Employer, { IEmployerBonus } from '../models/Employer';
import WorkEntry from '../models/WorkEntry';

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler);

// ── Multer config (memory storage → Cloudinary) ───────────────────────────────
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Image type not allowed: ${file.mimetype}`));
    }
  },
});

function parseBonuses(raw: unknown): IEmployerBonus[] {
  console.log('[parseBonuses] Input type:', typeof raw, '| value preview:', JSON.stringify(raw)?.slice(0, 200));
  if (!raw) {
    console.log('[parseBonuses] No bonuses provided, returning empty array');
    return [];
  }
  let arr: any[] = [];
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch (e) {
      console.warn('[parseBonuses] Failed to parse JSON string:', (e as Error).message);
      return [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  if (!Array.isArray(arr)) {
    console.warn('[parseBonuses] Parsed value is not an array:', typeof arr);
    return [];
  }
  console.log('[parseBonuses] Parsed array length:', arr.length, '| items:', JSON.stringify(arr));
  const result = arr
    .filter((b) => b && typeof b === 'object')
    .map((b) => ({
      _id: typeof b._id === 'string' && /^[0-9a-fA-F]{24}$/.test(b._id) ? b._id : undefined,
      name: String(b.name ?? '').trim(),
      multiplier: Math.max(0, Number(b.multiplier) || 0),
      conditionType: ['day_of_week', 'time_range', 'specific_dates'].includes(b.conditionType)
        ? (b.conditionType as 'day_of_week' | 'time_range' | 'specific_dates')
        : 'day_of_week',
      daysOfWeek: Array.isArray(b.daysOfWeek)
        ? b.daysOfWeek.filter((d: any) => typeof d === 'number' && d >= 0 && d <= 6)
        : undefined,
      startTime: typeof b.startTime === 'string' && /^\d{2}:\d{2}$/.test(b.startTime) ? b.startTime : undefined,
      endTime: typeof b.endTime === 'string' && /^\d{2}:\d{2}$/.test(b.endTime) ? b.endTime : undefined,
      specificDates: Array.isArray(b.specificDates)
        ? b.specificDates.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        : undefined,
    }))
    .filter((b) => b.name.length > 0);
  console.log('[parseBonuses] Returning', result.length, 'bonuses:', JSON.stringify(result));
  return result;
}

/** Upload buffer to Cloudinary and return { url, publicId } */
async function uploadLogoToCloudinary(
  buffer: Buffer,
  mimeType: string,
  userId: string,
  existingPublicId?: string
): Promise<{ url: string; publicId: string }> {
  // Delete old logo first (if replacing)
  if (existingPublicId) {
    try {
      await cloudinary.uploader.destroy(existingPublicId);
    } catch {
      // Non-fatal
    }
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `user_${userId}/employer_logos`,
        resource_type: 'image',
        format: 'webp', // normalise to webp for smaller size
        transformation: [{ width: 200, height: 200, crop: 'limit' }],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('Cloudinary upload returned no result'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * GET /api/employers
 * List all employers for the authenticated user.
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employers = await Employer.find({ userId }).sort({ name: 1 });

  // Attach total hours for each employer
  const employerIds = employers.map((e) => e._id);
  const hoursByEmployer = await WorkEntry.aggregate([
    { $match: { userId: req.user!._id, employerId: { $in: employerIds } } },
    { $group: { _id: '$employerId', totalHours: { $sum: '$hours' }, entryCount: { $sum: 1 } } },
  ]);

  const hoursMap = new Map(hoursByEmployer.map((h) => [String(h._id), { totalHours: h.totalHours, entryCount: h.entryCount }]));

  const result = employers.map((emp) => {
    const stats = hoursMap.get(String(emp._id)) ?? { totalHours: 0, entryCount: 0 };
    console.log('[GET /employers] Employer:', emp._id, emp.name, '| bonuses:', JSON.stringify(emp.bonuses));
    return {
      _id: emp._id,
      name: emp.name,
      logoUrl: emp.logoUrl ?? null,
      logoPublicId: emp.logoPublicId ?? null,
      hourlyRate: emp.hourlyRate ?? null,
      subLocations: emp.subLocations ?? [],
      bonuses: emp.bonuses ?? [],
      totalHours: stats.totalHours,
      entryCount: stats.entryCount,
      createdAt: emp.createdAt,
    };
  });

  res.json(result);
}));

/**
 * POST /api/employers
 * Create a new employer. Accepts multipart/form-data with optional `logo` file.
 */
router.post('/', upload.single('logo'), asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    throw new ValidationError('Employer name is required.');
  }

  let logoUrl: string | undefined;
  let logoPublicId: string | undefined;

  if (req.file) {
    const result = await uploadLogoToCloudinary(req.file.buffer, req.file.mimetype, userId);
    logoUrl = result.url;
    logoPublicId = result.publicId;
  }

  const rawRate = req.body.hourlyRate;
  const hourlyRate = rawRate !== undefined && rawRate !== '' ? Number(rawRate) : null;

  const parsedBonuses = parseBonuses(req.body.bonuses);
  console.log('[POST /employers] Creating employer with', parsedBonuses.length, 'bonuses:', JSON.stringify(parsedBonuses));

  const employer = await Employer.create({
    userId,
    name: String(name).trim(),
    logoUrl,
    logoPublicId,
    hourlyRate: hourlyRate !== null && !isNaN(hourlyRate) && hourlyRate >= 0 ? hourlyRate : null,
    bonuses: parsedBonuses,
  });

  console.log('[POST /employers] Created employer:', employer._id, '| bonuses:', JSON.stringify(employer.bonuses));
  res.status(201).json(employer);
}));

/**
 * PUT /api/employers/:id
 * Update employer name and/or replace logo.
 */
router.put('/:id', upload.single('logo'), asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employer = await Employer.findOne({ _id: req.params.id, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  if (req.body.name !== undefined) {
    const trimmed = String(req.body.name).trim();
    if (!trimmed) throw new ValidationError('Employer name cannot be empty.');
    employer.name = trimmed;
  }

  if (req.body.hourlyRate !== undefined) {
    const rate = Number(req.body.hourlyRate);
    employer.hourlyRate = !isNaN(rate) && rate >= 0 ? rate : null;
  }

  if (req.body.bonuses !== undefined) {
    console.log('[PUT /employers/:id] Updating bonuses. Employer:', employer._id, '| Existing bonuses count:', employer.bonuses.length);
    employer.bonuses = parseBonuses(req.body.bonuses);
    employer.markModified('bonuses');
    console.log('[PUT /employers/:id] Bonuses set on employer. New count:', employer.bonuses.length, '| bonuses:', JSON.stringify(employer.bonuses));
  }

  if (req.file) {
    const result = await uploadLogoToCloudinary(
      req.file.buffer,
      req.file.mimetype,
      userId,
      employer.logoPublicId
    );
    employer.logoUrl = result.url;
    employer.logoPublicId = result.publicId;
  }

  await employer.save();
  console.log('[PUT /employers/:id] Saved employer:', employer._id, '| bonuses in saved doc:', JSON.stringify(employer.bonuses));
  res.json(employer);
}));

/**
 * DELETE /api/employers/:id
 * Delete employer, remove Cloudinary asset, and null-out related work entries.
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employer = await Employer.findOne({ _id: req.params.id, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  // Delete Cloudinary logo
  if (employer.logoPublicId) {
    try {
      await cloudinary.uploader.destroy(employer.logoPublicId);
    } catch {
      // Non-fatal
    }
  }

  // Delete all work entries for this employer
  await WorkEntry.deleteMany({ userId, employerId: employer._id });

  await employer.deleteOne();
  res.json({ message: 'Employer deleted.' });
}));

// ── Sub-location routes ───────────────────────────────────────────────────────

/**
 * POST /api/employers/:id/sub-locations
 * Add a new sub-location to an employer.
 */
router.post('/:id/sub-locations', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employer = await Employer.findOne({ _id: req.params.id, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  const name = String(req.body.name ?? '').trim();
  if (!name) throw new ValidationError('Sub-location name is required.');

  employer.subLocations.push({ name } as any);
  await employer.save();

  res.status(201).json(employer.subLocations[employer.subLocations.length - 1]);
}));

/**
 * PUT /api/employers/:id/sub-locations/:subId
 * Rename a sub-location.
 */
router.put('/:id/sub-locations/:subId', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employer = await Employer.findOne({ _id: req.params.id, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  const sub = employer.subLocations.find((s) => String(s._id) === req.params.subId);
  if (!sub) throw new NotFoundError('Sub-location not found.');

  const name = String(req.body.name ?? '').trim();
  if (!name) throw new ValidationError('Sub-location name is required.');

  sub.name = name;
  await employer.save();

  res.json(sub);
}));

/**
 * DELETE /api/employers/:id/sub-locations/:subId
 * Remove a sub-location (does NOT delete work entries — they keep the name snapshot).
 */
router.delete('/:id/sub-locations/:subId', asyncHandler(async (req: Request, res: Response) => {
  const userId = String(req.user!._id);
  const employer = await Employer.findOne({ _id: req.params.id, userId });
  if (!employer) throw new NotFoundError('Employer not found.');

  const idx = employer.subLocations.findIndex((s) => String(s._id) === req.params.subId);
  if (idx === -1) throw new NotFoundError('Sub-location not found.');

  employer.subLocations.splice(idx, 1);
  await employer.save();

  res.json({ message: 'Sub-location deleted.' });
}));

export default router;
