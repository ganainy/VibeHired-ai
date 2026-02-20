import express, { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { generateInterviewQuestions, evaluateInterviewAnswer } from '../controllers/interviewController';

const router: Router = express.Router();

// All interview routes require authentication
router.use(authMiddleware);

// POST /api/interview/:jobId/questions — generate interview questions
router.post('/:jobId/questions', asyncHandler(generateInterviewQuestions));

// POST /api/interview/:jobId/evaluate — evaluate a candidate answer
router.post('/:jobId/evaluate', asyncHandler(evaluateInterviewAnswer));

export default router;
