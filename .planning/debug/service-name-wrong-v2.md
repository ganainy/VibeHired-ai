---
status: awaiting_human_verify
trigger: "service-name-wrong-continued"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus
hypothesis: Fix applied to frontend service column logic
test: Verified with mock data - all test cases pass correctly
expecting: Service column will show backend endpoint names like "AI Generate", "Apify Fetch", etc.
next_action: Request human verification

## Symptoms
expected: Backend endpoint path (e.g., `/api/jobs`, `/api/ai/generate`, `/api/cvs/upload`, `/api/apify/fetch`)
actual: Shows generic messages like "Gemini Generate Content" or "Gemini API" in the service column
errors: No errors reported
reproduction: Open /admin dashboard and view "Recent AI & Apify Calls" section - the Service column shows wrong values
started: Has never worked correctly - always showed external API names instead of backend endpoints

## Eliminated

## Evidence
- timestamp: 2026-03-28
  checked: authMiddleware.ts, requestContext.ts, externalCallTracking.ts
  found: Backend correctly sets requestPath from async context in authMiddleware.ts line 65 and 68. persistLog() saves it as requestPath field (line 158)
  implication: Backend data flow is correct - requestPath should contain backend endpoint path like /api/ai/generate
- timestamp: 2026-03-28
  checked: externalCallTracking.ts persistLog() function (line 158)
  found: requestPath is saved as: requestPath: backendRequestPath || parsed.pathname. If backendRequestPath is available, it's used; otherwise falls back to parsed.pathname (external API path)
  implication: If getRequestPath() returns undefined, the fallback is the external API path, which explains the issue
- timestamp: 2026-03-28
  checked: AdminDashboardPage.tsx service column rendering (lines 207-240)
  found: Frontend logic checks c.requestPath for patterns like "generatecontent", "streamgeneratecontent", etc. (lines 217-222). These are external API path patterns, not backend endpoint patterns
  implication: Frontend is checking requestPath field for external API patterns, but requestPath should contain the backend endpoint path (e.g., /api/ai/generate), not the external API path (e.g., /v1beta/models/...:generateContent)
- timestamp: 2026-03-28
  checked: adminController.ts recentCalls projection (lines 199-234)
  found: The projection includes both path (external API path, line 217) and requestPath (backend endpoint path, line 219) in the response
  implication: Both fields are available to frontend, but frontend is using the wrong logic to display them
- timestamp: 2026-03-28
  checked: Frontend logic test with mock data
  found: When requestPath = '/api/ai/generate' and provider = 'gemini', the frontend returns 'Gemini API' because '/api/ai/generate' doesn't contain 'generatecontent'. When requestPath contains the external API path like '/v1beta/models/gemini-pro:generateContent', it correctly returns 'Gemini Generate Content'
  implication: The previous fix made backend save the correct data (backend endpoint path), but the frontend logic was written to expect the external API path in requestPath

## Resolution
root_cause: Frontend logic in AdminDashboardPage.tsx was checking requestPath field for external API path patterns (e.g., "generatecontent"), but the backend fix made requestPath store the backend endpoint path (e.g., "/api/ai/generate") instead. The frontend expected the external API path in requestPath, but it should have been parsing the backend endpoint path for display.
fix: Updated frontend service column rendering logic (client/src/pages/AdminDashboardPage.tsx lines 207-240) to map backend endpoint paths to friendly service names. Changed from checking for external API patterns to checking for backend endpoint patterns like "/api/ai/generate" -> "AI Generate", "/api/apify/fetch" -> "Apify Fetch", etc.
verification: Tested with mock data - all test cases pass correctly:
- /api/ai/generate -> AI Generate
- /api/ai/chat -> AI Chat
- /api/ai/embed -> AI Embed
- /api/apify/fetch -> Apify Fetch
- /api/apify/actors -> Apify Actors
- /api/cvs/upload -> CV Upload
- /api/cvs/parse -> CV Parse
- /api/jobs -> Jobs List
- /api/jobs/123 -> Jobs Service
- /api/some-other-endpoint -> Some Other Endpoint
- undefined -> -
files_changed: ["client/src/pages/AdminDashboardPage.tsx"]
root_cause:
fix:
verification:
files_changed: []
