# VibeHired - Project Structure and Capabilities

This document provides an overview of the VibeHired project, detailing its structure, key components, and core capabilities.

## Project Overview

VibeHired is a full-stack AI-powered job application assistant designed to help users manage their job applications, create and optimize CVs, analyze them against job descriptions, and automate job discovery. The project is built as a monorepo, with a React frontend and a Node.js/Express backend.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts
- **Backend:** Node.js, Express, TypeScript
- **Database:** MongoDB with Mongoose ODM
- **AI Providers:** Multi-provider support via adapter pattern:
  - Google Gemini (via `@google/generative-ai` SDK)
  - OpenRouter (for access to multiple AI models)
  - Ollama (for local AI models)
- **Web Scraping:** Apify (for LinkedIn profile scraping)
- **PDF Generation:** Puppeteer
- **Authentication:** JWT (jsonwebtoken), bcryptjs
- **File Handling:** Multer
- **Image Hosting:** Cloudinary (for persistent profile images)
- **CV Schema:** JSON Resume standard
- **Charts:** Recharts (for analytics visualizations)

## Directory Structure

The project is organized into two main parts: `client` and `server`.

```
vibehired-ai/
├── client/         # React frontend application
│   ├── src/
│   │   ├── components/ # Reusable React components
│   │   ├── context/    # React context for state management (e.g., Auth, Theme)
│   │   ├── pages/      # Top-level page components
│   │   ├── services/   # API communication layer
│   │   ├── templates/  # Resume/CV templates (14 templates)
│   │   ├── utils/      # Utility functions
│   │   ├── lib/        # Library utilities
│   │   └── hooks/      # Custom React hooks
│   └── ...
├── server/         # Node.js backend application
│   ├── src/
│   │   ├── adapters/   # AI provider adapters (Gemini, OpenRouter, Ollama)
│   │   ├── controllers/ # Request handlers
│   │   ├── middleware/  # Express middleware (e.g., authentication, validation)
│   │   ├── models/      # Mongoose data models
│   │   ├── providers/   # AI provider registry and management
│   │   ├── routes/      # API route definitions
│   │   ├── services/    # Business logic
│   │   ├── utils/       # Utility functions (AI, PDF generation, etc.)
│   │   ├── validations/ # Request validation schemas
│   │   └── types/       # TypeScript type definitions
│   └── ...
├── demo/           # Screenshot assets for documentation
├── .gitignore
├── package.json    # Root package.json for managing workspaces
├── README.md
├── DEPLOYMENT.md   # Deployment guide
└── PROJECT_STRUCTURE.md
```

### Client-Side (`client/`)

The client is a single-page application (SPA) built with React and TypeScript.

