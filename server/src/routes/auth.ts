// server/src/routes/auth.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User'; // Import User model
import { validateRequest } from '../middleware/validateRequest';
import { registerBodySchema, loginBodySchema, forgotPasswordBodySchema, resetPasswordBodySchema } from '../validations/authSchemas';
import { ValidatedRequest } from '../middleware/validateRequest';
import authMiddleware from '../middleware/authMiddleware';
import { env } from '../config/env';
import { getPrimaryFrontendUrl } from '../config/frontend';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/emailService';
import * as MailChecker from 'mailchecker';
import dns from 'dns/promises';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const disposableEmailDomains: string[] = require('disposable-email-domains');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isEmailBurner } = require('burner-email-providers') as { isEmailBurner: (email: string) => boolean };
import { authRateLimiter, passwordResetLimiter, emailVerificationLimiter } from '../middleware/rateLimiter';

const router: Router = express.Router();

// --- Environment Variable for JWT Secret ---
// IMPORTANT: Set this in your server/.env file!
// Using lazy evaluation to allow .env to load first
let _cachedJwtSecret: string | null = null;
const getJwtSecret = (): string => {
    if (_cachedJwtSecret) {
        return _cachedJwtSecret;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
        process.exit(1);
    }
    _cachedJwtSecret = secret;
    return secret;
};

// JWT_SECRET is now accessed via the getter function, not evaluated at module load
const JWT_EXPIRY: string = process.env.JWT_EXPIRY || '1d'; // Default to 1 day expiry

// --- Registration Route ---
// POST /api/auth/register
router.post('/register', authRateLimiter, validateRequest({ body: registerBodySchema }), async (req: ValidatedRequest, res: Response) => {
    const { email, password, username } = req.validated!.body!;

    try {
        // Check if user already exists by email
        const existingUserByEmail = await User.findOne({ email });
        if (existingUserByEmail) {
            res.status(400).json({ message: 'User with this email already exists.' });
            return;
        }

        // Check if username is already taken
        const existingUserByUsername = await User.findOne({ username });
        if (existingUserByUsername) {
            res.status(400).json({ message: 'Username is already taken. Please choose a different username.' });
            return;
        }

        // Multi-layer disposable email check:
        //   1. mailchecker npm package
        //   2. disposable-email-domains npm package
        //   3. burner-email-providers npm package
        //   4. disposable.debounce.io API (if static checks pass)
        //   5. DNS MX record verification (ensures the domain can actually receive mail)
        // Parent-domain scanning covers subdomains (e.g. sub.mailinator.com).
        const emailDomain = email.split('@')[1].toLowerCase();
        const domainParts = emailDomain.split('.');
        let isDisposable = !MailChecker.isValid(email)
            || disposableEmailDomains.includes(emailDomain)
            || isEmailBurner(email);

        if (!isDisposable) {
            for (let i = 1; i < domainParts.length - 1; i++) {
                const parentDomain = domainParts.slice(i).join('.');
                if (!MailChecker.isValid(`check@${parentDomain}`)
                    || disposableEmailDomains.includes(parentDomain)
                    || isEmailBurner(`check@${parentDomain}`)) {
                    isDisposable = true;
                    break;
                }
            }
        }

        // debounce.io API check — runs only if all static package checks pass.
        if (!isDisposable) {
            try {
                const debounceRes = await fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(4000) });
                if (debounceRes.ok) {
                    const data = await debounceRes.json() as { disposable: string };
                    if (data.disposable === 'true') {
                        isDisposable = true;
                    }
                }
            } catch {
                // API unreachable or timed out — fall through to DNS check.
            }
        }

        // DNS MX check — if the domain has no MX records it can never receive mail.
        if (!isDisposable) {
            try {
                const mxRecords = await dns.resolveMx(emailDomain);
                if (!mxRecords || mxRecords.length === 0) {
                    isDisposable = true;
                }
            } catch {
                // DNS lookup failed (domain doesn't exist, NXDOMAIN, etc.) — treat as invalid.
                isDisposable = true;
            }
        }

        if (isDisposable) {
            res.status(400).json({ message: 'Registration with temporary or disposable email addresses is not allowed. Please use a permanent email.' });
            return;
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        // Create new user instance
        const newUser = new User({
            email,
            username,
            passwordHash: password,
            emailVerificationToken: hashedVerificationToken,
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            emailVerified: false,
        });

        // Save the user (triggers pre-save hook)
        await newUser.save();

        // Send verification email
        const frontendUrl = getPrimaryFrontendUrl();
        const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

        let emailSendFailed = false;
        try {
            await sendVerificationEmail(email, verificationUrl);
        } catch (emailErr) {
            console.error('Failed to send verification email during register:', emailErr);
            emailSendFailed = true;
        }

        res.status(201).json({
            message: emailSendFailed
                ? 'Account created, but we could not send the verification email. Please use the resend option on the sign-in page.'
                : 'Account created! Please check your email to verify your account.',
            requiresVerification: true,
            emailSendFailed,
            registeredEmail: email,
        });

    } catch (error) {
        console.error("Registration Error:", error);
        if (error instanceof Error && error.name === 'ValidationError') {
            // Extract specific validation messages if needed
            res.status(400).json({ message: 'Registration validation failed', errors: error.message });
            return;
        }
        res.status(500).json({ message: 'Server error during registration.' });
    }
});


