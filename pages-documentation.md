# Job App Assistant - Pages Documentation

## Pages Overview

This document describes each page in the application, its purpose, and key UI components.

---

## Authentication Pages

### LoginPage

**What it does:** Allows users to sign in using email/password or Google OAuth.

**UI Components:**
- Email input field
- Password input field (with show/hide toggle)
- Login button
- Google sign-in button
- Link to registration
- Link to forgot password
- Resend verification email option

---

### RegisterPage

**What it does:** New user registration with email/password and optional Google OAuth.

**UI Components:**
- Email input field
- Password input field (with strength indicator)
- Confirm password field
- Terms checkbox
- Register button
- Google sign-in button
- Password strength meter (weak/fair/good/strong)

---

### ForgotPasswordPage

**What it does:** Allows users to request a password reset link.

**UI Components:**
- Email input field
- Submit button
- Back to login link

---

### ResetPasswordPage

**What it does:** Password reset form with token validation.

**UI Components:**
- New password input field
- Confirm password field
- Password strength indicator
- Submit button

---

### VerifyEmailPage

**What it does:** Verifies user email via token sent to their inbox.

**UI Components:**
- Status message (loading/success/error)
- Resend verification form
- Login link

---

### GoogleAuthCallbackPage

**What it does:** Handles OAuth callback from Google authentication.

**UI Components:**
- Loading spinner
- Redirect to app

---

## Core Pages

### DashboardPage

**What it does:** Main job application tracking dashboard. Lists all job applications from various platforms (LinkedIn, Indeed, Xing, Stepstone), allows adding new jobs (manual entry or URL), duplicate detection, job status management.

**UI Components:**
- Jobs table/cards view toggle
- Expandable job descriptions
- Add job button (manual or URL import)
- Platform filters
- Status filters
- Search functionality
- Duplicate job warning modal
- Tour banner

---

### WorkTrackerPage

**What it does:** Track time spent on job hunting activities, manage appointments/reminders.

**UI Components:**
- Calendar view (month/week)
- Entry list by date
- Add entry form
- Add reminder form
- Appointment type management
- Work hours summary
- Time tracking controls

---

### CVManagementPage

**What it does:** Upload, manage, and edit CVs/resumes. View all CVs, select default, edit content via AI-powered section analysis.

**UI Components:**
- CV list with default indicator
- File upload dropzone
- CV viewer/preview
- AI section analysis panel
- Section improvement chat
- Branch management (parallel CV versions)
- Usage analytics per CV

---

### AnalyticsPage

**What it does:** Visual analytics for job applications and work tracking.

**UI Components:**
- Tab switcher (Jobs / Work)
- Weekly goal widget
- Pipeline conversion widget
- Applications over time chart
- Recent activity list
- Work hours chart
- Employer distribution chart

---

### JobApplicationWorkspacePage

**What it does:** Comprehensive workspace for a single job application. Tailor CV, generate cover letter, mock interview practice, manage reminders and materials.

**UI Components:**
- Job details section
- Tailored CV preview and generator
- Cover letter editor
- Mock interview panel
- Reminders panel
- Interview materials panel
- Chat window (floating)
- Recommendation modal
- Generation progress modal
- Tab navigation (CV, Cover Letter, Mock Interview, Reminders, Materials)

---

### MockJobReviewPage

**What it does:** Demo/tour version of job workspace with mock data.

**UI Components:**
- Same as JobApplicationWorkspacePage but with pre-filled demo data

---

## Search & Discovery

### AutoJobsPage

**What it does:** Automated job search from external sources. Configure keywords, location, filters, run workflow, manage discovered jobs.

**UI Components:**
- Settings form (keywords, location, job type, experience level)
- Workflow controls (run, cancel, status)
- Stats display
- Job list with promote to dashboard
- Bulk delete controls

---

## Portfolio

### PortfolioSetupPage

**What it does:** Configure personal portfolio. Edit profile, manage projects, reorder, import from GitHub/LinkedIn, publish portfolio.

**UI Components:**
- Profile editor form
- Projects sortable list
- Drag-and-drop reorder
- GitHub import button
- LinkedIn sync button
- Publish toggle
- Published portfolios list

---

### PortfolioPage

**What it does:** Public portfolio view by username.

**UI Components:**
- Profile header
- About section
- Projects list
- Contact/social links

---

## Email Integration

### EmailSuggestionsPage

**What it does:** AI-generated email suggestions from Gmail. View pending suggestions, accept/reject, edit, manual poll.

