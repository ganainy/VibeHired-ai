import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { aiRateLimiter } from '../middleware/aiRateLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { generateInterviewQuestions, evaluateInterviewAnswer, answerInterviewQuestion, initializeSession, streamAnswer } from '../controllers/interviewController';

const router: Router = express.Router();

// All interview routes require authentication
router.use(authMiddleware);

// POST /api/interview/:jobId/questions — generate interview questions
router.post('/:jobId/questions', usageLimiter('interviewGenerateQuestions'), asyncHandler(generateInterviewQuestions));

// POST /api/interview/:jobId/evaluate — evaluate a candidate answer
router.post('/:jobId/evaluate', usageLimiter('interviewEvaluate'), asyncHandler(evaluateInterviewAnswer));

// POST /api/interview/:jobId/answer-question — generate live answer for Interview Buddy (legacy, non-streaming)
router.post('/:jobId/answer-question', usageLimiter('interviewAnswer'), asyncHandler(answerInterviewQuestion));

// POST /api/interview/:jobId/initialize-session — pre-warm a Gemini chat session with CV + job context
router.post('/:jobId/initialize-session', aiRateLimiter(), asyncHandler(initializeSession));

// POST /api/interview/:jobId/stream-interview-buddy-answer — stream an AI answer via SSE
router.post('/:jobId/stream-interview-buddy-answer', usageLimiter('interviewStreamAnswer'), asyncHandler(streamAnswer));

// Legacy alias kept for backward compatibility with older clients
router.post('/:jobId/stream-answer', usageLimiter('interviewStreamAnswer'), asyncHandler(streamAnswer));

export default router;
