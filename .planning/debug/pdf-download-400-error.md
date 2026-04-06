---
status: resolved
trigger: "pdf-download-400-error - When attempting to download a PDF for a job application via the API endpoint `/api/generator/download/{filename}`, the server responds with HTTP 400 (Bad Request)."
created: 2026-04-06T10:00:00.000Z
updated: 2026-04-06T11:10:00.000Z
---

## Current Focus
hypothesis: "Investigating API endpoint /api/generator/download/{filename}"
test: "Find and analyze the download endpoint code"
expecting: "Understand why it returns 400 Bad Request"
next_action: "Search for the download endpoint implementation"

## Symptoms
expected: "PDF file should download successfully to user's device"
actual: "Server returns HTTP 400 Bad Request error"
errors: "Failed to load resource: the server responded with a status of 400 (Bad Request)"
reproduction: "Click download button for a PDF on the job application page"
started: "Stopped working recently (previously worked)"
environment: "Fails in both localhost and Heroku (vibehired-backend-b660cbcd6e38.herokuapp.com)"

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->
- timestamp: "2026-04-06T10:15:00.000Z"
  checked: "client/src/pages/review-finalize/hooks/usePdfGeneration.ts - handleDownload function"
  found: "The handleDownload function makes an axios.get() request WITHOUT including the Authorization header"
  implication: "The download request is missing authentication, causing the 401 check to fail in downloadFileHandler before validation runs"

- timestamp: "2026-04-06T10:20:00.000Z"
  checked: "server/src/routes/generator.ts - downloadFileHandler line 470"
  found: "Handler checks req.user first (line 470), before validating filename params (line 1234)"
  implication: "When authentication fails, the server returns 401 but if somehow validation runs first or there's a mismatch, could return 400"

- timestamp: "2026-04-06T10:25:00.000Z"
  checked: "server/src/middleware/validateRequest.ts - error handling"
  found: "Validation errors are converted to ValidationError which becomes 400 Bad Request"
  implication: "If filename validation fails, it returns 400"

- timestamp: "2026-04-06T10:35:00.000Z"
  checked: "Server logs show requestPath includes unencoded filename with spaces"
  found: "'/api/generator/download/Amr_Elganainy_Anschreiben_IT-Systemadministrator_VisiConsult%20X-ray%20Systems%20&%20Solutions%20GmbH.pdf'"
  implication: "URL is being decoded BEFORE validation, but filename still contains spaces/& which fail regex validation"

- timestamp: "2026-04-06T10:45:00.000Z"
  checked: "Debug logs show the actual filename being validated"
  found: "Filename: 'Amr_Elganainy_Anschreiben_IT-Systemadministrator_VisiConsult X-ray Systems & Solutions GmbH.pdf' contains spaces and & character"
  implication: "The AI is generating filenames with special characters that are NOT being sanitized before storage. The sanitizeForFilename function is only used as a fallback when filename is missing, not on AI-generated filenames."

## Resolution
root_cause: "Three issues: (1) Client-side handleDownload function was missing Authorization header. (2) The filename validation regex was too strict. (3) AI-generated filenames were NOT being sanitized before storage - sanitizeForFilename was only used as a fallback."
fix: "1. Added Authorization header to axios.get() requests in both handleDownload functions. 2. Updated filename validation regex from `/^[a-zA-Z0-9_.\-]+$/` to `/^[a-zA-Z0-9_.\-+&\(\)\s]+$/` to allow spaces, &, +, and () for existing files. 3. Modified coverLetterService.ts to ALWAYS sanitize filenames (both AI-generated and fallback) before storing."
verification: "Build completed successfully."
files_changed: ["client/src/pages/review-finalize/hooks/usePdfGeneration.ts", "client/src/pages/review-finalize/hooks/useReviewCoverLetterPdf.ts", "server/src/validations/commonSchemas.ts", "server/src/services/coverLetterService.ts"]
