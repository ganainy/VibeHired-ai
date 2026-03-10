# VibeHired

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Now-blue?style=for-the-badge)](https://vibehired.ganainy.dev)
[![License: MIT + Commons Clause](https://img.shields.io/badge/License-MIT%20%2B%20Commons%20Clause-yellow?style=for-the-badge)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

VibeHired is an AI-powered job application assistant that automates and enhances your job search process. The platform uses multi-provider AI (Google Gemini, OpenRouter, Ollama) to analyze CVs, generate personalized cover letters, score ATS compatibility, extract job requirements, and provide real-time application assistance—all while you maintain full control over your data and API usage. Transform the tedious job application process into an efficient, intelligent workflow.

## Recent Updates (March 2026)

- **Auth reliability fix:** Resolved a production `401` logout loop after login by standardizing the usage endpoint env var (`VITE_BACKEND_URL`) and hardening post-login usage refresh behavior.
- **Server networking hardening:** Express now trusts the first proxy hop (`trust proxy = 1`) and supports **multi-origin CORS** via comma-separated `FRONTEND_URL`.
- **Interview Buddy deep-link fix:** Launch now uses `window.open(...)` to avoid deferred external-protocol prompts reappearing during later login flows.
- **Payments feature flag:** Stripe/upgrade CTAs are now controlled by `VITE_PAYMENTS_ENABLED` so paid flows can be hidden while Stripe rollout is not public.
- **Work Tracker improvements:** Planned entries that are already in the past auto-transition to done, type-filter pills were added, reminder removal now also removes linked calendar event state, and total-hours cards now include done-hours context.
- **Google Calendar timeline polish:** Current-month fetches now clamp to today so past events are not shown in upcoming timeline views.
- **Admin Dashboard:** New admin panel with AI/Apify call tracking and statistics dashboard for monitoring usage and system health.
- **AI Interview Buddy:** New Electron companion app with push-to-talk (Ctrl+Shift+Space), stealth overlay, and Web Speech API transcription for real-time interview assistance.
- **Credit System:** Comprehensive credit-based system with usage tracking, credit limits, and detailed usage statistics across all features.
- **Email Verification:** New email verification flow for enhanced security and account validation.
- **Stripe Integration:** Full payment integration with subscription plans and Stripe checkout.
- **Onboarding Wizard:** 4-step onboarding flow (Welcome, CV Upload, Job Prefs, Feature Tour) with smooth animations.
- **Prep Materials Favourites:** Favourite system for interview materials with star toggle and filter capabilities.
- **Email Suggestions improvements:** Manual scan only, batch AI classification, count-based scan limits (25/50/100/200 emails), and improved UI/UX.
- **Disposable Email Blocking:** Multi-layer disposable email detection using burner-email-providers, disposable.debounce.io API, and DNS MX record verification.
- **Registration UX improvements:** Fixed blank screen after submission with local isSubmitting state and added clear success banner.
- **Mock Interview enhancements:** Separate first/second round prompt options with improved UI visibility.
- **App branding:** New VibeHired logo, gold pill credit badges across all pages, and portfolio polish.
- **ATS CV Template:** New ATS-optimized CV template for better applicant tracking system compatibility.
- **AI Action Guards:** Rate limiting and usage tracking for all AI-powered features.
- **Calendar Integration:** Google Calendar integration for interview scheduling and event management.
- **Voice Command UX:** Push-to-talk (Ctrl+Shift+Space) instead of toggle for better control.

## 🚀 Live Preview

**Try the live application:** [https://vibehired.ganainy.dev](https://vibehired.ganainy.dev)

> **Note:** You'll need to provide your own API keys (Gemini API key for AI features) after registration. Get your free Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## Core Features

### User Authentication
- Secure registration and login using JWT
- **Google OAuth:** Sign in with Google via a secure OAuth 2.0 callback flow
- **Password Reset:** Forgot-password / reset-password email flow
- **Email Verification:** Enhanced security with email verification flow for new accounts
- **Disposable Email Blocking:** Multi-layer detection using static lists, API checks, and DNS MX verification
- Protected routes with authentication middleware
- User profile management

### Job Application Management
- **AI-Powered Job Extraction:** Paste a job posting URL and Google Gemini AI automatically extracts and structures job details (Title, Company, Description, Language, Notes) from any job posting
- **CV Branch Selection:** Choose which CV branch to use for each job application during creation
- **Dashboard View:** Filterable and sortable table view of all applications
- **Kanban Pipeline View:** Visual kanban board for tracking application status (Applied, Interview, Assessment, Offer, Rejected)
- **Status Tracking:** Track applications through multiple stages with custom statuses

### CV Management
- **Multi-Branch CV System:** Create and manage multiple CV versions (branches) for different career paths (e.g., IT Helpdesk, Programming, Cybersecurity) with a primary CV as default
- **Branch Management:** Create new CV branches from existing ones, rename branches, set primary CV, and organize by category
- **Unified Master CV:** Maintain a single "Master CV" as your source of truth and create tailored versions for each job application without duplicating data efforts
- **AI-Powered CV Parsing:** Upload CV files (PDF, DOCX, RTF, TXT) and Google Gemini AI automatically parses and structures content into JSON Resume schema format
- **Rich CV Editor:** Comprehensive editor with section-by-section editing capabilities and real-time preview
- **Formatted Project Lists:** Automatically consolidates projects into a clean, single section with markdown-style bold titles for professional rendering
- **Rich Text Support:** Templates now support bold text formatting in custom sections for emphasized keywords and titles
- **AI CV Analysis:** AI-powered analysis of CV sections with intelligent improvement suggestions and recommendations
- **CV Branch Selection:** Choose which CV branch to use for each job application during creation

### AI-Powered Features
- **Intelligent CV Analysis:** Google Gemini AI analyzes your CV against job descriptions to identify strengths, gaps, and areas for improvement with actionable feedback
- **AI Cover Letter Generation:** Advanced AI generates personalized, tailored cover letters that match your CV style and address specific job requirements
- **AI ATS Scoring:** Get real-time ATS (Applicant Tracking System) compatibility scores with AI-generated detailed feedback on how to optimize your application
- **AI Chat Assistant:** Interactive AI chat interface powered by Google Gemini for each job application—get instant help, suggestions, and answers to application questions
- **AI Job Description Extraction:** AI automatically extracts and structures data from job posting URLs, saving time and ensuring accuracy
- **AI Draft Generation:** Generate tailored CV and cover letter drafts for specific job applications using AI that adapts your content to match job requirements
- **Smart Placeholder System:** AI detects missing information and uses intelligent placeholder handling with context-aware user input modals

### Gmail Email Automation
- **Manual Email Scanning:** Trigger Gmail inbox scans on-demand with count-based limits (25/50/100/200 emails)
- **Batch AI Classification:** All emails classified in a single AI call for efficiency
- **AI Classification:** Your configured AI model (Gemini/OpenRouter/Ollama) classifies each email as a rejection, interview invite, assessment, or offer
- **Smart Job Matching:** Parsed company name and job title are fuzzy-matched against your tracked applications
- **Three independent suggestions per email:** Each card can carry a status change, a rich AI-written note (salary figures, prep advice, key facts), and a calendar event — each confirmed separately
- **Standalone Note Action:** "Add to job notes" appends the AI note with a timestamp to the job without touching its status or dismissing the card
- **Calendar Event Suggestions:** When an email contains a concrete interview/assessment datetime, a checkbox (checked by default) lets you add the event to Google Calendar in one click via the existing Calendar integration
- **Info-only cards:** Cards appear even when there is no status change — useful for emails that share salary data, recruiter advice, or prep tips
- **Suggest-then-Confirm Flow:** Nothing is applied automatically — every detected change appears in the **Email Inbox** page for you to review, apply, or dismiss
- **Deduplication:** Processed emails are labelled `vibe-hired-processed` in Gmail so they're never surfaced twice
- **Privacy First:** Email bodies are only sent to your own configured AI provider

### Analytics Dashboard
- **Statistics Overview:** Key metrics (Total, Response Rate, Interviews, Offers) with "vs last month" trend indicators
- **Visual Charts:** 
  - Application Velocity (line chart with capacity for daily/monthly views)
  - Weekly Goal Tracker with editable targets
  - Pipeline Conversion (Rejected vs Interview vs Offer rates)
- **Recent Activity:** Real-time feed of latest application updates

### Portfolio System
- **Portfolio Setup:** Comprehensive setup page for configuring your portfolio
- **Public Portfolio Pages:** Shareable public portfolio at `/portfolio/:username`
- **GitHub Integration:** Connect GitHub account to automatically import projects
- **LinkedIn Integration:** Sync LinkedIn profile data (optional, requires Apify token)
- **Project Management:** Add, edit, and organize projects with:
  - Featured projects
  - Technology tags
  - Project descriptions and media
  - GitHub repository links
- **Portfolio Publishing:** Toggle portfolio visibility (public/private)

> **Example Portfolio:** See a live example of an automatically generated portfolio created using LinkedIn scraping, GitHub integration, and AI (not just a static portfolio) at [https://vibehired.ganainy.dev/portfolio/ganainy](https://vibehired.ganainy.dev/portfolio/ganainy).

### Settings & Configuration
- **API Key Management:** Secure interface for managing API keys:
  - Gemini API Key (Required for AI features)
  - Apify API Token (Optional for LinkedIn integration)
- **User Profile Settings:** Manage account settings and preferences
- **Credit System:** View credit usage, limits, and subscription status
- **Subscription Plans:** View and upgrade to paid plans with Stripe integration
- **Usage Statistics:** Detailed breakdown of credit usage across all features

### Admin Dashboard
- **AI Call Tracking:** Monitor all AI API calls and usage statistics
- **Apify Call Tracking:** Track LinkedIn scraping API usage and costs
- **System Statistics:** Overview of user activity, credits consumed, and system health
- **User Management:** Admin panel for managing users and accounts

### Review & Finalization
- **AI-Generated Draft Review:** Review and refine AI-generated CVs and cover letters with full editing capabilities before PDF generation
- **Draft Management:** Save and retrieve AI-generated drafts for later editing and refinement
- **PDF Generation:** Generate professional PDF documents from your finalized AI-optimized CVs and cover letters
- **Download System:** Secure download of generated PDF files

### Interview Prep Library
- **Per-job prep materials:** Attach PDFs, DOCX, images, text notes, Markdown notes, and external links to any job application via the dedicated Materials tab
- **Bulk upload:** Select or drop multiple files at once with a sequential upload queue and animated progress bar
- **Inline preview:** Click any card to preview — PDFs and DOCX via Google Docs Viewer, images inline, Markdown rendered with full formatting via `react-markdown`
- **Global Prep Library:** Mark any material as globally shared; view all materials across all jobs on the `/interview-materials` page with grouped or flat views
- **Favourites System:** Star and filter favourite materials for quick access
- **Cloudinary-backed file storage** for binary files; text and Markdown stored directly in the database — 30 MB per-file limit

### AI Interview Buddy (Electron Companion App)
- **Push-to-Talk:** Hold Ctrl+Shift+Space to speak; release to generate AI answers
- **Stealth Overlay:** OS-level screen-share invisibility for stealth during interviews
- **Web Speech API:** Real-time transcription inside Electron Chromium
- **Deep Link Auth:** Custom `vibehired://` protocol for secure authentication
- **Auto-Grant Permissions:** Automatic microphone permission handling
- **Job Selection:** Choose which job application to get interview assistance for
- **Structured AI Responses:** Gemini Flash answers with opener, key points, and closing statements

## Technology Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express, TypeScript, MongoDB, Mongoose
- **Authentication:** JWT (jsonwebtoken), bcryptjs
- **File Handling:** Multer
- **Image Hosting:** Cloudinary
- **AI:** Google Generative AI SDK (`@google/generative-ai`), Web Speech API
- **Web Scraping:** Apify (for LinkedIn profile scraping)
- **PDF Generation:** Puppeteer
- **CV Schema:** JSON Resume ([https://jsonresume.org/](https://jsonresume.org/))
- **Charts:** Recharts (for analytics visualizations)
- **Payments:** Stripe (for subscription plans and checkout)
- **Desktop App:** Electron (for AI Interview Buddy companion app)

## User-Provided API Keys

**Important:** This application uses user-provided API keys. Each user must add their own API keys in the app settings:

- **Gemini API Key (Required):** For AI features (CV analysis, cover letter generation, chat)
  - Get your free API key from: https://makersuite.google.com/app/apikey
- **Apify API Token (Optional):** Only needed for LinkedIn profile synchronization
  - Get your free token from: https://console.apify.com/account/integrations

## Setup & Running (Development)

### Prerequisites
- Node.js (v18+ recommended)
- npm (v7+)
- MongoDB (Atlas account or local installation)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd job-app-assistant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   Or use: `npm run install:all`

3. **Configure environment variables:**
   - Copy `env.example` from the root directory to `server/.env`
   - Add the required values:
     ```env
     # MongoDB Connection String (Required)
     # Why: Used to connect to your MongoDB database where all application data is stored
     # How to get:
     #   - Local MongoDB: mongodb://localhost:27017/job-app-assistant
     #   - MongoDB Atlas: Create a free cluster at https://www.mongodb.com/cloud/atlas
     #     Then copy the connection string from Atlas dashboard (replace <password> with your password)
     #     Example: mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/job-app-assistant?retryWrites=true&w=majority
     MONGODB_URI=<your_mongodb_connection_string>
     
     # JWT Secret Key (Required)
     # Why: Used to sign and verify JWT tokens for user authentication and session management
     # How to get: Generate a secure random string using one of these methods:
     #   - OpenSSL: openssl rand -base64 32
     #   - Node.js: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     #   - Online: Use a secure random string generator (minimum 32 characters recommended)
     # Important: Keep this secret secure and never commit it to version control
     JWT_SECRET=<your_strong_random_secret_string>

     # Cloudinary Configuration (Optional - for persistent profile images)
     # Why: Hosts user profile images efficiently and reliably in production
     # How to get: Create a free account at https://cloudinary.com
     CLOUDINARY_CLOUD_NAME=<your_cloud_name>
     CLOUDINARY_API_KEY=<your_api_key>
     CLOUDINARY_API_SECRET=<your_api_secret>
     ```
    - Deployment/frontend variables you will likely also need:
      ```env
      # Backend CORS allow-list; supports comma-separated origins
      # Example: FRONTEND_URL=https://vibehired.ganainy.dev,https://vibehired-ai.netlify.app
      FRONTEND_URL=<your_frontend_origin_or_csv_list>

      # Frontend API base (set in Netlify/Vite environment)
      VITE_BACKEND_URL=<your_backend_api_base>

      # Optional payments rollout flag (frontend)
      # false = hide Stripe upgrade CTAs and show "coming soon" messaging
      VITE_PAYMENTS_ENABLED=false

      # Optional AI Interview Buddy companion app download URL (frontend)
      # URL where users can download the Electron companion app
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

### First Time Setup

After starting the application:

1. Register a new account (email verification will be sent)
2. Verify your email address via the verification link
3. Complete the 4-step onboarding wizard:
   - Welcome to VibeHired
   - Upload your CV (AI will parse it automatically)
   - Set job preferences
   - Feature tour
4. Navigate to **Settings** page
5. Add your **Gemini API Key** (required for AI features)
   - Get your free API key from: https://makersuite.google.com/app/apikey
6. Optionally add **Apify Token** (for LinkedIn integration)
   - Get your free token from: https://console.apify.com/account/integrations
7. Optionally add **GitHub Token** in Portfolio Setup page (for GitHub integration with higher rate limits)

**Note:** API keys (Gemini, Apify) are managed per-user in the app settings page. GitHub token is managed per-user in the portfolio setup page.

## Deployment

📖 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment guide with automatic deployment setup for Netlify and Heroku.**

## Contributing

Contributions are welcome! Here is how to get involved:

1. **Fork** the repository and create your branch from `main`.
2. Follow the [Setup & Running](#setup--running-development) guide to get a local environment working.
3. Make your changes — keep PRs focused on a single concern.
4. Open a Pull Request with a clear description of the problem and solution.

By submitting a PR you agree that your contribution will be licensed under the same [MIT + Commons Clause](./LICENSE) terms as the rest of the project.

For bug reports and feature requests please open a GitHub Issue.

## License

This project is licensed under the **MIT License with the Commons Clause condition**.
See the [LICENSE](./LICENSE) file for the full legal text.

**In short:**
- ✅ Free to read, fork, modify, and run for personal/non-commercial use.
- ✅ Contributions via pull requests are welcome.
- ❌ You may **not** host or sell VibeHired (or a substantially similar product) as a commercial service without written permission from the copyright holder.

The official hosted service at [vibehired.ganainy.dev](https://vibehired.ganainy.dev) is operated and monetised exclusively by the project author.

## App Showcase

| Feature | Description | Screenshot |
|---------|-------------|------------|
| **Login** | Secure email/password login and Google OAuth sign-in. | ![Login](demo/login.png) |
| **Register** | Create a new account to get started. | ![Register](demo/register.png) |
| **Forgot Password** | Request a password reset link by email. | ![Forgot Password](demo/forgot-password.png) |
| **Auto Jobs** | Automated job discovery with AI-powered analysis and filtering. Manually trigger job searches and get intelligent job recommendations. | ![Auto Jobs](demo/auto-jobs.png) |
| **Email Inbox** | Gmail-powered inbox that automatically scans your emails every 15 minutes. AI detects status changes, writes rich notes (salary, prep advice, key facts), and extracts calendar events — each surfaced as an independent action on the card. Nothing is applied until you confirm. | ![Email Inbox](demo/email-inbox.png) |
| **Dashboard** | The main dashboard provides a comprehensive view of all job applications with filtering, sorting, and quick actions. | ![Dashboard](demo/main-dashboard.png) |
| **Dashboard — Kanban View** | Visual kanban board for tracking applications through the hiring pipeline. | ![Dashboard Kanban](demo/dashboard-kanban.png) |
| **Analytics Dashboard** | Visual dashboard with real-time metrics, status trends, weekly application goals, and pipeline yield analysis. | ![Analytics](demo/analytics-dashboard.png) |
| **Job Details** | View detailed job information and manage individual job applications. | ![Job Details](demo/job-details.png) |
| **Custom Job CV** | Review and customize AI-generated CVs tailored to specific job applications. | ![Custom Job CV](demo/custom-job-cv.png) |
| **Custom Job Cover Letter** | Review and customize AI-generated cover letters tailored to specific job applications. | ![Custom Job Cover Letter](demo/custom-job-coverletter.png) |
| **ATS Analysis** | Get detailed ATS compatibility scores and feedback to optimize your application. | ![ATS Analysis](demo/ats-analysis.png) |
| **CV Management** | Upload, parse, and edit your CV with a rich editor that supports section-by-section editing and AI-powered analysis. | ![CV Management](demo/cv-management.png) |
| **Portfolio Setup - Step 1: Connect Accounts** | Connect your GitHub and LinkedIn accounts to automatically import your professional data. | ![Portfolio Setup - Step 1](demo/portfolio-setup.png) |
| **Portfolio Setup - Step 2: GitHub Repos** | Select which GitHub repositories to showcase in your portfolio. | ![Portfolio Setup - Step 2](demo/portfolio-setup-github.png) |
| **Portfolio Setup - Step 3: LinkedIn Data** | Review and edit your professional information imported from LinkedIn. | ![Portfolio Setup - Step 3](demo/portfolio-setup-linkedin.png) |
| **Portfolio Setup - Step 4: Publish** | Publish your portfolio with a custom username and toggle visibility settings. | ![Portfolio Setup - Step 4](demo/portfolio-setup-publish.png) |
| **Portfolio Setup - Step 5: Community** | Browse other published portfolios from the VibeHired community. | ![Portfolio Setup - Step 5](demo/portfolio-setup-community.png) |
| **Public Portfolio** | Share your professional portfolio with a clean, modern public page. | ![Public Portfolio](demo/custom-portfolio.png) |
| **Settings** | Manage your API keys for AI features (Gemini, OpenRouter, Ollama) and integrations (Apify). Configure AI provider settings and model selection. | ![Settings](demo/settings.png) |
| **Prep Library** | Global view of all interview preparation materials shared across jobs — grouped by company with search and flat/grouped toggle. Click any card to preview PDFs, images, or rendered Markdown inline. | ![Prep Library](demo/prep-library.png) |
| **Prep Library - Upload Queue** | Multi-file upload flow with queued processing and progress states for adding preparation assets. | ![Prep Library Upload Queue](demo/prep-library-upload.png) |
| **Prep Library - Inline Preview** | Material preview experience for PDFs, images, and markdown/text content directly inside the prep workspace. | ![Prep Library Inline Preview](demo/prep-library-preview.png) |
| **Materials Tab** | Per-job prep materials panel with drag-and-drop upload, multi-file bulk progress, and inline Google Docs Viewer preview for PDFs and DOCX. | ![Materials Tab](demo/materials-tab.png) |
