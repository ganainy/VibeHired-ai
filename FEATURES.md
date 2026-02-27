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
10. [Prep Library](#10-prep-library)
11. [Email Inbox](#11-email-inbox)

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
| **Screenshots** | `demo/custom-job-cv.png`, `demo/custom-job-coverletter.png`, `demo/ats-analysis.png`, `demo/materials-tab.png` |
| **Component** | `ReviewFinalizePage.tsx` |

**Tabs**

| Tab (`:tab`) | Feature |
|---|---|
| `cv` | AI-generated CV draft editor + template selection + PDF download |
| `cover-letter` | AI-generated cover letter editor (`CoverLetterEditor`) + format picker (`EmailFormatModal`) |
| `ats` | ATS scoring panel — score card + keyword breakdown + improvement suggestions |
| `chat` | Per-job AI chat window (`JobChatWindow`) |
| `materials` | Interview prep material upload and management panel (`InterviewMaterialsPanel`) |

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

## 10. Prep Library

| Attribute | Value |
|---|---|
| **Route** | `/interview-materials` |
| **Auth required** | Yes |
| **Screenshots** | `demo/prep-library.png`, `demo/prep-library-preview.png`, `demo/prep-library-upload.png` |
| **Component** | `InterviewMaterialsPage.tsx` |

Also accessible per-job via `/jobs/:jobId/review/materials` tab (component: `InterviewMaterialsPanel.tsx`).

**Default state**
- `viewMode = 'grouped'` — materials shown grouped by company/job with accordion expand/collapse
- Empty state shown if no materials have been marked as globally shared

**Key interactions**

| Action | Description |
|---|---|
| **Upload files** | Drag-drop or click to browse — PDF, DOCX, PNG, JPG, TXT, MD up to 30 MB each |
| **Multi-file upload** | Select or drop 2+ files for bulk queue; sequential uploads with animated progress bar and per-file error tracking |
| **Add Note** | Quick-add plain-text snippet stored as `content` (no Cloudinary upload) |
| **Add Markdown** | Quick-add Markdown note — rendered with `react-markdown` on preview |
| **Add Link** | Quick-add external URL — opens directly in new tab on card click |
| **Preview** | Click any card to open inline preview: PDFs/DOCX via Google Docs Viewer iframe, images inline, Markdown rendered, text plain |
| **Global toggle** | Per-item toggle to include/remove a material from the global Prep Library |
| **Grouped view** | Materials grouped by job with accordion expand/collapse (default) |
| **Flat view** | All materials in a single list with job chip links |
| **Search** | Filter by title, description, job title, company, or URL |

**File handling details**

| Type | Storage | Preview |
|---|---|---|
| PDF | Cloudinary (`resource_type: 'raw'`) | Google Docs Viewer iframe |
| DOCX | Cloudinary (`resource_type: 'raw'`) | Google Docs Viewer iframe |
| PNG / JPG | Cloudinary (`resource_type: 'image'`) | Inline `<img>` |
| TXT | MongoDB `content` field (no Cloudinary) | Plain `<pre>` |
| MD | MongoDB `content` field (no Cloudinary) | `<ReactMarkdown>` |
| Link | URL only, no upload | Opens in new tab on click |

---

---

## 11. Email Inbox

| Attribute | Value |
|---|---|
| **Route** | `/email-inbox` |
| **Auth required** | Yes |
| **Screenshot** | `demo/email-inbox.png` |
| **Components** | `EmailSuggestionsPage.tsx`, `EmailSuggestionPanel.tsx` (sidebar variant) |

**Default state**
- "How it works" explainer accordion always visible
- Privacy / AI provider picker displayed with warnings if an external provider is selected
- Gmail scope warning shown (with reconnect button) if the user's Google OAuth token lacks Gmail read permission
- Empty state shown when no pending suggestions exist

**How the pipeline works**

1. Server polls Gmail every 15 minutes (or on manual "Scan inbox" click) for unread job-related emails
2. Email body is PII-redacted (emails/phones stripped) before being sent to the AI
3. AI classifies the email and returns a structured response with up to three suggestions
4. Suggestions are fuzzy-matched to a tracked job application (company name required)
5. Suggestion card is saved as `pending` in MongoDB with a 90-day TTL
6. User reviews each card and takes action independently on each section

**Three per-card action sections**

| Section | Shown when | User action |
|---|---|---|
| **Status change** | `suggestedStatus` is non-null | **Apply** button updates the matched job's status |
| **AI Note** | `suggestedNote` is non-empty | Standalone **Add to job notes** button appends the note with a `[DD Mon YYYY]` timestamp to `job.notes` — independent of Accept/Reject |
| **Calendar event** | `suggestedCalendarEvent` is present | Checkbox (checked by default) on the card; unchecking opts out before clicking Apply. When not connected: row is greyed-out with a "Connect Google Calendar" prompt |

**Card behaviour details**

- Cards appear even when `suggestedStatus` is null, as long as a note or calendar event was extracted (e.g. salary info, prep advice, or a scheduled event without a status change)
- "Add to job notes" is idempotent — button becomes disabled (shows "Added") once the note has been saved, without dismissing the card
- Calendar event creation calls the existing `googleCalendarService.createCalendarEvent()` and pushes an `IReminder` entry (with `calendarEventId`, `status: 'synced'`) into `job.reminders[]`
- Accepting a card only dismisses it — dismissing a card never modifies the job

**AI prompt output schema**

```json
{
  "isJobRelated": boolean,
  "suggestedStatus": "Interview" | "Assessment" | "Rejected" | "Offer" | null,
  "suggestedNote": "string (2-4 sentences, key facts, salary, advice)",
  "suggestedCalendarEvent": {
    "title": "string",
    "description": "string",
    "dateTimeISO": "string (ISO 8601)",
    "notificationMinutesBefore": number
  } | null,
  "extractedCompany": "string",
  "extractedRole": "string",
  "confidence": "high" | "medium" | "low"
}
```

**Key interactions**

| Action | Description |
|---|---|
| **Scan inbox** | Manual Gmail poll; rate-limited to 1 per 60 s per user |
| **Lookback window** | Dropdown to set how many days back to scan (1 / 7 / 14 / 30) |
| **Add to job notes** | Appends the AI note to `job.notes` without touching job status or dismissing the card |
| **Calendar checkbox** | Checked by default; unchecking before Apply skips calendar event creation |
| **Apply / Save** | Applies the status change and/or creates the calendar event (if checked) |
| **Dismiss** | Marks suggestion as `rejected`; no changes to the job |
| **Connect Gmail** | Initiates Google OAuth re-authorisation with Gmail + Calendar scopes |
| **AI provider selector** | Per-user override for which AI provider processes inbox emails |

**API routes**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/email-suggestions` | List pending suggestions |
| `POST` | `/api/email-suggestions/poll` | Trigger manual Gmail poll |
| `POST` | `/api/email-suggestions/:id/accept` | Apply status + optional calendar event; body: `{ includeCalendarEvent: boolean }` |
| `POST` | `/api/email-suggestions/:id/add-note` | Independently append note to matched job |
| `POST` | `/api/email-suggestions/:id/reject` | Dismiss suggestion |
| `GET` | `/api/email-suggestions/preferences` | Get lookback days + AI provider preference |
| `PUT` | `/api/email-suggestions/preferences` | Update preferences |
| `GET` | `/api/email-suggestions/gmail-scope-status` | Check Gmail OAuth scope |

**AI features used**
- Email classification — Gemini / OpenRouter / Ollama (respects per-user `inboxProvider` override, falls back to `defaultProvider`)
- Calendar datetime parsing is done inline by the classification prompt (no separate parse step)
- Fallback keyword heuristic used when no AI provider is configured

---

*Last Updated: February 2026*