- **`src/components`**: Contains reusable React components organized by feature:
  - `analytics/`: Analytics dashboard components (charts, statistics)
    - `ApplicationsByStatusChart.tsx`: Pie/bar chart for status distribution
    - `ApplicationsOverTimeChart.tsx`: Line chart for time-based trends
    - `StatsSummary.tsx`: Summary statistics display
  - `ats/`: ATS scoring and feedback components
    - `AnalysisDashboard.tsx`: Main ATS analysis dashboard
    - `AtsFeedbackPanel.tsx`: Detailed feedback panel
    - `AtsReportView.tsx`: Comprehensive ATS report view
    - `AtsScoreCard.tsx`: Score card component
    - `GeneralCvAtsPanel.tsx`: General CV ATS analysis panel
  - `auth/`: Authentication components
    - `ProtectedRoute.tsx`: Route protection wrapper
  - `chat/`: AI chat interface components
    - `FloatingChatButton.tsx`: Floating chat button
    - `JobChatModal.tsx`: Modal chat interface
    - `JobChatWindow.tsx`: Chat window component
  - `common/`: Shared UI components
    - `ConfirmModal.tsx`: Confirmation dialog
    - `ErrorAlert.tsx`: Error display component
    - `LoadingSkeleton.tsx`: Loading skeleton placeholder
    - `SearchableSelect.tsx`: Searchable select dropdown
    - `Spinner.tsx`: Loading spinner
    - `Toast.tsx`: Toast notification component
  - `cv-editor/`: Comprehensive CV editor with section-by-section editing
    - `ArrayItemControls.tsx`: Controls for array items
    - `BasicsEditor.tsx`: Basic information editor
    - `CertificatesEditor.tsx`: Certificates section editor
    - `CvDocumentRenderer.tsx`: Document renderer
    - `CvFormEditor.tsx`: Main CV form editor
    - `CvLivePreview.tsx`: Live preview component
    - `CvPreviewModal.tsx`: Preview modal
    - `EditableList.tsx`: Editable list component
    - `EditableText.tsx`: Editable text component
    - `EditableTextarea.tsx`: Editable textarea component
    - `EducationEditor.tsx`: Education section editor
    - `LanguagesEditor.tsx`: Languages section editor
    - `ProjectsEditor.tsx`: Projects section editor
    - `SectionAnalysisPanel.tsx`: AI analysis panel for sections
    - `SectionManager.tsx`: Section management component
    - `SkillsEditor.tsx`: Skills section editor
    - `WorkExperienceEditor.tsx`: Work experience editor
    - `types.ts`: Type definitions
  - `cv-management/`: CV management components
    - `Sidebar.tsx`: Sidebar navigation for CV branch list
  - `cv-workspace/`: Unified CV edit workspace components
    - `CvEditorPanel.tsx`: Combines the live CV preview and section editor into a single A4-surface panel (used by the unified edit/review flow)
  - `layout/`: Application shell components
    - `Header.tsx`: Top navigation bar (user menu, theme toggle)
    - `MainLayout.tsx`: Root authenticated layout wrapper — renders `Header`, `Sidebar`, and the page `<Outlet>`
    - `Sidebar.tsx`: Primary navigation sidebar (links to all main pages, collapsible)
  - `resume-builder/`: Standalone resume-builder widget (used in CV creation flow)
    - `ResumeBuilder.tsx`: Top-level orchestrator component
    - `Form/BaseForm.tsx`: Shared form base wrapper
    - `Form/FormSection.tsx`: Collapsible form section container
    - `Form/InputGroup.tsx`: Labelled input group layout helper
    - `Forms/ProfileForm.tsx`: Personal info & summary form
    - `Forms/WorkExperiencesForm.tsx`: Work experience entries form
    - `Forms/EducationsForm.tsx`: Education entries form
    - `Forms/SkillsForm.tsx`: Skills form
    - `Forms/ProjectsForm.tsx`: Projects form
    - `Forms/CertificatesForm.tsx`: Certificates form
    - `Forms/LanguagesForm.tsx`: Languages form
    - `types.ts`: Shared type definitions for resume-builder
    - `index.ts`: Public exports
  - `email-suggestions/`: Gmail inbox suggestion components
    - `EmailSuggestionPanel.tsx`: Slide-in sidebar panel variant — renders suggestion cards with three independent action sections (status change, AI note, calendar event)
  - `generator/`: Draft generation components
    - `UserInputModal.tsx`: Modal for user input during generation
  - `jobs/`: Job application components
    - `ApplicationCard.tsx`: Job application card
    - `ApplicationPipelineKanban.tsx`: Kanban board for pipeline view
    - `JobCvCard.tsx`: CV card for job applications
    - `JobRecommendationBadge.tsx`: Recommendation badge component
    - `JobStatusBadge.tsx`: Status badge component
    - `ProgressIndicator.tsx`: Progress indicator
  - `portfolio/`: Portfolio display components
    - `About.tsx`: About section component
    - `PortfolioLayout.tsx`: Main portfolio layout
    - `Projects.tsx`: Projects display component
  - `ui/`: UI component library
    - `badge.tsx`: Badge component
    - `separator.tsx`: Separator component
  - `CoverLetterEditor.tsx`: Cover letter editor component
  - `CoverLetterModal.tsx`: Cover letter modal
  - `EmailFormatModal.tsx`: Modal for selecting and previewing the email format of a cover letter (plain-text / formatted)
  - `NotesModal.tsx`: Notes modal component

> **Note:** The following directories are reserved for future features and currently contain only placeholder files: `analysis/`, `cover-letter/`, `dashboard/`.

