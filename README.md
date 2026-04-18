# VibeHired

[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit_Now-blue?style=for-the-badge)](https://vibehired.ganainy.dev)
[![License: MIT + Commons Clause](https://img.shields.io/badge/License-MIT%20%2B%20Commons%20Clause-yellow?style=for-the-badge)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)

VibeHired is an AI-powered job application assistant that transforms your job search into an efficient, intelligent workflow. Powered by Google Gemini AI, the platform generates tailored CVs and cover letters for every role, tracks all your applications, interviews, and deadlines in one place, scores ATS compatibility, and provides real-time assistance—so nothing slips through the cracks.

## 🚀 Live Preview

**Try the live application:** [https://vibehired.ganainy.dev](https://vibehired.ganainy.dev)

## Core Features

> For detailed per-feature documentation see [FEATURES.md](./docs/FEATURES.md).

| Feature | Summary |
|---|---|
| **User Authentication** | JWT login, Google OAuth, email verification, password reset, disposable email blocking |
| **Job Application Management** | AI job extraction from URLs, dashboard view, status tracking, follow-up eligibility nudges |
| **CV Management** | Multi-branch CV system, AI parsing to freeform + tags, dynamic editor, AI analysis |
| **AI-Powered Features** | Tailored CV & cover letter generation, ATS scoring, chat assistant, draft generation |
| **Gmail Email Automation** | On-demand inbox scanning, batch AI classification, suggest-then-confirm flow |
| **Analytics Dashboard** | Key metrics, visual charts, weekly goal tracker, pipeline conversion |
| **Portfolio System** | GitHub/LinkedIn import, public portfolio page, project management |
| **Settings & Configuration** | Profile management, credit balance & usage stats, subscription plans |
| **Admin Dashboard** | AI call tracking, system statistics, user management *(admin only)* |
| **Review & Finalization** | AI draft review, tailoring change log (before/after), inline diff preview, PDF generation |
| **Interview Prep Library** | Per-job materials, bulk upload, inline preview, global library, favourites |
| **Work Tracker** | Session logging with type filters, reminders, Google Calendar integration |
| **Mock Interview** | AI-powered practice with first and second round prompt options |
| **Google Calendar** | Interview scheduling and calendar event management |
| **AI Interview Buddy** | Electron companion app — *currently in development, available to admins only* |

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

## 📚 Documentation

All project documentation is centralized in the `/docs` folder for easy navigation:

- **[Design System](./docs/DESIGN_SYSTEM.md)** — Obsidian Intelligence design language with colors, typography, spacing, components, and responsive patterns
- **[Features Reference](./docs/FEATURES.md)** — Per-page feature documentation with routes, AI features, and API endpoints
- **[Development Setup](./docs/DEVELOPMENT.md)** — Local development environment configuration
- **[Deployment Guide](./docs/DEPLOYMENT.md)** — Netlify & Heroku deployment with auto-deploy setup

**Figma Design System:** [VibeHired - Obsidian Intelligence Design System](https://www.figma.com/design/AuGzY3MIec89UbJpF98mVF)

## Contributing

Contributions are welcome! Here is how to get involved:

1. **Fork** the repository and create your branch from `main`.
2. Follow the [Development Setup](./docs/DEVELOPMENT.md) guide to get a local environment working.
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
| **Login / Register** | Secure email/password login and Google OAuth sign-in. Create a new account to get started. | ![Login](demo/login.png) |
| **Forgot Password** | Request a password reset link by email. | ![Forgot Password](demo/forgot-password.png) |
| **Email Inbox** | Gmail-powered inbox that automatically scans your emails every 15 minutes. AI detects status changes, writes rich notes (salary, prep advice, key facts), and extracts calendar events — each surfaced as an independent action on the card. Nothing is applied until you confirm. | ![Email Inbox](demo/email-inbox.png) |
| **Dashboard** | The main dashboard provides a comprehensive view of all job applications with filtering, sorting, and quick actions. | ![Dashboard](demo/main-dashboard.png) |
| **Analytics Dashboard** | Visual dashboard with real-time metrics, status trends, weekly application goals, and pipeline yield analysis. | ![Analytics](demo/analytics-dashboard.png) |
| **Job Details** | View detailed job information and manage individual job applications. | ![Job Details](demo/job-details.png) |
| **Custom Job CV** | Review and customize AI-generated CVs tailored to specific job applications. | ![Custom Job CV](demo/custom-job-cv.png) |
| **Custom Job Cover Letter** | Review and customize AI-generated cover letters tailored to specific job applications. | ![Custom Job Cover Letter](demo/custom-job-coverletter.png) |
| **CV Management** | Upload, parse, and edit your CV with a rich editor that supports section-by-section editing and AI-powered analysis. | ![CV Management](demo/cv-management.png) |
| **Portfolio Setup** | Single-page portfolio configurator — connect GitHub to import repos, sync LinkedIn data, set a custom username, and toggle public visibility. | ![Portfolio Setup](demo/portfolio-setup.png) |
| **Public Portfolio** | Share your professional portfolio with a clean, modern public page. | ![Public Portfolio](demo/custom-portfolio.png) |
| **Settings** | View and manage your credit balance, usage statistics, and optional integrations (Apify for LinkedIn, GitHub token for portfolio). | ![Settings](demo/settings.png) |
| **Subscriptions** | View, select, and manage your active features and tier limits with secure Stripe payment integration. | ![Subscriptions](demo/subscriptions.png) |
| **Work Tracker** | Log work sessions with AI-powered voice commands, type-filter pills, automatic past-entry completion, and linked Google Calendar events. | ![Work Tracker](demo/work-tracker.png) |
| **Google Calendar** | View your synced Google Calendar events, schedule interviews, manage tasks, and stay on top of your timeline directly within the app. | ![Google Calendar](demo/calendar.png) |
| **Mock Interview** | AI-powered mock interview practice with separate first and second round prompt options per job application. | ![Mock Interview](demo/mock-interview.png) |
| **Admin Dashboard** | Internal admin panel with AI call tracking, Apify usage statistics, user activity overview, and system health monitoring. | ![Admin Dashboard](demo/admin-dashboard.png) |
| **AI Interview Buddy** | Electron companion app with push-to-talk (Ctrl+Shift+Space), stealth screen-share overlay, and real-time Gemini AI answers during live interviews. ***Currently in development — available to admins only.*** | COMING SOON |
| **Prep Library** | Global view of all interview preparation materials shared across jobs — grouped by company with search and flat/grouped toggle. Click any card to preview PDFs, images, or rendered Markdown inline. | ![Prep Library](demo/prep-library.png) |
| **Prep Library - Upload Queue** | Multi-file upload flow with queued processing and progress states for adding preparation assets. | ![Prep Library Upload Queue](demo/prep-library-upload.png) |
| **Prep Library - Inline Preview** | Material preview experience for PDFs, images, and markdown/text content directly inside the prep workspace. | ![Prep Library Inline Preview](demo/prep-library-preview.png) |

