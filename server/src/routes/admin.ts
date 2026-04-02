import express, { Router, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import * as adminController from '../controllers/adminController';
import * as errorLogController from '../controllers/errorLogController';

const router: Router = express.Router();

// All admin routes require authentication and admin/owner role
router.use(authMiddleware as RequestHandler);
router.use(isAdmin);

/**
 * GET /api/admin/stats
 * Get system-wide metrics
 */
router.get('/stats', adminController.getAdminStats as RequestHandler);

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', adminController.getUsers as RequestHandler);

/**
 * GET /api/admin/users/:userId
 * Get specific user detail with usage
 */
router.get('/users/:userId', adminController.getUserDetail as RequestHandler);

/**
 * GET /api/admin/users/:userId/cvs
 * Get base CV library summaries for a user
 */
router.get('/users/:userId/cvs', adminController.getUserCvLibrary as RequestHandler);

/**
 * GET /api/admin/users/:userId/cvs/:cvId
 * Get base CV detail for template preview
 */
router.get('/users/:userId/cvs/:cvId', adminController.getUserCvDetail as RequestHandler);

/**
 * GET /api/admin/users/:userId/cvs/:cvId/preview
 * Generate PDF preview for original/current CV snapshot
 */
router.get('/users/:userId/cvs/:cvId/preview', adminController.getUserCvPreview as RequestHandler);

/**
 * PATCH /api/admin/users/:userId/role
 * Update user role
 */
router.patch('/users/:userId/role', adminController.updateUser as RequestHandler);

/**
 * PATCH /api/admin/users/:userId/plan
 * Update user plan
 */
router.patch('/users/:userId/plan', adminController.updateUser as RequestHandler);

/**
 * POST /api/admin/users/:userId/credits
 * Grant bonus credits
 */
router.post('/users/:userId/credits', adminController.adminGrantBonus as RequestHandler);

/**
 * PATCH /api/admin/users/:userId
 * Block or unblock a user
 */
router.patch('/users/:userId', adminController.setUserBlocked as RequestHandler);

/**
 * DELETE /api/admin/users/:userId/subscription
 * Cancel a user's Stripe subscription and revert them to free plan
 */
router.delete('/users/:userId/subscription', adminController.cancelUserSubscription as RequestHandler);

/**
 * GET /api/admin/errors/stats
 * Get error statistics
 */
router.get('/errors/stats', errorLogController.getErrorStats as RequestHandler);

/**
 * GET /api/admin/errors
 * List error logs with pagination and filters
 */
router.get('/errors', errorLogController.getErrorLogs as RequestHandler);

/**
 * GET /api/admin/errors/:errorId
 * Get specific error log
 */
router.get('/errors/:errorId', errorLogController.getErrorLogById as RequestHandler);

/**
 * PATCH /api/admin/errors/:errorId/resolve
 * Resolve an error
 */
router.patch('/errors/:errorId/resolve', errorLogController.resolveErrorLog as RequestHandler);

/**
 * POST /api/admin/errors/bulk-resolve
 * Bulk resolve errors
 */
router.post('/errors/bulk-resolve', errorLogController.bulkResolveErrors as RequestHandler);

/**
 * DELETE /api/admin/errors/:errorId
 * Delete an error log
 */
router.delete('/errors/:errorId', errorLogController.deleteErrorLog as RequestHandler);

export default router;
