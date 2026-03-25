// server/src/controllers/sharedMaterialController.ts
import { Response } from 'express';
import { getMaterialByShareToken } from '../services/interviewMaterialService';
import { NotFoundError } from '../utils/errors/AppError';

/**
 * GET /api/shared/:token
 * Get a material by share token (public access, no auth required)
 */
export const getSharedMaterial = async (req: any, res: Response) => {
    const { token } = req.params;

    const material = await getMaterialByShareToken(token);
    if (!material) {
        throw new NotFoundError('Shared material not found or link has expired');
    }

    // Return the material with share URL info
    res.json({ material });
};
