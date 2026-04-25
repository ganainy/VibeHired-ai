# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## today-applications-count-bug — TODAY'S APPLICATIONS counts jobs regardless of status
- **Date:** 2026-03-27
- **Error patterns:** TODAY'S APPLICATIONS, count, status, Applied, Not Applied, filter, todayCount
- **Root cause:** The todayCount filter in DashboardPage.tsx only checked if a job was created today, but did not filter by job.status, causing all jobs created today to be counted regardless of their status.
- **Fix:** Added job.status === 'Applied' condition to the filter so only jobs with status 'Applied' created today are counted.
- **Files changed:** client/src/pages/DashboardPage.tsx

---

## admin-calls-delay-empty-fields — Admin panel shows AI/Apify calls with 5-minute delay and empty service/user fields
- **Date:** 2026-03-28
- **Error patterns:** admin, delay, empty fields, service, user, AI calls, Apify calls, 5-minute, requestPath, userId, userEmail, async context, asyncLocalStorage
- **Root cause:** authMiddleware set up asyncLocalStorage.run() but never called setUserId/setUserEmail() to populate fallback storage. When Google SDK's internal HTTP calls broke the async context chain, getUserId() fell back to currentUserId which was undefined (never set).
- **Fix:** Import setUserId, setUserEmail, clearFallbackContext in authMiddleware.ts. Call setUserId()/setUserEmail() after req.user is populated. Call clearFallbackContext() on res.finish. Also reduced stats cache from 5 minutes to 30 seconds and added requestPath/requestMethod to persistLog doc.
- **Files changed:** server/src/middleware/authMiddleware.ts, server/src/controllers/adminController.ts, server/src/services/externalCallTracking.ts, server/src/services/requestContext.ts, server/src/index.ts

---

## recording-button-state-stuck-after-release — Hold-to-record button stays glowing during transcription
- **Date:** 2026-03-28
- **Error patterns:** recording, button, glow, stuck, state, transcription, setIsRecording, onstop, mediaRecorder
- **Root cause:** In useAudioRecording.ts, setIsRecording(false) was called AFTER awaiting transcribeAudio(), which meant the recording state stayed true during the entire transcription process, causing the button to continue glowing.
- **Fix:** Moved setIsRecording(false), microphone track cleanup, and mediaRecorder cleanup to execute immediately when onstop fires, before the async transcription call. This ensures the UI updates to show the button as released immediately, while transcription happens in the background.
- **Files changed:** electron/src/hooks/useAudioRecording.ts

---

## pdf-download-400-error — PDF download fails with HTTP 400 Bad Request
- **Date:** 2026-04-06
- **Error patterns:** PDF download, 400 Bad Request, Authorization header, filename validation, sanitizeForFilename, regex validation, AI-generated filenames
- **Root cause:** Three issues: (1) Client-side handleDownload function was missing Authorization header. (2) The filename validation regex `/^[a-zA-Z0-9._-]+$/` was too strict and didn't allow spaces. (3) AI-generated filenames were NOT being sanitized before storage - sanitizeForFilename was only used as a fallback, not on AI-generated filenames which contained spaces, &, and other special characters.
- **Fix:** 1. Added Authorization header to axios.get() requests in both usePdfGeneration and useReviewCoverLetterPdf hooks. 2. Updated filename validation regex to `/^[a-zA-Z0-9_.\-+&\(\)\s]+$/` to allow spaces, &, +, and () for existing files. 3. Modified coverLetterService.ts to ALWAYS sanitize filenames (both AI-generated and fallback) before storing.
- **Files changed:** client/src/pages/review-finalize/hooks/usePdfGeneration.ts, client/src/pages/review-finalize/hooks/useReviewCoverLetterPdf.ts, server/src/services/coverLetterService.ts, server/src/validations/commonSchemas.ts

---

## manage-cv-setisanalysisoutdated-undefined — Manage CV page throws setIsAnalysisOutdated is not defined
- **Date:** 2026-04-23
- **Error patterns:** Manage CV, setIsAnalysisOutdated is not defined, useState, missing declaration, CVManagementPage.tsx
- **Root cause:** Missing `useState` declaration for `isAnalysisOutdated` in `CVManagementPage.tsx`. The setter `setIsAnalysisOutdated` was used in three places but the corresponding state tuple was never destructured from a `useState` call.
- **Fix:** Added `const [isAnalysisOutdated, setIsAnalysisOutdated] = useState<boolean>(false);` to the analysis state block in `CVManagementPage.tsx`.
- **Files changed:** client/src/pages/CVManagementPage.tsx

---
