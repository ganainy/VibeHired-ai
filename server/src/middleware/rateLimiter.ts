import rateLimit from 'express-rate-limit';

/**
 * Standard rate limiter for sensitive authentication routes.
 * 5 attempts per window (15 mins) for things like signup/login.
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per window
    message: {
        message: 'Too many authentication attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter limiter for password reset requests to prevent spam.
 */
export const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 reset requests per hour
    message: {
        message: 'Too many password reset requests. Please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Limiter for email verification resending.
 */
export const emailVerificationLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, // Limit each IP to 5 requests per 30 mins
    message: {
        message: 'Too many verification email requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
