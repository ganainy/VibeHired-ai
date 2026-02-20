import { Response } from 'express';
import { ValidatedRequest } from '../middleware/validateRequest';
import { AuthorizationError } from '../utils/errors/AppError';
import { generateQuestions, evaluateAnswer } from '../services/interviewService';

/**
 * POST /api/interview/:jobId/questions
 * Generate mock interview questions for a job application.
 */
export const generateInterviewQuestions = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const questions = await generateQuestions(userId, jobId);

    res.json({ questions });
};

/**
 * POST /api/interview/:jobId/evaluate
 * Evaluate a candidate answer against an interview question.
 */
export const evaluateInterviewAnswer = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const { question, answer } = req.body as { question: string; answer: string };

    if (!question || typeof question !== 'string' || !question.trim()) {
        throw new Error('question is required');
    }
    if (!answer || typeof answer !== 'string' || !answer.trim()) {
        throw new Error('answer is required');
    }

    const evaluation = await evaluateAnswer(userId, jobId, question.trim(), answer.trim());
    res.json(evaluation);
};
