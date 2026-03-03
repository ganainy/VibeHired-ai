import express, { Router, Request, Response, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getUsageRecord, grantBonusCredits } from '../services/creditService';
import { isAdmin } from '../middleware/adminMiddleware';
import { asyncHandler } from '../utils/asyncHandler';
import { IUser } from '../models/User';

const router: Router = express.Router();

// Apply auth to all usage routes
router.use(authMiddleware as RequestHandler);

/**
 * GET /api/usage
 * Get current user's usage and credit status
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const userId = (user._id as any).toString();
    const usage = await getUsageRecord(userId);

    res.json({
        usage: {
            creditsUsed: usage.credits.used,
            creditLimit: usage.credits.limit,
            remaining: Math.max(0, usage.credits.limit - usage.credits.used),
            billingPeriodEnd: usage.billingPeriodEnd,
            plan: user.plan,
            role: user.role,
            emailVerified: user.emailVerified
        },
        actions: usage.actions,
        history: usage.history.slice(-10).reverse() // Last 10 events
    });
}));

/**
 * POST /api/usage/admin/grant-bonus
 * Admin only: Grant bonus credits to a user
 */
router.post('/admin/grant-bonus', isAdmin, asyncHandler(async (req: Request, res: Response) => {
    const { userId, amount, reason } = req.body;

    if (!userId || !amount || typeof amount !== 'number') {
        res.status(400).json({ message: 'userId and amount (number) are required.' });
        return;
    }

    const usage = await grantBonusCredits(userId, amount, reason || 'Admin bonus');

    res.json({
        message: `Successfully granted ${amount} bonus credits.`,
        newTotal: usage.credits.limit
    });
}));

export default router;
