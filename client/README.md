# VibeHired — Frontend

The React + TypeScript + Vite single-page application for [VibeHired](../README.md).

> **License:** MIT + Commons Clause — see [LICENSE](../LICENSE) for details.
> Free for personal/non-commercial use. Commercial hosting or resale requires written permission from the author.

## Recent Updates (March 2026)

- `VITE_PAYMENTS_ENABLED` now gates Stripe/upgrade CTAs across onboarding, subscriptions, settings, review, and credit-limit prompts.
- Post-login auth flow is hardened to avoid false logout on transient usage-fetch `401` failures.
- Interview Buddy deep-link launching now uses `window.open(...)` to prevent deferred protocol prompts from showing during later login flow.
- Onboarding wizard added with 4-step flow (Welcome, CV Upload, Job Prefs, Feature Tour).
- Admin dashboard added with AI/Apify call tracking and statistics.
- Credit system implementation with usage tracking and credit limits.
- Email verification flow for enhanced security.
- Interview materials favourites system with star toggle and filter.
- Work Tracker enhancements: auto-flip planned entries, calendar events inline, filter pills.
- Email suggestions improvements: manual scan only, batch AI classification, count-based limits.
- Disposable email blocking with multi-layer detection.
- Mock interview enhancements: separate first/second round options.
- App branding: new VibeHired logo and gold credit badges.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS + custom CSS design tokens (see [STYLE_GUIDELINES.md](./STYLE_GUIDELINES.md)) |
| HTTP client | Axios |
| Charts | Recharts |
| CV schema | JSON Resume |
| Icons | Material Symbols Outlined (Google Fonts) |

## Local Development

From the **repo root:**

```bash
npm run dev          # starts both frontend (port 5173) and backend (port 5001)
```

Or from this directory only:

```bash
npm install          # first time only
npm run dev          # Vite dev server at http://localhost:5173
```

## Environment Variables

Create a `.env.local` file in this (`client/`) directory or set the variable in your shell before starting the dev server:

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Production only | Absolute URL of the deployed backend API. Leave unset for local dev (proxied via Vite). |
| `VITE_PAYMENTS_ENABLED` | Optional | Feature flag for paid plans UI. Set to `false` to hide Stripe checkout/upgrade CTAs and show "coming soon" messaging. |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build (outputs to `dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across all source files |

## Project Structure

All source code lives in `src/`. Key directories:

```
src/
├── components/   # Reusable UI components, grouped by feature
├── context/      # React Context providers (Auth, Theme)
├── hooks/        # Custom React hooks
├── pages/        # Top-level route components
├── services/     # Axios API wrappers (one file per backend route group)
├── templates/    # 14 resume/CV templates
├── types/        # TypeScript interfaces & enums
├── utils/        # Pure utility functions
└── lib/          # Third-party library helpers
```

For a full breakdown of every file and directory see [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md).

## Design System

All components follow the **Obsidian Intelligence** design system documented in [STYLE_GUIDELINES.md](./STYLE_GUIDELINES.md):

- **Dark-first** — `var(--bg-base)` through `var(--bg-raised)` surface layers
- **Gold accent** — `var(--accent)` (`#e8b844`) only; no blue/purple
- **Fonts** — Fraunces (display), Outfit (body), JetBrains Mono (data)
- **Component classes** — `.card`, `.btn-primary`, `.input-base`, `.badge-*`, etc. defined in `src/index.css`

## Routes

| Path | Component | Auth |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/register` | `RegisterPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/reset-password` | `ResetPasswordPage` | Public |
| `/verify-email` | `VerifyEmailPage` | Public |
| `/auth/google` | `GoogleAuthCallbackPage` | Public |
| `/portfolio/:username` | `PortfolioPage` | Public |
| `/dashboard` | `DashboardPage` | Protected |
| `/manage-cv` | `CVManagementPage` | Protected |
| `/auto-jobs` | `AutoJobsPage` | Protected |
| `/analytics` | `AnalyticsPage` | Protected |
| `/portfolio-setup` | `PortfolioSetupPage` | Protected |
| `/settings` | `SettingsPage` | Protected |
| `/subscriptions` | `SubscriptionsPage` | Protected |
| `/email-suggestions` | `EmailSuggestionsPage` | Protected |
| `/work-tracker` | `WorkTrackerPage` | Protected |
| `/interview-buddy` | `InterviewBuddyPage` | Protected (Admin/Owner only) |
| `/interview-materials` | `InterviewMaterialsPage` | Protected |
| `/admin` | `AdminDashboardPage` | Protected (Admin only) |
| `/admin/users` | `AdminUsersPage` | Protected (Admin only) |
| `/onboarding` | `OnboardingPage` | Protected (New users) |
| `/jobs/:jobId/review/:tab?` | `ReviewFinalizePage` | Protected |