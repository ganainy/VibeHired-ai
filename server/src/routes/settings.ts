// server/src/routes/settings.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import Profile from '../models/Profile';
import { asyncHandler } from '../utils/asyncHandler';
import { ValidationError, NotFoundError } from '../utils/errors/AppError';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler); // Apply auth to all routes

/**
 * Mask API key - show only last 4 characters
 * Handles both encrypted and unencrypted keys (for migration compatibility)
 */
function maskApiKey(key: string | undefined | null): string | null {
  if (!key) return null;

  // Try to decrypt first (in case it's encrypted)
  const decrypted = decrypt(key);

  // If decryption failed (returns null)
  if (decrypted === null) {
    // If it looks encrypted but failed to decrypt, it's invalid/corrupt
    // Return null so the UI treats it as "not configured"
    if (isEncrypted(key)) {
      return null;
    }
    // If it doesn't look encrypted, treat as legacy cleartext
    const valueToMask = key;
    if (valueToMask.length <= 4) return '****';
    return '****' + valueToMask.slice(-4);
  }

  // Decryption successful
  const valueToMask = decrypted;
  if (valueToMask.length <= 4) return '****';
  return '****' + valueToMask.slice(-4);
}

/**
 * GET /api/settings/api-keys
 * Get user's API keys (masked)
 */
router.get('/api-keys', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();

  // Find or create profile if it doesn't exist
  let profile = await Profile.findOne({ userId });
  if (!profile) {
    // Create a new profile if it doesn't exist
    profile = await Profile.create({
      userId,
      autoJobSettings: {
        keywords: '',
        location: '',
        jobType: [],
        experienceLevel: [],
        datePosted: 'any time',
        maxJobs: 100,
        avoidDuplicates: false
      }
    });
  }

  res.json({
    // Currently no user-managed API keys (Apify is now handled server-side)
  });
}));

/**
 * PUT /api/settings/api-keys
 * Update user's API keys
 */
router.put('/api-keys', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();

  // No specific keys to update currently
  res.json({
    message: 'Settings updated successfully',
  });
}));

/**
 * DELETE /api/settings/api-keys/:service
 * Delete a specific API key
 */
router.delete('/api-keys/:service', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }

  const service = req.params.service;
  throw new ValidationError(`Service "${service}" cannot be managed here.`);
}));


/**
 * GET /api/settings/custom-prompts
 * Get user's custom prompts for CV and Cover Letter generation
 */
router.get('/custom-prompts', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();

  const profile = await Profile.findOne({ userId });

  res.json({
    cvPrompt: profile?.customPrompts?.cvPrompt || null,
    coverLetterPrompt: profile?.customPrompts?.coverLetterPrompt || null,
  });
}));

/**
 * PUT /api/settings/custom-prompts
 * Update user's custom prompts
 */
router.put('/custom-prompts', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();

  const { cvPrompt, coverLetterPrompt } = req.body;

  // Validate prompts (optional, max 50000 chars each)
  if (cvPrompt !== undefined && cvPrompt !== null && typeof cvPrompt === 'string' && cvPrompt.length > 50000) {
    throw new ValidationError('CV prompt is too long (max 50000 characters)');
  }
  if (coverLetterPrompt !== undefined && coverLetterPrompt !== null && typeof coverLetterPrompt === 'string' && coverLetterPrompt.length > 50000) {
    throw new ValidationError('Cover Letter prompt is too long (max 50000 characters)');
  }

  const updates: any = {};

  if (cvPrompt !== undefined) {
    updates['customPrompts.cvPrompt'] = cvPrompt === '' ? null : cvPrompt;
  }
  if (coverLetterPrompt !== undefined) {
    updates['customPrompts.coverLetterPrompt'] = coverLetterPrompt === '' ? null : coverLetterPrompt;
  }

  await Profile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );

  const updatedProfile = await Profile.findOne({ userId });

  res.json({
    message: 'Custom prompts updated successfully',
    cvPrompt: updatedProfile?.customPrompts?.cvPrompt || null,
    coverLetterPrompt: updatedProfile?.customPrompts?.coverLetterPrompt || null,
  });
}));


/**
 * GET /api/settings/custom-prompts/templates
 * Get user's custom prompt templates
 */
router.get('/custom-prompts/templates', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();
  const profile = await Profile.findOne({ userId });

  res.json({
    templates: profile?.promptTemplates || []
  });
}));

/**
 * PUT /api/settings/custom-prompts/templates
 * Update (replace) user's custom prompt templates
 */
router.put('/custom-prompts/templates', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();
  const { templates } = req.body;

  if (!Array.isArray(templates)) {
    throw new ValidationError('Templates must be an array');
  }

  // Basic validation (optional)
  if (templates.length > 50) {
    throw new ValidationError('Too many templates (max 50)');
  }

  await Profile.findOneAndUpdate(
    { userId },
    { $set: { promptTemplates: templates } },
    { new: true, upsert: true }
  );

  const updatedProfile = await Profile.findOne({ userId });
  res.json({
    message: 'Prompt templates updated successfully',
    templates: updatedProfile?.promptTemplates || []
  });
}));

/**
 * GET /api/settings/prompt-checklists
 * Get user's prompt checklist items for cv and coverLetter
 */
router.get('/prompt-checklists', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();
  const profile = await Profile.findOne({ userId });

  res.json({
    checklists: profile?.promptChecklists || { cv: null, coverLetter: null }
  });
}));

/**
 * PUT /api/settings/prompt-checklists
 * Save user's prompt checklist items (cv and/or coverLetter)
 */
router.put('/prompt-checklists', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();
  const { cv, coverLetter } = req.body;

  const update: Record<string, any> = {};
  if (Array.isArray(cv)) update['promptChecklists.cv'] = cv;
  if (Array.isArray(coverLetter)) update['promptChecklists.coverLetter'] = coverLetter;

  await Profile.findOneAndUpdate(
    { userId },
    { $set: update },
    { new: true, upsert: true }
  );

  const updatedProfile = await Profile.findOne({ userId });
  res.json({
    message: 'Prompt checklists updated successfully',
    checklists: updatedProfile?.promptChecklists || {}
  });
}));

export default router;

