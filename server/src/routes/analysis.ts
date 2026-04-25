import express, { Router } from 'express';
import { analyzeCv, getAnalysisResults, generateImprovement, deleteAnalysis, analyzeAllCvSections } from '../controllers/analysisController';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import { asyncHandler } from '../utils/asyncHandler';
import { validateRequest } from '../middleware/validateRequest';
import { analyzeCvBodySchema, improveSectionParamsSchema, improveSectionBodySchema, analyzeAllCvSectionsBodySchema } from '../validations/analysisSchemas';
import { analysisIdParamSchema } from '../validations/commonSchemas';

const router: Router = express.Router();

// Protect all routes with authentication
router.use(authMiddleware);

// Analysis routes - wrapped with asyncHandler to automatically catch errors
router.post('/analyze', usageLimiter('analysis'), validateRequest({ body: analyzeCvBodySchema }), asyncHandler(analyzeCv));
router.post('/analyze-all-sections', usageLimiter('analysis'), validateRequest({ body: analyzeAllCvSectionsBodySchema }), asyncHandler(analyzeAllCvSections));
router.get('/:id', validateRequest({ params: analysisIdParamSchema }), asyncHandler(getAnalysisResults));
router.post('/:id/improve/:section', usageLimiter('analysis'), validateRequest({ params: improveSectionParamsSchema, body: improveSectionBodySchema }), asyncHandler(generateImprovement));
router.delete('/:id', validateRequest({ params: analysisIdParamSchema }), asyncHandler(deleteAnalysis));

export default router;
