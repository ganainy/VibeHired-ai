import express, { Router, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { isAdmin } from '../middleware/adminMiddleware';
import * as adminController from '../controllers/adminController';

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
 * DELETE /api/admin/users/:userId/subscription
 * Cancel a user's Stripe subscription and revert them to free plan
 */
router.delete('/users/:userId/subscription', adminController.cancelUserSubscription as RequestHandler);

export default router;