- **`src/pages`**: Top-level page components:
  - `LoginPage.tsx`: User login (email/password + Google OAuth button)
  - `RegisterPage.tsx`: User registration
  - `ForgotPasswordPage.tsx`: Request a password-reset link by email
  - `ResetPasswordPage.tsx`: Set a new password via reset token (reads `?token=` from URL)
  - `GoogleAuthCallbackPage.tsx`: OAuth 2.0 callback handler — exchanges the Google code for a JWT and redirects to `/dashboard`
  - `DashboardPage.tsx`: Main dashboard with job applications
  - `AutoJobsPage.tsx`: Automated job discovery and workflow management
  - `CVManagementPage.tsx`: CV upload, parsing, and editing
  - `AnalyticsPage.tsx`: Analytics dashboard with charts and statistics
  - `PortfolioSetupPage.tsx`: Portfolio configuration and setup (5 tabs)
  - `PortfolioPage.tsx`: Public portfolio view (accessible at `/portfolio/:username`)
  - `ReviewFinalizePage.tsx`: Review and finalize generated CVs/cover letters
  - `SettingsPage.tsx`: API key management and AI provider settings
  - `EmailSuggestionsPage.tsx`: Full `/email-inbox` page — lists AI-generated inbox suggestion cards (status change, note, calendar event sections)

- **`src/services`**: API communication layer - handles all HTTP requests to backend:
  - `analysisApi.ts`: CV analysis endpoints
  - `emailSuggestionsApi.ts`: Email inbox suggestion endpoints (poll, accept, add-note, reject, preferences, Gmail scope status)
  - `analyticsApi.ts`: Analytics data endpoints
  - `atsApi.ts`: ATS scoring endpoints
  - `authApi.ts`: Authentication endpoints
  - `autoJobApi.ts`: Automated job discovery and workflow endpoints
  - `chatApi.ts`: AI chat endpoints
  - `coverLetterApi.ts`: Cover letter generation endpoints
  - `cvApi.ts`: CV management endpoints
  - `generatorApi.ts`: Draft generation endpoints
  - `jobApi.ts`: Job application CRUD endpoints
  - `jobRecommendationApi.ts`: Job recommendation endpoints
  - `portfolioApi.ts`: Portfolio data endpoints
  - `settingsApi.ts`: Settings and API key management endpoints

- **`src/templates`**: Resume/CV templates (14 professional templates):
  - `ATSOptimizedResume.tsx`: ATS-optimized template
  - `BoldCreativeResume.tsx`: Bold creative design
  - `ClassicProfessionalResume.tsx`: Classic professional layout
  - `CorporateProfessionalResume.tsx`: Corporate professional style
  - `CreativeDesignResume.tsx`: Creative design for designers
  - `ElegantMinimalistResume.tsx`: Elegant minimalist design
  - `ElitePremiumResume.tsx`: Premium executive design
  - `EngineeringResume.tsx`: Engineering-focused template
  - `GermanLatexResume.tsx`: LaTeX-style professional CV
  - `MinimalistResume.tsx`: Simple minimalist design
  - `ModernA4Resume.tsx`: Modern A4 format
  - `ModernCleanResume.tsx`: Clean modern design
  - `ModernTwoColumnResume.tsx`: Two-column modern layout
  - `SoftwareEngineerResume.tsx`: Software engineer optimized
  - `config.ts`: Template configuration and registry
  - `index.ts`: Template exports
  - `TemplateWrapper.tsx`: Template wrapper component

- **`src/context`**: React Context providers for global state:
  - `AuthContext.tsx`: User authentication state
  - `ThemeContext.tsx`: Dark/light theme management

- **`src/utils`**: Utility functions:
  - `cvDataTransform.ts`: CV data transformation utilities
  - `dateUtils.ts`: Date formatting and manipulation

- **`src/lib`**: Library utilities:
  - `utils.ts`: General utility functions

### Server-Side (`server/`)

The server is a RESTful API built with Node.js, Express, and TypeScript.

- **`src/adapters`**: AI provider adapters implementing a unified interface:
  - `base.ts`: Base adapter interface
  - `geminiAdapter.ts`: Google Gemini adapter
  - `ollamaAdapter.ts`: Ollama (local AI) adapter
  - `openRouterAdapter.ts`: OpenRouter adapter

