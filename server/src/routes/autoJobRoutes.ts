// server/src/routes/autoJobRoutes.ts
import express, { RequestHandler } from 'express';
import * as autoJobController from '../controllers/autoJobController';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Workflow management
router.post('/trigger', usageLimiter('autoJobsWorkflow'), autoJobController.triggerWorkflow as RequestHandler);
router.get('/runs/:runId', autoJobController.getWorkflowStatus as RequestHandler);
router.post('/runs/:runId/cancel', autoJobController.cancelWorkflow as RequestHandler);

// Settings - MUST be before /:id routes to avoid conflicts
router.get('/settings/config', autoJobController.getSettings as RequestHandler);
router.put('/settings/config', autoJobController.updateSettings as RequestHandler);

// Stats - MUST be before /:id to avoid conflict
router.get('/stats', autoJobController.getStats as RequestHandler);

// Auto jobs CRUD
router.get('/', autoJobController.getAutoJobs as RequestHandler);
router.get('/:id', autoJobController.getAutoJobById as RequestHandler);
router.post('/:id/promote', autoJobController.promoteAutoJob as RequestHandler);
router.delete('/:id', autoJobController.deleteAutoJob as RequestHandler);
router.delete('/', autoJobController.deleteAllAutoJobs as RequestHandler);

export default router;


