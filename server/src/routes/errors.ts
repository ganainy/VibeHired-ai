import express, { Router, RequestHandler } from 'express';
import * as errorLogController from '../controllers/errorLogController';

const router: Router = express.Router();

/**
 * POST /api/errors
 * Report an error (public endpoint for frontend error capture)
 */
router.post('/', errorLogController.createErrorLog as RequestHandler);

export default router;
