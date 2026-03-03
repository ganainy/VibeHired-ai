import express, { Router } from 'express';
import { scanAts, scanAtsForAnalysis, getAtsScores, getAtsForJob, getLatestAts, deleteAts } from '../controllers/atsController';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { atsScanBodySchema, atsScanParamsSchema, atsScoresParamsSchema } from '../validations/atsSchemas';
import { jobApplicationIdParamSchema } from '../validations/commonSchemas';

const router: Router = express.Router();

// Protect all routes with authentication
router.use(authMiddleware);

// ATS routes
router.post('/scan', usageLimiter('atsScoring'), validateRequest({ body: atsScanBodySchema }), asyncHandler(scanAts));
router.post('/scan/:analysisId', usageLimiter('atsScoring'), validateRequest({ params: atsScanParamsSchema, body: atsScanBodySchema }), asyncHandler(scanAtsForAnalysis));
router.get('/scores/:analysisId', validateRequest({ params: atsScoresParamsSchema }), asyncHandler(getAtsScores));
router.get('/job/:jobApplicationId', validateRequest({ params: jobApplicationIdParamSchema }), asyncHandler(getAtsForJob));
router.get('/latest', asyncHandler(getLatestAts));
router.delete('/:analysisId', validateRequest({ params: atsScoresParamsSchema }), asyncHandler(deleteAts));

export default router;