// --- Login Route ---
// POST /api/auth/login
router.post('/login', authRateLimiter, validateRequest({ body: loginBodySchema }), async (req: ValidatedRequest, res: Response) => {
    const { email, password } = req.validated!.body!;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials.' }); // Use generic message
            return;
        }

        // Compare provided password with the stored hash
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' }); // Use generic message
            return;
        }

        // Check if user is blocked
        if ((user as any).isBlocked) {
            res.status(403).json({ message: 'Your account has been suspended. Please contact support.' });
            return;
        }

        // --- Generate JWT ---
        const payload: { userId: string; email: string } = {
            userId: String(user._id),
            email: user.email,
            // Add other relevant non-sensitive info if needed (e.g., roles)
        };

        const token = jwt.sign(
            payload,
            getJwtSecret(),
            { expiresIn: JWT_EXPIRY as any }
        );

        // Send token back to client
        res.status(200).json({
            message: 'Login successful',
            token: token,
            user: { // Send back some user info (excluding password hash!)
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                plan: user.plan,
                emailVerified: user.emailVerified
            }
        });

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});


// --- Get Current User Profile Route ---
// GET /api/auth/me
router.get('/me', authMiddleware as RequestHandler, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'User not authenticated.' });
            return;
        }

        // Return user profile data (excluding password hash)
        res.status(200).json({
            id: req.user._id,
            email: req.user.email,
            username: req.user.username,
            role: req.user.role,
            plan: req.user.plan,
            emailVerified: req.user.emailVerified,
            onboardingComplete: req.user.onboardingComplete,
            createdAt: req.user.createdAt,
            updatedAt: req.user.updatedAt,
        });
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ message: 'Server error fetching user profile.' });
    }
});

// Username updates are no longer allowed after registration
// The PUT /api/auth/username endpoint has been removed


// --- Complete Onboarding Route ---
// POST /api/auth/complete-onboarding
router.post('/complete-onboarding', authMiddleware as RequestHandler, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'User not authenticated.' });
            return;
        }
        req.user.onboardingComplete = true;
        await req.user.save({ validateBeforeSave: false });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Complete Onboarding Error:', error);
        res.status(500).json({ message: 'Server error completing onboarding.' });
    }
});


// --- Forgot Password Route ---
// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, validateRequest({ body: forgotPasswordBodySchema }), async (req: ValidatedRequest, res: Response) => {
    const { email } = req.validated!.body!;

    try {
        const user = await User.findOne({ email });

        // Always respond with the same message to prevent user enumeration
        if (!user) {
            res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
            return;
        }

        // Generate a raw random token and store its SHA-256 hash in the DB
        const rawToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await user.save({ validateBeforeSave: false });

        const frontendUrl = getPrimaryFrontendUrl();
        const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

        try {
            await sendPasswordResetEmail(email, resetUrl);
        } catch (emailErr) {
            // Roll back the token if the email fails to send
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });
            console.error('Failed to send reset email:', emailErr);
            res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
            return;
        }

        res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


// --- Reset Password Route ---
// POST /api/auth/reset-password
router.post('/reset-password', validateRequest({ body: resetPasswordBodySchema }), async (req: ValidatedRequest, res: Response) => {
    const { token: rawToken, password } = req.validated!.body!;

    try {
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() }, // Token must not be expired
        });

        if (!user) {
            res.status(400).json({ message: 'Reset token is invalid or has expired.' });
            return;
        }

        // Assign new password (pre-save hook will hash it)
        user.passwordHash = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


// --- Verify Email Route ---
// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
    const { token: rawToken } = req.body;

    if (!rawToken) {
        res.status(400).json({ message: 'Token is required.' });
        return;
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: new Date() },
        });

        if (!user) {
            res.status(400).json({ message: 'Verification token is invalid or has expired.' });
            return;
        }

        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully! You can now use all AI features.' });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


// --- Resend Verification Email ---
// POST /api/auth/resend-verification
// Public endpoint — accepts email in body, rate-limited by IP.
// Uses a uniform response to prevent email enumeration.
router.post('/resend-verification', emailVerificationLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
        res.status(400).json({ message: 'Email address is required.' });
        return;
    }

    const neutralResponse = { message: 'If that account exists and is unverified, a new verification link has been sent.' };

    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        // Always return neutral response to prevent enumeration
        if (!user || user.emailVerified) {
            res.status(200).json(neutralResponse);
            return;
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const hashedVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

        user.emailVerificationToken = hashedVerificationToken;
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await user.save();

        const frontendUrl = getPrimaryFrontendUrl();
        const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

        await sendVerificationEmail(user.email, verificationUrl);

        res.status(200).json(neutralResponse);
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


export default router;