- **`src/controllers`**: Request handlers that validate data and call services:
  - `analysisController.ts`: CV analysis against job descriptions
  - `analyticsController.ts`: Job application statistics and analytics
  - `atsController.ts`: ATS scoring and feedback
  - `autoJobController.ts`: Automated job discovery workflow management
  - `chatController.ts`: AI chat conversation handling
  - `generatorController.ts`: Draft generation for CVs and cover letters
  - `githubController.ts`: GitHub integration for portfolio
  - `linkedinController.ts`: LinkedIn profile scraping
  - `profileController.ts`: User profile management
  - `projectController.ts`: Portfolio project management

- **`src/models`**: Mongoose schemas for MongoDB collections:
  - `User.ts`: User accounts with authentication
  - `CV.ts`: Unified CV model (Master and Job-specific versions)
  - `JobApplication.ts`: Job application tracking
  - `Profile.ts`: User profiles with integrations (Gemini, Apify, GitHub)
  - `Project.ts`: Portfolio projects
  - `AutoJob.ts`: Automated job discovery results
  - `WorkflowRun.ts`: Automated workflow execution tracking
  - `ResumeCache.ts`: Cached resume parsing results
  - `CvAnalysis.ts`: CV analysis results with detailed ATS scores
  - `EmailSuggestion.ts`: Pending AI inbox suggestions (status change, note, calendar event) with a 90-day TTL

- **`src/providers`**: AI provider registry and management:
  - `base.ts`: Base provider interface
  - `enums.ts`: Provider enum definitions (GEMINI, OPENROUTER, OLLAMA)
  - `geminiProvider.ts`: Gemini provider implementation
  - `ollamaProvider.ts`: Ollama provider implementation
  - `openRouterProvider.ts`: OpenRouter provider implementation
  - `registry.ts`: Provider registry for dynamic provider selection
  - `index.ts`: Provider exports

- **`src/routes`**: API route definitions mapping endpoints to controllers:
  - `analysis.ts`: `/api/analysis` - CV analysis endpoints
  - `analytics.ts`: `/api/analytics` - Analytics data endpoints
  - `atsRoutes.ts`: `/api/ats` - ATS scoring endpoints
  - `auth.ts`: `/api/auth` - Authentication endpoints (login, register)
  - `autoJobRoutes.ts`: `/api/auto-jobs` - Automated job discovery endpoints
  - `chat.ts`: `/api/chat` - AI chat endpoints
  - `coverLetter.ts`: `/api/cover-letter` - Cover letter endpoints
  - `cvs.ts`: `/api/cvs` - Unified CV management endpoints (Master & Job CVs)
  - `generator.ts`: `/api/generator` - Draft generation endpoints
  - `github.ts`: `/api/github` - GitHub integration endpoints
  - `jobApplications.ts`: `/api/job-applications` - Job application CRUD
  - `linkedin.ts`: `/api/linkedin` - LinkedIn scraping endpoints
  - `profile.ts`: `/api/profile` - Profile management endpoints
  - `projects.ts`: `/api/projects` - Portfolio project endpoints
  - `settings.ts`: `/api/settings` - Settings and API key management
  - `emailSuggestions.ts`: `/api/email-suggestions` - Gmail inbox scanning, AI suggestion CRUD, add-note, and accept-with-calendar actions

- **`src/services`**: Core business logic:
  - `analysisService.ts`: CV analysis logic
  - `analyticsService.ts`: Analytics calculations and aggregations
  - `atsGeminiService.ts`: ATS scoring using AI
  - `autoJobWorkflow.ts`: Automated job discovery workflow orchestration
  - `chatService.ts`: AI chat conversation handling
  - `coverLetterService.ts`: Cover letter generation logic
  - `generatorService.ts`: Draft generation orchestration
  - `githubService.ts`: GitHub API integration
  - `jobAcquisitionService.ts`: Job posting acquisition and extraction
  - `jobAnalysisService.ts`: Job description analysis
  - `jobRelevanceService.ts`: Job relevance scoring
  - `jobRecommendationService.ts`: Job recommendation engine
  - `linkedinService.ts`: LinkedIn profile scraping via Apify
  - `resumeCacheService.ts`: Resume parsing cache management
  - `workflowProgressHelper.ts`: Workflow progress tracking utilities
  - `emailSuggestionService.ts`: Gmail polling, AI email classification (status + note + calendar), fuzzy job matching, suggestion persistence
  - `googleCalendarService.ts`: Google Calendar event creation via OAuth token; checks Calendar scope availability

