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
    CreateMaterialDto,
    UpdateMaterialDto,
} from '../services/interviewMaterialService';

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
