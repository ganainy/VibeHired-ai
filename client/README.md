# VibeHired — Frontend

The React + TypeScript + Vite single-page application for [VibeHired](../README.md).

> **License:** MIT + Commons Clause — see [LICENSE](../LICENSE) for details.
> Free for personal/non-commercial use. Commercial hosting or resale requires written permission from the author.

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
| `/auth/google` | `GoogleAuthCallbackPage` | Public |
| `/portfolio/:username` | `PortfolioPage` | Public |
| `/dashboard` | `DashboardPage` | Protected |
| `/manage-cv` | `CVManagementPage` | Protected |
| `/auto-jobs` | `AutoJobsPage` | Protected |
| `/analytics` | `AnalyticsPage` | Protected |
| `/portfolio-setup` | `PortfolioSetupPage` | Protected |
| `/settings` | `SettingsPage` | Protected |
| `/jobs/:jobId/review/:tab?` | `ReviewFinalizePage` | Protected |
