# VibeHired — Feature Reference

Per-page breakdown of every screen in the application: route, authentication requirement, default state, key interactions, and which AI providers/features are used.

For architecture and file layout details see [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md).  
For deployment see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Table of Contents

1. [Authentication Pages](#1-authentication-pages)
   - [Login](#11-login)
   - [Register](#12-register)
   - [Forgot Password](#13-forgot-password)
   - [Reset Password](#14-reset-password)
   - [Google OAuth Callback](#15-google-oauth-callback)
2. [Dashboard](#2-dashboard)
3. [CV Management](#3-cv-management)
4. [Auto Jobs](#4-auto-jobs)
5. [Analytics](#5-analytics)
6. [Review & Finalize](#6-review--finalize)
7. [Portfolio Setup](#7-portfolio-setup)
8. [Public Portfolio](#8-public-portfolio)
9. [Settings](#9-settings)

---

## 1. Authentication Pages

### 1.1 Login

| Attribute | Value |
|---|---|
| **Route** | `/login` |
| **Auth required** | No (redirects to `/dashboard` if already authenticated) |
| **Screenshot** | `demo/login.png` |

**Key interactions**
- Email + password form — submits to `POST /api/auth/login`, stores JWT in `localStorage`
- **Sign in with Google** button — redirects to Google OAuth authorization URL
- Link to `/register` (new account) and `/forgot-password` (reset password)

---

### 1.2 Register

| Attribute | Value |
|---|---|
| **Route** | `/register` |
| **Auth required** | No |
| **Screenshot** | `demo/register.png` |

**Key interactions**
- Name, email, and password fields
- Submits to `POST /api/auth/register`
- On success redirects to `/dashboard`

---

### 1.3 Forgot Password

| Attribute | Value |
|---|---|
| **Route** | `/forgot-password` |
| **Auth required** | No |
| **Screenshot** | `demo/forgot-password.png` |

**Key interactions**
- Enter registered email address
- Submits to `POST /api/auth/forgot-password`
- Backend sends a password-reset email containing a one-time link

---

### 1.4 Reset Password

| Attribute | Value |
|---|---|
| **Route** | `/reset-password?token=<jwt>` |
| **Auth required** | No (token validated server-side) |

**Key interactions**
- New password + confirm password fields
- Token read from URL query string (`?token=`)
- Submits to `POST /api/auth/reset-password`
- On success redirects to `/login`

---

### 1.5 Google OAuth Callback

| Attribute | Value |
|---|---|
| **Route** | `/auth/google?code=<code>&state=<state>` |
| **Auth required** | No |

**Key interactions**
- Automatic — no user interaction needed
- Exchanges the OAuth `code` for a JWT via `GET /api/auth/google/callback`
- Stores the JWT in `localStorage` and redirects to `/dashboard`

---

## 2. Dashboard

| Attribute | Value |
|---|---|
| **Route** | `/dashboard` |
| **Auth required** | Yes |
| **Screenshot** | `demo/main-dashboard.png`, `demo/dashboard-kanban.png` |
| **Component** | `DashboardPage.tsx` |

**Default state**
- Table view, sorted by `createdAt` descending
- Status filter defaults to `'Not Applied'` (or last-used filter from `localStorage`)

**Key interactions**

| Action | Description |
|---|---|
| **Add Job (URL)** | Paste a job posting URL → AI extracts Title, Company, Description, Language, Notes via `POST /api/job-applications/extract` (Gemini) |
| **Add Job (Manual)** | Fill in fields manually |
| **CV Branch selection** | Choose which CV branch to attach to the job during creation |
| **Filter & sort** | Filter by status, sort by any column |
| **Toggle Kanban** | Switch to visual kanban pipeline view (`ApplicationPipelineKanban`) — tracks: Not Applied → Applied → Interview → Assessment → Offer / Rejected |
| **Job row click** | Expands inline job details panel (`demo/job-details.png`) |
| **Quick actions** | Mark status, open review page, delete job |
| **AI Chat** | Floating chat button (`FloatingChatButton`) opens `JobChatModal` with a per-job Gemini chat session |

**AI features used**
- Job URL extraction — Gemini (via `POST /api/job-applications/extract`)
- Job relevance scoring — background service
- Recommendation badges — `JobRecommendationBadge`

---

## 3. CV Management

| Attribute | Value |
|---|---|
| **Route** | `/manage-cv` |
| **Auth required** | Yes |
| **Screenshot** | `demo/cv-management.png` |
| **Component** | `CVManagementPage.tsx` |
| **Spec** | `specs/001-multi-cv-selection/spec.md` |

**Default state**
- Branch selector screen (`creationMode = 'choose'`) — lists all existing CV branches

**Key interactions**

| Action | Description |
|---|---|
| **Select branch** | Load an existing CV branch into the editor |
| **Create branch** | Create a new blank branch or copy from an existing one |
| **Set primary** | Mark a branch as the default for new job applications |
| **Upload CV** | Upload PDF / DOCX / RTF / TXT → AI parses into JSON Resume schema via `POST /api/cvs/parse` |
| **Section editing** | `CvFormEditor` — section-by-section rich editing for: Basics, Work Experience, Education, Skills, Projects, Certificates, Languages |
| **Live preview** | `CvLivePreview` — real-time A4 preview using any of the 14 templates |
| **Template selector** | Switch between 14 professional resume templates |
| **AI CV Analysis** | Analyze a section with AI feedback (`SectionAnalysisPanel`) |
| **Bold formatting** | Markdown `**bold**` in custom sections for keyword emphasis |

**AI features used**
- CV parsing from file — Gemini (`POST /api/cvs/parse`)
- CV section analysis — Gemini / OpenRouter / Ollama (`POST /api/analysis`)

**CV branch model fields**
- `isPrimary` — whether this is the default branch
- `category` — career path tag (e.g. "Software Engineering")
- `displayName` — human-readable branch name
- `baseCvId` — the branch this was forked from

---

## 4. Auto Jobs

| Attribute | Value |
|---|---|
| **Route** | `/auto-jobs` |
| **Auth required** | Yes |
| **Screenshot** | `demo/auto-jobs.png` |
| **Component** | `AutoJobsPage.tsx` |

**Default state**
- Single-view page — stats overview + search configuration + job results list
- API-key warning banner shown if Apify token is missing (dismissible via `localStorage`)

**Key interactions**

| Action | Description |
|---|---|
| **Configure search** | Set keywords, location, job type, experience level |
| **Trigger workflow** | Start automated job discovery and analysis pipeline (`POST /api/auto-jobs/workflow`) |
| **Workflow progress** | Real-time progress bar and log via polling |
| **Cancel workflow** | Stop a running workflow (`DELETE /api/auto-jobs/workflow/:runId`) |
| **Recommendation badge** | Each discovered job shows an AI relevance score badge |
| **Convert to application** | Add a relevant auto-job to the tracked applications list |

**AI features used**
- Job description extraction — Gemini
- Relevance scoring — Gemini (`jobRelevanceService`)
- Company insights — Gemini (`jobAnalysisService`)
- Auto-generate CV + cover letter draft — Gemini / OpenRouter / Ollama

**Workflow stages**
1. Job Acquisition (`jobAcquisitionService`) — fetch job listings via Apify
2. Analysis (`jobAnalysisService`) — extract skills, requirements, company insights
3. Relevance scoring (`jobRelevanceService`) — rank against user's CV
4. Content generation (`generatorService`) — tailored CV + cover letter for relevant jobs

---

## 5. Analytics

| Attribute | Value |
|---|---|
| **Route** | `/analytics` |
| **Auth required** | Yes |
| **Screenshot** | `demo/analytics-dashboard.png` |
| **Component** | `AnalyticsPage.tsx` |

**Default state**
- `selectedMonth = 'current-month'` (from `localStorage`)
- `weeklyGoal = 5` (from `localStorage`)

**Key interactions**

| Widget | Description |
|---|---|
| **Stats summary** | `StatsSummary` — Total, Response Rate, Interviews, Offers with vs-last-month trend arrows |
| **Applications over time** | `ApplicationsOverTimeChart` — line chart (daily/monthly toggle) |
| **Weekly goal tracker** | `WeeklyGoalWidget` — editable target with progress ring |
| **Pipeline conversion** | `PipelineConversionWidget` — Rejected vs Interview vs Offer rates |
| **Recent activity** | `RecentActivityWidget` — feed of latest application status changes |
| **Pipeline kanban** | Read-only kanban replica showing current distribution |

No AI features — analytics are computed from stored job application data.

---

## 6. Review & Finalize

| Attribute | Value |
|---|---|
| **Route** | `/jobs/:jobId/review/:tab?` |
| **Auth required** | Yes |
| **Screenshots** | `demo/custom-job-cv.png`, `demo/custom-job-coverletter.png`, `demo/ats-analysis.png` |
| **Component** | `ReviewFinalizePage.tsx` |

**Tabs**

| Tab (`:tab`) | Feature |
|---|---|
| `cv` | AI-generated CV draft editor + template selection + PDF download |
| `cover-letter` | AI-generated cover letter editor (`CoverLetterEditor`) + format picker (`EmailFormatModal`) |
| `ats` | ATS scoring panel — score card + keyword breakdown + improvement suggestions |
| `chat` | Per-job AI chat window (`JobChatWindow`) |

**Key interactions**

| Action | Description |
|---|---|
| **Generate draft** | Trigger AI draft generation for a specific job (`POST /api/generator`) |
| **Edit CV / Cover letter** | Full inline editing of the generated draft |
| **Template switch** | Preview draft in any of the 14 templates |
| **ATS analysis** | Score CV against job description and get actionable ATS feedback |
| **PDF download** | Generate and download PDF via `GET /api/generator/:jobId/download` (Puppeteer) |
| **Save draft** | Persist edits for later refinement |
| **User input modal** | `UserInputModal` — AI requests missing info (e.g. salary expectation, start date) via smart placeholder system |

**AI features used**
- Draft generation — Gemini / OpenRouter / Ollama (`generatorService`)
- ATS scoring — Gemini (`atsGeminiService`)
- Cover letter generation — Gemini / OpenRouter / Ollama (`coverLetterService`)
- Chat assistant — Gemini / OpenRouter / Ollama (`chatService`)

---

## 7. Portfolio Setup

| Attribute | Value |
|---|---|
| **Route** | `/portfolio-setup?tab=<0–4>` |
| **Auth required** | Yes |
| **Screenshots** | `demo/portfolio-setup.png` through `demo/portfolio-setup-community.png` |
| **Component** | `PortfolioSetupPage.tsx` |

**Tabs**

| Tab | `?tab=` | Screenshot |
|---|---|---|
| Connect Accounts | `0` | `demo/portfolio-setup.png` |
| GitHub Repos | `1` | `demo/portfolio-setup-github.png` |
| LinkedIn Data | `2` | `demo/portfolio-setup-linkedin.png` |
| Publish Portfolio | `3` | `demo/portfolio-setup-publish.png` |
| Community Portfolios | `4` | `demo/portfolio-setup-community.png` |

**Key interactions**

| Tab | Actions |
|---|---|
| **Connect Accounts** | Enter GitHub profile URL, enter LinkedIn profile URL (optional, requires Apify token) |
| **GitHub Repos** | Fetch repos via `GET /api/github/repos`, select which to include, set featured repos |
| **LinkedIn Data** | Trigger LinkedIn scrape via Apify, review and edit imported work experience / education / skills |
| **Publish** | Set public username (used for `/portfolio/:username`), toggle public/private visibility |
| **Community** | Browse all published portfolios |

**AI features used**
- LinkedIn data import — Apify (no Gemini needed for import itself)
- Optional AI enrichment of project descriptions — Gemini

---

## 8. Public Portfolio

| Attribute | Value |
|---|---|
| **Route** | `/portfolio/:username` |
| **Auth required** | No |
| **Screenshot** | `demo/custom-portfolio.png` |
| **Component** | `PortfolioPage.tsx` |

**Displayed sections**
- Profile photo + name + headline
- About / summary
- Work experience (from LinkedIn import or manual entry)
- Skills
- Projects (GitHub repos + custom projects)
- Contact / social links

Visibility is controlled by the user's `isPublic` flag set in [Portfolio Setup → Publish tab](#7-portfolio-setup). Private portfolios return 404.

---

## 9. Settings

| Attribute | Value |
|---|---|
| **Route** | `/settings` |
| **Auth required** | Yes |
| **Screenshot** | `demo/settings.png` |
| **Component** | `SettingsPage.tsx` |

**Sections**

| Section | Description |
|---|---|
| **Gemini API Key** | Required for all AI features. Get free key at [Google AI Studio](https://makersuite.google.com/app/apikey). Stored encrypted server-side. |
| **OpenRouter** | Optional alternative AI provider. Enter API key + select model. Enables access to GPT-4, Claude, Mistral, etc. |
| **Ollama** | Optional local AI provider. Enter local Ollama base URL (e.g. `http://localhost:11434`). Zero API cost, private. |
| **Apify Token** | Required for LinkedIn profile scraping in Portfolio Setup. Get free token at [Apify Console](https://console.apify.com/account/integrations). |
| **Google Calendar** | Optional calendar integration for tracking interview schedules. |

**Key interactions**
- API keys are encrypted before storage (`server/src/utils/encryption.ts`)
- The active AI provider is selected per-request (falls back: user provider → Gemini key → error)
- Test buttons to validate keys before saving

---

*Last Updated: February 2026*