- **`src/utils`**: Utility functions and helpers:
  - `aiExtractor.ts`: AI-powered data extraction from job postings
  - `aiService.ts`: Unified AI service interface
  - `geminiClient.ts`: Google Gemini API client wrapper
  - `pdfGenerator.ts`: PDF generation using Puppeteer
  - `pdfTemplates.ts`: PDF template definitions
  - `cvTemplates.ts`: CV template utilities
  - `cvTextExtractor.ts`: Text extraction from CV files
  - `scraper.ts`: Web scraping utilities
  - `htmlCleaner.ts`: HTML cleaning utilities
  - `apiKeyHelpers.ts`: API key validation and management
  - `encryption.ts`: Encryption utilities for sensitive data
  - `asyncHandler.ts`: Async error handling wrapper
  - `rateLimiter.ts`: Rate limiting utilities
  - `scheduler.ts`: Task scheduling utilities
  - `errors/AppError.ts`: Custom error classes
  - `analysis/scoringUtil.ts`: Analysis scoring utilities

- **`src/validations`**: Request validation schemas:
  - `analysisSchemas.ts`: CV analysis validation
  - `atsSchemas.ts`: ATS analysis validation
  - `authSchemas.ts`: Authentication validation
  - `chatSchemas.ts`: Chat request validation
  - `commonSchemas.ts`: Common validation schemas
  - `generatorSchemas.ts`: Draft generation validation
  - `jobApplicationSchemas.ts`: Job application validation

- **`src/middleware`**: Express middleware:
  - `authMiddleware.ts`: JWT authentication verification
  - `errorHandler.ts`: Global error handling
  - `validateRequest.ts`: Request validation middleware

- **`src/types`**: TypeScript type definitions:
  - `jsonresume.d.ts`: JSON Resume type definitions

- **`src/scripts`**: Utility scripts:
  - `migrateGeminiKeys.ts`: Migration script for Gemini API keys
  - `fix-cv-index.ts`: Fixes unique index issues on CV collection

- **`src/config`**: Configuration files:
  - `cloudinary.ts`: Cloudinary configuration and upload utility
  - `env.ts`: Environment variable validation and loading

## Core Capabilities

### User Management
- **Authentication**: Secure user registration and login with JWT tokens
- **Profile Management**: User profiles with optional username for portfolio URLs
- **Settings**: Per-user API key management (Gemini, OpenRouter, Ollama, Apify, GitHub)
- **Multi-Provider AI Support**: Choose between Gemini, OpenRouter, or Ollama for AI features

### Job Application Management
- **CRUD Operations**: Create, read, update, and delete job applications
- **Automated Job Creation**: Extract job details from URLs using AI
- **Status Tracking**: Track applications through multiple stages (Applied, Interview, Assessment, Offer, Rejected)
- **Dashboard Views**: Table view with filtering and sorting, plus kanban pipeline view
- **Notes & Metadata**: Store notes, URLs, languages, and other job-related information
- **Job Recommendations**: AI-powered job recommendation system with relevance scoring

### Automated Job Discovery (Auto Jobs)
- **Workflow System**: Automated job discovery workflow with progress tracking
- **Job Acquisition**: Automatically fetch jobs from job boards based on search criteria
- **AI Analysis**: Analyze job descriptions to extract skills, requirements, and company insights
- **Relevance Scoring**: AI-powered relevance scoring to identify best-fit opportunities
- **Content Generation**: Automatically generate customized CVs and cover letters for relevant jobs
- **Workflow Management**: Track workflow runs with detailed progress and statistics
- **Settings Management**: Configure search parameters (keywords, location, job type, experience level)
- **Duplicate Detection**: Prevent duplicate job entries
- **Status Tracking**: Track processing status (pending, analyzed, relevant, not_relevant, generated, error)

