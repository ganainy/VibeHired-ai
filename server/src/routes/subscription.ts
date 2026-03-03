import express, { Router, Request, Response, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { createCheckoutSession, createPortalSession, syncSubscriptionFromStripe } from '../services/stripeService';
import { PlanType } from '../constants/plans';
import { asyncHandler } from '../utils/asyncHandler';
import { IUser } from '../models/User';

const router: Router = express.Router();

// Apply auth to all subscription routes
router.use(authMiddleware as RequestHandler);

/**
 * POST /api/subscriptions/checkout
 * Create a checkout session for a specific plan
 */
router.post('/checkout', asyncHandler(async (req: Request, res: Response) => {
    const { plan } = req.body as { plan: PlanType };
    const user = req.user as IUser;
    const userId = (user._id as any).toString();

    if (!['starter', 'pro', 'premium'].includes(plan)) {
        res.status(400).json({ message: 'Invalid plan selected' });
        return;
    }

    const url = await createCheckoutSession(userId, plan);
    res.json({ url });
}));

/**
 * POST /api/subscriptions/portal
 * Create a customer portal session for management
 */
router.post('/portal', asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const userId = (user._id as any).toString();
    const url = await createPortalSession(userId);
    res.json({ url });
}));

/**
 * POST /api/subscriptions/sync
 * Verify the user's active Stripe subscription and update their plan in DB.
 * Called by the client after returning from a successful Stripe checkout,
 * as a fallback for when the webhook hasn't fired yet (e.g. local dev).
 */
router.post('/sync', asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as IUser;
    const userId = (user._id as any).toString();
    const plan = await syncSubscriptionFromStripe(userId);
    res.json({ plan: plan ?? user.plan ?? 'free' });
}));

export default router;
