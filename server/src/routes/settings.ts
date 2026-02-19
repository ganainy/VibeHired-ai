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
 * Validate Gemini API key format
 */
function validateGeminiKey(key: string): boolean {
  return key.startsWith('AIza') && key.length > 20;
}

/**
 * Validate Apify token format
 */
function validateApifyToken(token: string): boolean {
  return token.startsWith('apify_api_') && token.length > 20;
}

/**
 * Validate OpenRouter API key format
 */
function validateOpenRouterKey(key: string): boolean {
  return (key.startsWith('sk-or-v1-') || key.startsWith('sk-')) && key.length > 20;
}

/**
 * Validate Ollama base URL format
 */
function validateOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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

  // Get AI provider settings
  const aiProviderSettings = profile.aiProviderSettings || {};
  const defaultProvider = aiProviderSettings.defaultProvider || null;
  const defaultModel = aiProviderSettings.defaultModel;

  res.json({
    gemini: {
      accessToken: maskApiKey(profile.integrations?.gemini?.accessToken),
      enabled: profile.integrations?.gemini?.enabled || false,
    },
    apify: {
      accessToken: maskApiKey(profile.integrations?.apify?.accessToken),
      enabled: profile.integrations?.apify?.enabled || false,
    },
    aiProviders: {
      defaultProvider,
      defaultModel,
      providers: {
        gemini: {
          accessToken: maskApiKey(aiProviderSettings.providers?.gemini?.accessToken),
          enabled: aiProviderSettings.providers?.gemini?.enabled || false,
        },
        openrouter: {
          accessToken: maskApiKey(aiProviderSettings.providers?.openrouter?.accessToken),
          enabled: aiProviderSettings.providers?.openrouter?.enabled || false,
        },
        ollama: {
          baseUrl: aiProviderSettings.providers?.ollama?.baseUrl || 'http://localhost:11434',
          enabled: aiProviderSettings.providers?.ollama?.enabled || false,
        },
      },
    },
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

  const { gemini, apify, aiProviders } = req.body;

  // Validate Gemini key if provided
  if (gemini?.accessToken !== undefined && gemini.accessToken !== null && gemini.accessToken !== '') {
    if (!validateGeminiKey(gemini.accessToken)) {
      throw new ValidationError('Invalid Gemini API key format. Key should start with "AIza"');
    }
  }

  // Validate Apify token if provided
  if (apify?.accessToken !== undefined && apify.accessToken !== null && apify.accessToken !== '') {
    if (!validateApifyToken(apify.accessToken)) {
      throw new ValidationError('Invalid Apify token format. Token should start with "apify_api_"');
    }
  }

  // Validate AI provider settings if provided
  if (aiProviders) {
    // Validate default provider
    if (aiProviders.defaultProvider) {
      if (!['gemini', 'openrouter', 'ollama'].includes(aiProviders.defaultProvider)) {
        throw new ValidationError('Invalid default provider. Must be "gemini", "openrouter", or "ollama"');
      }
    }

    // Validate Gemini key if provided
    if (aiProviders.providers?.gemini?.accessToken !== undefined &&
      aiProviders.providers.gemini.accessToken !== null &&
      aiProviders.providers.gemini.accessToken !== '') {
      if (!validateGeminiKey(aiProviders.providers.gemini.accessToken)) {
        throw new ValidationError('Invalid Gemini API key format. Key should start with "AIza"');
      }
    }

    // Validate OpenRouter key if provided
    if (aiProviders.providers?.openrouter?.accessToken !== undefined &&
      aiProviders.providers.openrouter.accessToken !== null &&
      aiProviders.providers.openrouter.accessToken !== '') {
      if (!validateOpenRouterKey(aiProviders.providers.openrouter.accessToken)) {
        throw new ValidationError('Invalid OpenRouter API key format. Key should start with "sk-or-v1-" or "sk-"');
      }
    }

    // Validate Ollama URL if provided
    if (aiProviders.providers?.ollama?.baseUrl !== undefined &&
      aiProviders.providers.ollama.baseUrl !== null &&
      aiProviders.providers.ollama.baseUrl !== '') {
      if (!validateOllamaUrl(aiProviders.providers.ollama.baseUrl)) {
        throw new ValidationError('Invalid Ollama base URL format. Must be a valid HTTP or HTTPS URL');
      }
    }
  }

  // Find or create profile
  let profile = await Profile.findOne({ userId });
  if (!profile) {
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

  // Update integrations
  const updates: any = {};

  // Legacy 'gemini' block removed as per "no legacy code" request.
  // The frontend sends data in 'aiProviders' as well, which is handled below.

  if (apify !== undefined) {
    if (apify.accessToken === null || apify.accessToken === '') {
      // Remove token
      updates['integrations.apify.accessToken'] = null;
      updates['integrations.apify.enabled'] = false;
    } else {
      // Encrypt the API token before storing
      const encryptedToken = encrypt(apify.accessToken);
      if (!encryptedToken) {
        throw new ValidationError('Failed to encrypt Apify token');
      }
      updates['integrations.apify.accessToken'] = encryptedToken;
      updates['integrations.apify.enabled'] = apify.enabled !== undefined ? apify.enabled : true;
    }
  }

  // Update AI provider settings
  if (aiProviders !== undefined) {
    const aiProviderUpdates: any = {};

    // Update default provider and model
    if (aiProviders.defaultProvider !== undefined) {
      aiProviderUpdates['aiProviderSettings.defaultProvider'] = aiProviders.defaultProvider;
    }
    if (aiProviders.defaultModel !== undefined) {
      aiProviderUpdates['aiProviderSettings.defaultModel'] = aiProviders.defaultModel;
    }

    // Update Gemini provider settings
    if (aiProviders.providers?.gemini !== undefined) {
      if (aiProviders.providers.gemini.accessToken === null || aiProviders.providers.gemini.accessToken === '') {
        aiProviderUpdates['aiProviderSettings.providers.gemini.accessToken'] = null;
        aiProviderUpdates['aiProviderSettings.providers.gemini.enabled'] = false;
      } else if (aiProviders.providers.gemini.accessToken !== undefined) {
        const encryptedKey = encrypt(aiProviders.providers.gemini.accessToken);
        if (!encryptedKey) {
          throw new ValidationError('Failed to encrypt Gemini API key');
        }
        aiProviderUpdates['aiProviderSettings.providers.gemini.accessToken'] = encryptedKey;
        aiProviderUpdates['aiProviderSettings.providers.gemini.enabled'] =
          aiProviders.providers.gemini.enabled !== undefined ? aiProviders.providers.gemini.enabled : true;
      }
    }

    // Update OpenRouter provider settings
    if (aiProviders.providers?.openrouter !== undefined) {
      if (aiProviders.providers.openrouter.accessToken === null || aiProviders.providers.openrouter.accessToken === '') {
        aiProviderUpdates['aiProviderSettings.providers.openrouter.accessToken'] = null;
        aiProviderUpdates['aiProviderSettings.providers.openrouter.enabled'] = false;
      } else if (aiProviders.providers.openrouter.accessToken !== undefined) {
        const encryptedKey = encrypt(aiProviders.providers.openrouter.accessToken);
        if (!encryptedKey) {
          throw new ValidationError('Failed to encrypt OpenRouter API key');
        }
        aiProviderUpdates['aiProviderSettings.providers.openrouter.accessToken'] = encryptedKey;
        aiProviderUpdates['aiProviderSettings.providers.openrouter.enabled'] =
          aiProviders.providers.openrouter.enabled !== undefined ? aiProviders.providers.openrouter.enabled : true;
      }
    }

    // Update Ollama provider settings
    if (aiProviders.providers?.ollama !== undefined) {
      if (aiProviders.providers.ollama.baseUrl === null || aiProviders.providers.ollama.baseUrl === '') {
        aiProviderUpdates['aiProviderSettings.providers.ollama.baseUrl'] = 'http://localhost:11434';
        aiProviderUpdates['aiProviderSettings.providers.ollama.enabled'] = false;
      } else {
        if (aiProviders.providers.ollama.baseUrl !== undefined) {
          aiProviderUpdates['aiProviderSettings.providers.ollama.baseUrl'] = aiProviders.providers.ollama.baseUrl;
        }
        aiProviderUpdates['aiProviderSettings.providers.ollama.enabled'] =
          aiProviders.providers.ollama.enabled !== undefined ? aiProviders.providers.ollama.enabled : true;
      }
    }

    Object.assign(updates, aiProviderUpdates);
  }

  // Update profile
  await Profile.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  );

  // Return masked keys
  const updatedProfile = await Profile.findOne({ userId });
  const aiProviderSettings = updatedProfile?.aiProviderSettings || {};

  res.json({
    message: 'API keys updated successfully',
    gemini: {
      accessToken: maskApiKey(updatedProfile?.integrations?.gemini?.accessToken),
      enabled: updatedProfile?.integrations?.gemini?.enabled || false,
    },
    apify: {
      accessToken: maskApiKey(updatedProfile?.integrations?.apify?.accessToken),
      enabled: updatedProfile?.integrations?.apify?.enabled || false,
    },
    aiProviders: {
      defaultProvider: aiProviderSettings.defaultProvider || null,
      defaultModel: aiProviderSettings.defaultModel,
      providers: {
        gemini: {
          accessToken: maskApiKey(aiProviderSettings.providers?.gemini?.accessToken),
          enabled: aiProviderSettings.providers?.gemini?.enabled || false,
        },
        openrouter: {
          accessToken: maskApiKey(aiProviderSettings.providers?.openrouter?.accessToken),
          enabled: aiProviderSettings.providers?.openrouter?.enabled || false,
        },
        ollama: {
          baseUrl: aiProviderSettings.providers?.ollama?.baseUrl || 'http://localhost:11434',
          enabled: aiProviderSettings.providers?.ollama?.enabled || false,
        },
      },
    },
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
  const userId = req.user._id.toString();
  const service = req.params.service;

  if (service !== 'gemini' && service !== 'apify' && service !== 'openrouter' && service !== 'ollama') {
    throw new ValidationError('Invalid service. Must be "gemini", "apify", "openrouter", or "ollama"');
  }

  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  // Remove the key
  if (service === 'gemini') {
    // Clear both legacy integrations AND AI provider settings for gemini
    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'integrations.gemini.accessToken': null,
          'integrations.gemini.enabled': false,
          'aiProviderSettings.providers.gemini.accessToken': null,
          'aiProviderSettings.providers.gemini.enabled': false,
        },
      }
    );
  } else if (service === 'apify') {
    // Legacy integrations
    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'integrations.apify.accessToken': null,
          'integrations.apify.enabled': false,
        },
      }
    );
  } else if (service === 'openrouter') {
    // AI provider settings
    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'aiProviderSettings.providers.openrouter.accessToken': null,
          'aiProviderSettings.providers.openrouter.enabled': false,
        },
      }
    );
  } else if (service === 'ollama') {
    // AI provider settings
    await Profile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'aiProviderSettings.providers.ollama.baseUrl': 'http://localhost:11434',
          'aiProviderSettings.providers.ollama.enabled': false,
        },
      }
    );
  }

  res.json({
    message: `${service} API key deleted successfully`,
  });
}));

/**
 * Get available models for a specific provider
 */
router.get('/models/:provider', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.user._id) {
    throw new ValidationError('User not authenticated');
  }
  const userId = req.user._id.toString();
  const providerName = req.params.provider;

  // Import here to avoid circular dependencies
  const { ProviderRegistry } = await import('../providers/registry');
  const { AIProviderHelper } = await import('../providers/enums');

  try {
    const provider = AIProviderHelper.fromString(providerName);
    const strategy = ProviderRegistry.get(provider);

    if (!strategy) {
      throw new ValidationError(`Provider ${providerName} is not available`);
    }

    const models = await strategy.getModels(userId);
    res.json({ models });
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to get models for provider ${providerName}: ${error.message}`);
  }
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

