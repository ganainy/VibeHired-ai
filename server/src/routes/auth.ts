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
import { sendPasswordResetEmail } from '../utils/emailService';

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
router.post('/register', validateRequest({ body: registerBodySchema }), async (req: ValidatedRequest, res: Response) => {
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

        // Create new user instance - Assign plain password to passwordHash temporarily
        // The pre-save hook in the model will hash it before saving
        const newUser = new User({
            email,
            username,
            passwordHash: password, // Assign plain password here, hook will hash it
        });

        // Save the user (triggers pre-save hook)
        await newUser.save();

        // Don't usually log user in immediately after register, make them log in separately
        res.status(201).json({
            message: 'User registered successfully. Please log in.',
            requiresApiKeys: true
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
router.post('/login', validateRequest({ body: loginBodySchema }), async (req: ValidatedRequest, res: Response) => {
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
                email: user.email
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


// --- Forgot Password Route ---
// POST /api/auth/forgot-password
router.post('/forgot-password', validateRequest({ body: forgotPasswordBodySchema }), async (req: ValidatedRequest, res: Response) => {
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

        const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
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


export default router;