### CV Management
- **CV Upload**: Support for multiple formats (PDF, DOCX, RTF, TXT)
- **Unified CV Architecture**: Single "Master CV" source of truth with support for unlimited job-specific variations
- **Format Agnostic**: Stores CV data in a structured JSON Resume format
- **Master vs. Job CVs**: Clear distinction between the master document and tailored versions for specific applications
- **Rich Editor**: Comprehensive section-by-section CV editor:
  - Basics (contact info, summary)
  - Work experience with detailed editing
  - Education history
  - Skills with categorization
  - Projects and achievements (Unified "Projects" section)
  - Certificates
  - Languages
- **Rich Text Support**: Markdown-style bolding support in custom sections for all major templates
- **CV Analysis**: AI-powered analysis of CV sections with improvement suggestions
- **Multiple Versions**: Store and manage multiple CV versions
- **14 Resume Templates**: Professional templates for different industries and styles:
  - ATS Optimized, Modern Clean, Classic Professional, Minimalist
  - Bold Creative, Corporate Professional, Creative Design
  - Elegant Minimalist, Elite Premium, Engineering
  - Modern A4, Modern Two Column, Software Engineer, German LaTeX
  - **Enhanced Rendering**: Projects consolidated into single section, ATS-friendly skill lists (Modern Clean)

### AI-Powered Features
- **Multi-Provider Support**: Choose from Gemini, OpenRouter, or Ollama
- **CV Analysis**: Analyze CV against job descriptions to identify strengths and improvement areas
- **Cover Letter Generation**: AI generates tailored cover letters based on CV and job description
- **ATS Scoring**: Get ATS (Applicant Tracking System) compatibility scores with detailed feedback
- **Chat Assistance**: AI chat interface for each job application to get help and suggestions
- **Job Description Extraction**: Automatically extract structured data from job posting URLs
- **Draft Generation**: Generate tailored CV and cover letter drafts for specific applications
- **Placeholder System**: Smart placeholder handling for missing information with user input modals
- **Job Recommendation**: AI-powered job recommendation system with relevance scoring
- **Company Insights**: Extract company mission, values, and business model from job postings

### Analytics & Reporting
- **Statistics Dashboard**: Overview of total applications, status breakdowns, and trends
- **Visual Charts**: 
  - Applications by status (pie/bar charts)
  - Applications over time (line charts)
- **Pipeline Management**: Interactive kanban board for visual pipeline tracking
- **Real-time Updates**: Statistics update automatically as data changes
- **Workflow Statistics**: Track automated job discovery workflow metrics

### Portfolio System
- **Portfolio Setup**: Comprehensive setup page for configuring portfolios
- **Public Portfolios**: Shareable public portfolio pages at `/portfolio/:username`
- **GitHub Integration**: Connect GitHub account to automatically import projects
- **LinkedIn Integration**: Sync LinkedIn profile data (optional, requires Apify token)
- **Project Management**: Add, edit, and organize projects with:
  - Featured projects
  - Technology tags and filtering
  - Project descriptions and media
  - GitHub repository links
- **Portfolio Publishing**: Toggle portfolio visibility (public/private)

### Document Generation
- **PDF Generation**: Generate professional PDF documents for CVs and cover letters using Puppeteer
- **Review & Finalization**: Review page for editing and finalizing generated documents
- **Draft Management**: Save and retrieve drafts for later editing
- **Download System**: Secure download of generated PDF files
- **Template Selection**: Choose from 14 professional resume templates

### Web Scraping
- **Job Posting Extraction**: Fetch and parse job posting content from URLs
- **LinkedIn Profile Scraping**: Extract LinkedIn profile data using Apify integration

### Workflow & Automation
- **Automated Job Discovery**: Automated workflow for discovering and analyzing job opportunities
- **Progress Tracking**: Real-time progress tracking for workflow runs
- **Workflow Statistics**: Detailed statistics on workflow execution
- **Error Handling**: Comprehensive error handling and reporting for workflows
- **Cancellation Support**: Ability to cancel running workflows
