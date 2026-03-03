// server/src/config/env.ts
// This file MUST be imported first to ensure environment variables are loaded
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to find .env file in multiple locations
const possibleEnvPaths = [
    path.resolve(__dirname, '..', '..', '.env'),     // From src/config/ go up to server/
    path.resolve(process.cwd(), '.env'),              // Current working directory
    path.resolve(process.cwd(), 'server', '.env'),    // Monorepo root/server/
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`Loaded .env from: ${envPath}`);
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    // In production (e.g., Heroku), environment variables come from Config Vars, not .env files
    // Only log a warning, don't crash - the env vars may already be set by the platform
    console.warn('No .env file found. Using environment variables from the platform.', possibleEnvPaths);
}

// Export validated environment variables
export const env = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRY: process.env.JWT_EXPIRY || '1d',
    MONGODB_URI: process.env.MONGODB_URI,
    PORT: process.env.PORT || '5001',
    NODE_ENV: process.env.NODE_ENV || 'development',
    FRONTEND_URL: process.env.FRONTEND_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    // Google OAuth (for Calendar integration)
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    GOOGLE_LOGIN_REDIRECT_URI: process.env.GOOGLE_LOGIN_REDIRECT_URI,
    // SMTP (for password reset emails — Gmail App Password recommended)
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
    STRIPE_PRICE_PREMIUM: process.env.STRIPE_PRICE_PREMIUM,
};