**UI Components:**
- Suggestion list
- Accept/reject buttons
- Edit suggestion modal
- Gmail connection status
- Poll now button
- Preferences form

---

## Calendar

### CalendarPage

**What it does:** Google Calendar integration. View events, create/delete events, connect/disconnect account.

**UI Components:**
- Calendar view (month/week/agenda)
- Event list
- Connect/disconnect button
- Create event form
- Event edit/delete
- Time filter dropdown

---

## Interview Prep

### InterviewMaterialsPage

**What it does:** Manage interview preparation materials (PDFs, documents, links).

**UI Components:**
- Materials grid
- Upload form
- Material preview modal
- Share/unshare controls
- Delete button
- Download link

---

### InterviewBuddyPage

**What it does:** Download page for Companion desktop app (stealth recording for mock interviews).

**UI Components:**
- Feature highlights
- Download button
- Platform-specific instructions (macOS/Windows/Linux)

---

### SharedMaterialPage

**What it does:** Public view of shared interview material.

**UI Components:**
- Material preview
- Download button
- Markdown renderer

---

## Settings & Billing

### SettingsPage

**What it does:** User settings management. API keys, Google Calendar, subscription, account details.

**UI Components:**
- API keys form (show/hide toggle)
- Google Calendar connect/disconnect
- Subscription status
- Usage display
- Credit purchase button
- Resend verification email

---

### SubscriptionsPage

**What it dos:** Manage subscription plans and billing.

**UI Components:**
- Plan cards (Free, Starter, Professional)
- Feature comparison
- Select plan button
- Billing portal link
- Usage display

---

## Admin Pages

### AdminDashboardPage

**What it does:** Admin overview with system stats and error overview.

**UI Components:**
- Stats cards (users, jobs, CVs, credits)
- Error stats summary
- External API calls table
- Credits usage chart

---

### AdminUsersPage

**What it does:** Paginated user list with search.

**UI Components:**
- User table/cards
- Search input
- Pagination controls

---

### AdminUserDetailPage

**What it does:** Admin view of user details, CVs, usage, subscription management.

**UI Components:**
- User info header
- CV library list
- Usage history table
- Grant credits form
- Plan management
- Role management
- Block/unblock controls
- Cancel subscription button
- CV preview modal

---

### AdminErrorsPage

**What it does:** Admin error log viewer with filtering and resolution.

**UI Components:**
- Error stats cards
- Error log table
- Filters (type, severity, resolved)
- Pagination
- Resolve controls
- Bulk resolve

---

## UI Components (Shared)

### Common Components

- **Button** - Primary, secondary, outline, ghost variants
- **Input** - Text input with label and error handling
- **Textarea** - Multi-line text input
- **Select** - Dropdown selection
- **Badge** - Status/count indicator
- **Card** - Container component
- **Spinner** - Loading indicator
- **SimpleLoader** - Alternative loading state
- **Toast** - Notification messages
- **ConfirmModal** - Confirmation dialogs
- **ErrorAlert** - Error display
- **TableOrCards** - Responsive table/cards toggle

### Layout Components

- **MainLayout** - App shell with sidebar
- **Sidebar** - Navigation sidebar

---

## Feature Components

### CV Editor

- **CvDocumentRenderer** - Renders CV to preview
- **SectionManager** - Manages CV sections
- **EditableText** - Inline editable text
- **EditableTextarea** - Inline editable textarea
- **EditableList** - Inline editable list
- **CvPreviewModal** - CV PDF preview modal
- **SectionAnalysisPanel** - AI analysis sidebar

### Reviews & Finalization

- **TailoredCvPage** - CV tailoring interface
- **CoverLetterPage** - Cover letter editor
- **ReviewPageHeader** - Header component
- **ReviewTabsNavigation** - Tab navigation
- **JobDescriptionInsights** - AI insights
- **GenerationProgressModal** - Progress indicator

### Chat

- **JobChatWindow** - Chat panel
- **FloatingChatButton** - Chat toggle
- **JobChatModal** - Chat in modal

### Analytics

- **WeeklyGoalWidget** - Goal tracking
- **PipelineConversionWidget** - Funnel stats
- **ApplicationsOverTimeChart** - Line chart
- **RecentActivityWidget** - Activity list
- **WorkTrackerStatsWidget** - Work hours stats
- **WorkHoursChart** - Bar chart
- **EmployerDistributionChart** - Pie chart

### Portfolio

- **PortfolioLayout** - Portfolio container
- **About** - About section
- **Projects** - Project cards

---

This documentation covers all main pages and their core UI components.