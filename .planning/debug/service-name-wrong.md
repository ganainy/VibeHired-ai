---
status: verifying
trigger: "service-name-wrong"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T16:50:00Z
---

## Current Focus
hypothesis: FIX APPLIED: Added requestPath: req.path to the asyncLocalStorage.run() context object in authMiddleware.ts line 68.
test: User needs to restart server, upload a CV to /manage-cv page, then check admin dashboard
expecting: Service field should now show "/api/cvs/upload" instead of "Gemini API"
next_action: Request human verification of the fix

## Symptoms
expected: Backend endpoint path (e.g., `/api/jobs`, `/api/ai/generate`, `/api/apify/fetch`)
actual: Always shows "generateContent" for every call in the service field
errors: No errors - neither console nor server errors reported
reproduction: Just open /admin dashboard and view "Recent AI & Apify Calls" section
started: Never worked - has always shown "generateContent" since beginning

## Eliminated
- hypothesis: The previous fix (adding requestPath to RequestContext, setting fallback in authMiddleware, using getRequestPath() in persistLog) was incorrect
  evidence: The previous fix did set up the infrastructure correctly, but the critical missing piece was including requestPath in the async context object itself. The fallback mechanism was working but was getting cleared too early.
  timestamp: 2026-03-28T16:48:00.000Z

- hypothesis: getRequestPath() returns undefined because the module-level fallback variable is not set
  evidence: The fallback variable IS being set (line 65 in authMiddleware calls setRequestPath(req.path)), but it gets cleared when the HTTP response finishes (line 73 calls clearFallbackContext()). The AI call completes asynchronously, after the response finishes.
  timestamp: 2026-03-28T16:48:00.000Z
## Evidence
- timestamp: 2026-03-28T00:00:00.000Z
  checked: client/src/pages/AdminDashboardPage.tsx - Service column rendering (lines 207-240)
  found: Service column uses c.requestPath (line 211), which it expects to be the backend endpoint. If requestPath contains the external API path, it shows "Gemini Generate Content" (line 218) based on parsing the path.
  implication: The frontend expects requestPath to be the backend endpoint, but the data is actually the external API path

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/controllers/adminController.ts - recentCalls projection (lines 199-234)
  found: Returns requestPath field (line 219) which is passed to the frontend
  implication: The data flow is: persistLog -> database -> adminController -> frontend

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/services/externalCallTracking.ts - persistLog() function (lines 145-172)
  found: At line 156, requestPath is set to parsed.pathname which is the external API path (e.g., /v1beta/models/...:generateContent)
  implication: This is the root cause - requestPath should store the backend endpoint path, not the external API path

- timestamp: 2026-03-28T00:00:00.000Z
  checked: Previous resolved issue admin-calls-delay-empty-fields.md
  found: Evidence line 60 shows "Service field now shows 'models gemini-3-flash-preview:generateContent'" after the fix added requestPath
  implication: The fix in the previous issue correctly stored the external API path, but this was misnamed as "requestPath" when it should have been something else like "externalPath"

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/services/requestContext.ts - RequestContext interface and functions
  found: RequestContext interface (lines 3-6) only has userId and userEmail. No requestPath field exists.
  implication: Need to add requestPath to RequestContext and create getter/setter functions for it

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/middleware/authMiddleware.ts - how context is set up
  found: authMiddleware sets userId and userEmail (lines 63-64) but not requestPath. The req object has req.path available.
  implication: Need to add setRequestPath() call with req.path in authMiddleware after the user context is set

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/services/externalCallTracking.ts - persistLog() usage of context
  found: Lines 134-135 use getUserId() and getUserEmail() from requestContext. Need to add getRequestPath() and use it for the requestPath field instead of parsed.pathname
  implication: This will make requestPath store the backend endpoint instead of the external API path

- timestamp: 2026-03-28T16:45:00.000Z
  checked: authMiddleware.ts line 68 - asyncLocalStorage.run() call
  found: asyncLocalStorage.run({ userId, userEmail }, () => { - requestPath is NOT included in the context object
  implication: When getRequestPath() is called, it first tries to get from asyncLocalStorage.getStore().requestPath which doesn't exist, then falls back to module-level variable

- timestamp: 2026-03-28T16:45:00.000Z
  checked: authMiddleware.ts lines 72-75 - response finish handler
  found: res.on('finish', () => { clearFallbackContext(); }); - clears the fallback module-level variables when response finishes
  implication: AI call happens asynchronously, likely AFTER response finishes, so currentRequestPath is cleared before the AI call completes. RequestPath becomes undefined, so persistLog falls back to parsed.pathname (external API path)

- timestamp: 2026-03-28T16:45:00.000Z
  checked: externalCallTracking.ts line 158 - fallback logic
  found: requestPath: backendRequestPath || parsed.pathname - if getRequestPath() returns undefined, it uses parsed.pathname
  implication: This confirms the bug: when requestPath is undefined, it defaults to the external API path

- timestamp: 2026-03-28T16:45:00.000Z
  checked: cvs.ts line 572 - CV upload endpoint
  found: POST /api/cvs/upload is the endpoint that calls parseUploadedCv -> generateContentWithFile
  implication: The expected service field should show "/api/cvs/upload", not "Gemini API"

- timestamp: 2026-03-28T16:48:00.000Z
  checked: authMiddleware.ts after fix - line 68
  found: asyncLocalStorage.run({ userId, userEmail, requestPath: req.path }, () => { - now includes requestPath in context
  implication: The async context now has requestPath, so even if the fallback is cleared, getRequestPath() will return the correct backend path from the async context

## Resolution
root_cause: The asyncLocalStorage.run() call in authMiddleware didn't include requestPath in the context object. It only passed { userId, userEmail }, so when AI SDK callbacks ran (which lose async context), getRequestPath() returned undefined and fell back to the module-level variable currentRequestPath. However, this fallback gets cleared when the HTTP response finishes (res.on('finish')), which happens before the AI call completes. When requestPath is undefined, persistLog() falls back to parsed.pathname (the external API path like "/v1beta/models/...:generateContent").
fix: Modified authMiddleware.ts line 68 to include requestPath in the async context: asyncLocalStorage.run({ userId, userEmail, requestPath: req.path }, () => {. This ensures that even if the fallback module-level variable is cleared, the async context still has the correct backend request path.
verification: Needs human verification - start the server, upload a CV to /manage-cv page, then check the admin dashboard to confirm the Service field shows the backend endpoint path (e.g., "/api/cvs/upload") instead of "Gemini API".
files_changed:
- server/src/middleware/authMiddleware.ts: Line 68 - Changed asyncLocalStorage.run({ userId, userEmail }, () => { to asyncLocalStorage.run({ userId, userEmail, requestPath: req.path }, () => {
