import { Response } from 'express';
import mongoose from 'mongoose';
import { ValidatedRequest } from '../middleware/validateRequest';
import { AuthorizationError } from '../utils/errors/AppError';
import {
  generateQuestions,
  evaluateAnswer,
  generateAnswer,
  initializeInterviewSession,
  streamAnswerToResponse,
} from '../services/interviewService';

function normalizeReferenceMaterialIds(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value
                .filter((id): id is string => typeof id === 'string')
                .map((id) => id.trim())
                .filter(Boolean)
                .slice(0, 30);
}

function normalizeActiveCvId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!mongoose.Types.ObjectId.isValid(trimmed)) return undefined;
    return trimmed;
}

/**
 * POST /api/interview/:jobId/questions
 * Generate mock interview questions for a job application.
 * Accepts optional 'level' parameter: 'first' | 'second'
 */
export const generateInterviewQuestions = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const { level, questionCount } = req.body as { level?: 'first' | 'second'; questionCount?: number };
    const questions = await generateQuestions(userId, jobId, level, questionCount);

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

/**
 * POST /api/interview/:jobId/answer-question
 * Generate a live interview answer for the AI Interview Buddy.
 */
export const answerInterviewQuestion = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const { question, referenceMaterialIds, activeCvId } = req.body as { question: string; referenceMaterialIds?: string[]; activeCvId?: string };

    if (!question || typeof question !== 'string' || !question.trim()) {
        throw new Error('question is required');
    }

    const result = await generateAnswer(
        userId,
        jobId,
        question.trim(),
        normalizeReferenceMaterialIds(referenceMaterialIds),
        normalizeActiveCvId(activeCvId),
    );
    res.json(result);
};

/**
 * POST /api/interview/:jobId/initialize-session
 * Pre-warm a Gemini chat session with CV + job context for fast follow-up answers.
 */
export const initializeSession = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const { referenceMaterialIds, activeCvId } = req.body as { referenceMaterialIds?: string[]; activeCvId?: string };
    const sessionId = await initializeInterviewSession(
        userId,
        jobId,
        normalizeReferenceMaterialIds(referenceMaterialIds),
        normalizeActiveCvId(activeCvId),
    );
    res.json({ sessionId });
};

/**
 * POST /api/interview/:jobId/stream-answer
 * Stream an AI-generated answer using SSE (Server-Sent Events).
 */
export const streamAnswer = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new AuthorizationError('User not authenticated');

    const { jobId } = req.params;
    const { question, referenceMaterialIds, activeCvId } = req.body as { question: string; referenceMaterialIds?: string[]; activeCvId?: string };

    if (!question || typeof question !== 'string' || !question.trim()) {
        throw new Error('question is required');
    }

    await streamAnswerToResponse(
        userId,
        jobId,
        question.trim(),
        res,
        normalizeReferenceMaterialIds(referenceMaterialIds),
        normalizeActiveCvId(activeCvId),
    );
};
