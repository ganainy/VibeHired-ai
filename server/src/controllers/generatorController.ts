import { Request, Response } from 'express';
import { ValidatedRequest } from '../middleware/validateRequest';
import { ValidationError, InternalServerError } from '../utils/errors/AppError';
import { improveSectionWithAi, applyAtsSuggestionWithAi } from '../services/generatorService';

export const applyAtsSuggestion = async (req: ValidatedRequest, res: Response) => {
    if (!req.user) {
        throw new ValidationError('User not authenticated');
    }

    const { cvJson, suggestions, jobDescription } = req.validated!.body!;
    const userId = String(req.user._id);

    if (!cvJson || !suggestions || suggestions.length === 0) {
        throw new ValidationError('CV data and at least one suggestion are required');
    }

    try {
        const updatedCv = await applyAtsSuggestionWithAi(userId, cvJson, suggestions, jobDescription);
        res.json({ cvJson: updatedCv });
    } catch (error: any) {
        console.error('Error in applyAtsSuggestion:', error);
        throw new InternalServerError(error.message || 'Failed to apply ATS suggestions');
    }
};

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

