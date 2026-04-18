import { Request, Response } from 'express';
import { ValidatedRequest } from '../middleware/validateRequest';
import { ValidationError, InternalServerError } from '../utils/errors/AppError';
import { improveSectionWithAi } from '../services/generatorService';

export const improveCvSection = async (req: ValidatedRequest, res: Response) => {
    if (!req.user) {
        throw new ValidationError('User not authenticated');
    }

    const { sectionName, sectionData, customInstructions } = req.validated!.body!;
    const userId = String(req.user._id);

    if (!sectionName || !sectionData) {
        throw new ValidationError('Section name and section data are required');
    }

    try {
        const improvedData = await improveSectionWithAi(userId, sectionName, sectionData, customInstructions);
        res.json(improvedData);
    } catch (error: any) {
        console.error('Error in improveCvSection:', error);
        throw new InternalServerError(error.message || 'Failed to improve CV section');
    }
};
