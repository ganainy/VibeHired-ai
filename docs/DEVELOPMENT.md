# Development Setup

This guide covers running VibeHired locally for development.

For deployment to Heroku and Netlify see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Prerequisites

- Node.js (v18+ recommended)
- npm (v7+)
- MongoDB (Atlas account or local installation)

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd job-app-assistant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   - Copy `env.example` from the root directory to `server/.env`
   - Add the required values:
     ```env
     # MongoDB Connection String (Required)
     MONGODB_URI=<your_mongodb_connection_string>

     # JWT Secret Key (Required)
     # Generate with: openssl rand -base64 32
     JWT_SECRET=<your_strong_random_secret_string>

     # Encryption Key for API Keys (Required)
     # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ENCRYPTION_KEY=<your_encryption_key>

     # Google Gemini API Key (Required for AI features)
     # Get your key at: https://makersuite.google.com/app/apikey
     GEMINI_API_KEY=<your_gemini_api_key>

     # Apify API Key (Optional — required for LinkedIn profile scraping)
     # Get your token at: https://console.apify.com/account/integrations
     APIFY_API_KEY=<your_apify_token>

     # SMTP Email (Required for password-reset and verification emails)
     # Recommended: Gmail with a Google App Password
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=<your_gmail_address>
     SMTP_PASS=<your_16_char_google_app_password>

     # Cloudinary (Optional — for persistent profile images)
     CLOUDINARY_CLOUD_NAME=<your_cloud_name>
     CLOUDINARY_API_KEY=<your_api_key>
     CLOUDINARY_API_SECRET=<your_api_secret>
     ```
   - Deployment/frontend variables you will likely also need:
     ```env
     # Backend CORS allow-list; supports comma-separated origins
     FRONTEND_URL=<your_frontend_origin_or_csv_list>

     # Frontend API base (set in Netlify/Vite environment)
     VITE_BACKEND_URL=<your_backend_api_base>

     # Optional payments rollout flag (frontend)
     # false = hide Stripe upgrade CTAs and show "coming soon" messaging
     VITE_PAYMENTS_ENABLED=false

     # Optional AI Interview Buddy companion app download URL (frontend)
     VITE_COMPANION_DOWNLOAD_URL=<your_download_url>
     ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```
   This starts both:
   - Backend server (nodemon on port 5001)
   - Frontend server (Vite on port 5173)

5. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5001/api`

## First Time Setup

After starting the application:

1. Register a new account (email verification will be sent)
2. Verify your email address via the verification link
3. Complete the 4-step onboarding wizard:
   - Welcome to VibeHired
   - Upload your CV (AI will parse it automatically)
   - Set job preferences
   - Feature tour
4. AI features are available once `GEMINI_API_KEY` is set in `server/.env`
5. Optionally add `APIFY_API_KEY` in `server/.env` for LinkedIn profile synchronization
6. Optionally add a **GitHub Token** in the Portfolio Setup page for higher GitHub API rate limits

## Environment Variable Reference

See [`env.example`](../env.example) for a full annotated list of every supported environment variable, including optional integrations (Google OAuth, SMTP email, Stripe, Apify).
