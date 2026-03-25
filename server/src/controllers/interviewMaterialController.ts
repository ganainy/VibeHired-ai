// server/src/controllers/interviewMaterialController.ts
import { Response } from 'express';
import { ValidatedRequest } from '../middleware/validateRequest';
import { AuthorizationError } from '../utils/errors/AppError';
import {
    getMaterialsByJob,
    getGlobalMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    shareMaterial as shareMaterialService,
    unshareMaterial as unshareMaterialService,
    CreateMaterialDto,
    UpdateMaterialDto,
} from '../services/interviewMaterialService';
import Profile from '../models/Profile';
import { generateContent } from '../utils/aiService';

/**
 * GET /api/interview-materials?jobId=:id
 * Returns all materials for a specific job application.
 */
export const listByJob = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.query as { jobId?: string };
    if (!jobId) {
        res.status(400).json({ message: 'jobId query param is required' });
        return;
    }

    const materials = await getMaterialsByJob(userId, jobId);
    res.json({ materials });
};

/**
 * GET /api/interview-materials/global
 * Returns all globally-shared materials for the user grouped by job.
 */
export const listGlobal = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const materials = await getGlobalMaterials(userId);
    res.json({ materials });
};

/**
 * POST /api/interview-materials
 * Create a new material (file upload via multipart, or JSON for text/link).
 */
export const create = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const body = req.body as CreateMaterialDto;

    if (!body.title || !body.title.trim()) {
        res.status(400).json({ message: 'title is required' });
        return;
    }

    // Validate non-file types have required fields
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
        if (!body.type) {
            res.status(400).json({ message: 'type is required for non-file materials' });
            return;
        }
        if ((body.type === 'text' || body.type === 'markdown') && !body.content) {
            res.status(400).json({ message: 'content is required for text/markdown materials' });
            return;
        }
        if (body.type === 'link' && !body.url) {
            res.status(400).json({ message: 'url is required for link materials' });
            return;
        }
    }

    const material = await createMaterial(userId, body, file);
    res.status(201).json({ material });
};

/**
 * PATCH /api/interview-materials/:id
 * Update title, description, content, url, or isGlobal.
 */
export const update = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { id } = req.params;
    const dto = req.body as UpdateMaterialDto;

    const material = await updateMaterial(userId, id, dto);
    res.json({ material });
};

/**
 * DELETE /api/interview-materials/:id
 * Delete the material and remove its Cloudinary asset if applicable.
 */
export const remove = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { id } = req.params;
    await deleteMaterial(userId, id);
    res.status(204).send();
};

/**
 * POST /api/interview-materials/generate-title
 * Generate a title for a learning material using AI.
 */
export const generateTitle = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { type, content, description } = req.body;

    if (!type) {
        res.status(400).json({ message: 'type is required' });
        return;
    }

    // Build context based on material type
    let context = '';
    if (type === 'file') {
        context = 'Generate a concise, descriptive title for a learning material file. The title should be 3-8 words long and clearly indicate what the material covers.';
    } else if (type === 'text') {
        context = `Generate a concise, descriptive title for a learning material with the following content:\n\n${content || '(No content provided)'}\n\nThe title should be 3-8 words long and summarize the main topic.`;
    } else if (type === 'markdown') {
        context = `Generate a concise, descriptive title for a learning material with the following markdown content:\n\n${content || '(No content provided)'}\n\nThe title should be 3-8 words long and summarize the main topic.`;
    } else if (type === 'link') {
        context = `Generate a concise, descriptive title for a learning material link${description ? ` with the following description: ${description}` : ''}.\n\nThe title should be 3-8 words long and indicate what the linked resource covers.`;
    } else {
        context = 'Generate a concise, descriptive title for a learning material. The title should be 3-8 words long.';
    }

    const systemPrompt = `You are an AI assistant helping to name learning materials for interview preparation.
${context}

Return ONLY the title as a plain string, no quotes, no markdown formatting.`;

    try {
        const result = await generateContent(userId, systemPrompt);
        const title = result.text.trim();
        res.json({ title });
    } catch (e: any) {
        res.status(500).json({ message: `Failed to generate title: ${e.message}` });
    }
};

/**
 * POST /api/interview-materials/:id/share
 * Generate a share token for a material, making it publicly accessible.
 */
export const shareMaterial = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { id } = req.params;

    const material = await shareMaterialService(userId, id);
    const shareUrl = `/shared/${material.shareToken}`;
    res.json({ 
        material,
        shareUrl,
        message: 'Material is now shared. Anyone with the link can view it.'
    });
};

/**
 * DELETE /api/interview-materials/:id/share
 * Remove the share token, revoking public access.
 */
export const unshareMaterial = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { id } = req.params;

    const material = await unshareMaterialService(userId, id);
    res.json({ 
        material,
        message: 'Sharing has been revoked. The material is no longer publicly accessible.'
    });
};
