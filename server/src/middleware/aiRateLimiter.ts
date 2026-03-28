/**
 * Per-user AI velocity rate limiter.
 *
 * Prevents individual users from hammering AI endpoints within a short window,
 * independent of their credit budget. Limits are plan-tiered but apply to ALL
 * roles — no admin or owner bypass.
 *
 * The store is an in-memory Map which is sufficient for a single-process server.
 * If the app is scaled horizontally, swap the store for a Redis-backed one.
 */
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { IUser } from '../models/User';
import { AI_RATE_LIMITS, PlanType } from '../constants/plans';

interface RateLimitEntry {
    count: number;
    resetAt: number; // unix ms
}

// Module-level store shared across all middleware invocations in the same process
const store = new Map<string, RateLimitEntry>();

// Periodically prune expired entries every 15 minutes to prevent unbounded growth
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}, 15 * 60 * 1000).unref(); // .unref() so it doesn't prevent process exit

/**
 * Check then increment the rate limit counter for a user.
 * Returns `allowed: true` when the request is within limits.
 * Returns `allowed: false` with a `retryAfter` seconds value when exceeded.
 */
export function checkAiRateLimit(
    userId: string,
    plan: PlanType | undefined
): { allowed: boolean; retryAfter?: number } {
    const tier = (plan || 'free') as PlanType;
    const limits = AI_RATE_LIMITS[tier] ?? AI_RATE_LIMITS.free;
    const now = Date.now();

    const existing = store.get(userId);

    console.log(`[aiRateLimiter] userId: ${userId.slice(0, 8)}..., plan: ${tier}, window: ${limits.windowMs}ms, max: ${limits.max}`);
    console.log(`[aiRateLimiter] existing:`, existing ? `count: ${existing.count}, resetAt: ${new Date(existing.resetAt).toISOString()}` : 'none');

    if (!existing || now > existing.resetAt) {
        // First request in a new window
        store.set(userId, { count: 1, resetAt: now + limits.windowMs });
        console.log(`[aiRateLimiter] New window started. count: 1, resetAt: ${new Date(now + limits.windowMs).toISOString()}`);
        return { allowed: true };
    }

    if (existing.count >= limits.max) {
        const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
        console.log(`[aiRateLimiter] BLOCKED - count: ${existing.count} >= max: ${limits.max}, retryAfter: ${retryAfter}s`);
        return { allowed: false, retryAfter };
    }

    existing.count++;
    console.log(`[aiRateLimiter] ALLOWED - count incremented to: ${existing.count}`);
    return { allowed: true };
}

/**
 * Standalone Express middleware version.
 * Can be applied directly on a router or individual route if needed.
 * Requires `authMiddleware` to have run first so that `req.user` is populated.
 */
export function aiRateLimiter(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user as IUser | undefined;
        if (!user) {
            // Let the auth middleware handle unauthenticated requests
            return next();
        }

        const userId = (user._id as any).toString();
        const result = checkAiRateLimit(userId, user.plan as PlanType | undefined);

        if (!result.allowed) {
            res.status(429).json({
                error: 'Too many AI requests. Please slow down and try again shortly.',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: result.retryAfter,
            });
            return;
        }

        next();
    };
}
