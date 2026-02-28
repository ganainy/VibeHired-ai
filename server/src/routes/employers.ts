// server/src/routes/employers.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import authMiddleware from '../middleware/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors/AppError';
import Employer from '../models/Employer';
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
    return {
      _id: emp._id,
      name: emp.name,
      logoUrl: emp.logoUrl ?? null,
      logoPublicId: emp.logoPublicId ?? null,
      subLocations: emp.subLocations ?? [],
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

  const employer = await Employer.create({
    userId,
    name: String(name).trim(),
    logoUrl,
    logoPublicId,
  });

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
