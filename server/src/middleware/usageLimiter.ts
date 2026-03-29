import { Request, Response, NextFunction, RequestHandler } from 'express';
import { hasCredits, consumeCredits } from '../services/creditService';
import { CreditActionType, CREDIT_WEIGHTS } from '../constants/plans';
import { IUser } from '../models/User';
import Profile from '../models/Profile';
import { checkAiRateLimit } from './aiRateLimiter';
import { PlanType } from '../constants/plans';
import { setCreditUsed } from '../services/requestContext';

/**
 * Middleware to check and consume user credits for AI actions.
 * Also enforces per-user velocity limits via the AI rate limiter.
 * No role-based bypass — all users (including admin/owner) are subject to the same rules.
 * @param actionType - The type of AI action being performed.
 */
export function usageLimiter(actionType: CreditActionType): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        console.log(`[UsageLimiter] START for action: ${actionType}`);
        try {
            const user = req.user as IUser | undefined;
            if (!user) {
                res.status(401).json({ message: 'Authentication required' });
                return;
            }

            const userId = (user._id as any).toString();

            // Step 1: Per-user velocity rate limit check (applies to all roles)
            const rateResult = checkAiRateLimit(userId, user.plan as PlanType | undefined);
            if (!rateResult.allowed) {
                res.status(429).json({
                    error: 'Too many AI requests. Please slow down and try again shortly.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: rateResult.retryAfter,
                });
                return;
            }

            // Step 2: Check email verification
            if (!user.emailVerified) {
                res.status(403).json({
                    error: 'Please verify your email to use AI features',
                    code: 'EMAIL_NOT_VERIFIED'
                });
                return;
            }

            // Step 3: Calculate dynamic weight if needed
            let customWeight: number | undefined;
            if (actionType === 'autoJobsWorkflow') {
                const profile = await Profile.findOne({ userId });
                const maxJobs = profile?.autoJobSettings?.maxJobs || 100;
                const baseFee = CREDIT_WEIGHTS.autoJobsBaseFee as number;
                const perJobCost = CREDIT_WEIGHTS.autoJobsWorkflow as number;
                customWeight = baseFee + (maxJobs * perJobCost);
                console.log(`[UsageLimiter] Dynamic weight for autoJobsWorkflow: ${customWeight} (Base: ${baseFee}, Jobs: ${maxJobs} @ ${perJobCost} each)`);
            }

            // Step 4: Check credit balance
            const hasEnough = await hasCredits(userId, actionType, customWeight);
            if (!hasEnough) {
                res.status(429).json({
                    error: 'Monthly credit limit reached',
                    code: 'CREDITS_EXHAUSTED',
                    upgrade: true
                });
                return;
            }

            const creditForThisRequest = customWeight !== undefined
                ? customWeight
                : Number(CREDIT_WEIGHTS[actionType]);
            setCreditUsed(creditForThisRequest);

            // Step 5: Consume credits on successful response only
            res.on('finish', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const weightLabel = customWeight !== undefined ? `${customWeight} (dynamic)` : actionType;
                    console.log(`[UsageLimiter] SUCCESS: Status ${res.statusCode}. Consuming ${weightLabel} credits for ${user.email}`);
                    consumeCredits(userId, actionType, undefined, false, customWeight)
                        .then(result => {
                            console.log(`[UsageLimiter] Credit result:`, result);
                        })
                        .catch(err => {
                            console.error(`[UsageLimiter] CRITICAL: Failed to consume credits for user ${userId}, action ${actionType}:`, err);
                        });
                } else {
                    console.log(`[UsageLimiter] SKIPPING: Status ${res.statusCode} is not 2xx.`);
                }
            });

            next();
        } catch (error) {
            console.error('Usage limiter error:', error);
            next(error);
        }
    };
}

