---
status: resolved
trigger: "admin-calls-delay-empty-fields"
created: 2026-03-28T00:00:00.000Z
updated: 2026-03-28T16:45:00.000Z
---

## Current Focus
hypothesis: ROOT CAUSE FOUND: authMiddleware sets up asyncLocalStorage but never calls setUserId/setUserEmail() to populate the fallback storage
test: Fixed authMiddleware to import and call setUserId(), setUserEmail(), and clearFallbackContext()
expecting: Fallback storage will now be populated, getUserId() will return values even when async context is lost
next_action: Request user verification that User field now shows correct values

## Symptoms
expected: AI/Apify calls should appear immediately when refreshing the admin panel
actual: Calls appear after 5+ minute delay with empty service and user fields (service="", user="-")
errors: None explicitly reported, but empty fields indicate data not being saved correctly
reproduction: |
  1. Add a new CV in /manage (this triggers an AI/Apify call)
  2. Go to /admin dashboard
  3. Check "Recent AI & Apify Calls" table
  4. The new action doesn't appear immediately, appears after 5+ minutes with empty fields
started: Issue ongoing - unclear if it ever worked correctly

## Eliminated

## Evidence
- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/index.ts - middleware setup
  found: createRequestContextMiddleware IS registered at line 104 (this was fixed in previous debug session)
  implication: User context should be available, so empty user fields suggest a different issue

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/controllers/adminController.ts - getAdminStats()
  found: Stats cache with 5-minute TTL (STATS_CACHE_TTL_MS = 5 * 60 * 1000 at line 17, cache set at line 289)
  implication: Recent AI & Apify calls data is cached for 5 minutes, explaining the "delay" - new calls only appear after cache expires

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/controllers/adminController.ts - recentCalls query (lines 199-234)
  found: Query uses $lookup to join users collection and has fallback: userEmail field OR userInfo.email from $lookup
  implication: If userEmail is missing and $lookup fails, the user field would be empty

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/models/ExternalCallLog.ts
  found: Schema has category, provider, userId, userEmail fields - NO "service" field exists
  implication: User's report of "empty service" field may refer to "provider" field or a frontend display issue

- timestamp: 2026-03-28T00:00:00.000Z
  checked: client/src/pages/AdminDashboardPage.tsx (lines 204-228)
  found: "Service" column renders from c.requestPath field (line 207-213), shows "-" if requestPath is missing
  implication: Empty service field means requestPath is not being saved in the database

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/services/externalCallTracking.ts - persistLog() function (lines 140-151)
  found: The doc object being saved does NOT include requestPath field - only has category, provider, host, path, method, statusCode, success, durationMs, modelName, errorMessage
  implication: requestPath is never saved to database, so "Service" column always shows "-"

- timestamp: 2026-03-28T00:00:00.000Z
  checked: User feedback after fixes applied
  found: Delay is FIXED (calls appear immediately), Service field now shows "models gemini-3-flash-preview:generateContent", but User field shows "-"
  implication: Cache and requestPath fixes worked, but userId/userEmail are still not being captured

- timestamp: 2026-03-28T00:00:00.000Z
  checked: server/src/adapters/geminiAdapter.ts - how AI calls are made
  found: GeminiAdapter.generateContent() calls GoogleGenerativeAI SDK's model.generateContent() method at line 80
  implication: The SDK makes internal HTTP calls through its own fetch, which may not preserve async local storage context

- timestamp: 2026-03-28T15:30:00.000Z
  checked: Call chain analysis: authMiddleware -> generateContentWithFile -> GeminiAdapter -> Google SDK -> fetch interceptor
  found: authMiddleware DOES set up asyncLocalStorage.run({userId, userEmail}) correctly at lines 58-64 of authMiddleware.ts. However, the Google SDK's internal fetch calls happen through a promise chain that doesn't preserve the AsyncLocalStorage context
  implication: When our fetch interceptor runs getUserId()/getUserEmail(), the async context is lost because the SDK's internal HTTP calls break the async context chain

- timestamp: 2026-03-28T15:30:00.000Z
  checked: The fetch interceptor in externalCallTracking.ts (lines 176-183)
  found: Logs show "No user in context" for tracked URLs, confirming that getUserId() returns undefined when called from within the fetch interceptor
  implication: The async context established by authMiddleware is not propagating through the Google SDK's internal promise chain to our fetch interceptor

- timestamp: 2026-03-28T16:00:00.000Z
  checked: User feedback after adding module-level fallback storage
  found: User field still shows "-" even after fix. Multiple fixes attempted: (1) Removed global createRequestContextMiddleware(), (2) Added module-level fallback storage. Neither worked.
  implication: The issue may not be with context capture but with how data is saved to database or how it's queried. Need to check actual database records.

- timestamp: 2026-03-28T16:15:00.000Z
  checked: authMiddleware.ts - how it sets user context
  found: authMiddleware calls asyncLocalStorage.run() at line 62 but NEVER calls setUserId() or setUserEmail() to populate the fallback storage
  implication: The fallback storage (currentUserId/currentUserEmail) exists but is never set, so when getUserId() falls back from asyncLocalStorage to currentUserId, it gets undefined
  evidence: In requestContext.ts, getUserId() first tries asyncLocalStorage.getStore() (line 16), then returns currentUserId (line 20). But currentUserId is only set by setUserId() which is NEVER called by authMiddleware

## Resolution
root_cause: The fallback storage (currentUserId/currentUserEmail) was added to requestContext.ts but authMiddleware NEVER calls setUserId() or setUserEmail() to populate it. authMiddleware only sets up asyncLocalStorage.run() at line 62. When the Google SDK breaks the async context chain, getUserId() falls back to currentUserId, which is undefined because it was never set.
fix: Import setUserId, setUserEmail, and clearFallbackContext in authMiddleware.ts. Call setUserId() and setUserEmail() after req.user is populated to populate fallback storage. Call clearFallbackContext() on res.finish to clean up.
verification: User confirmed all issues resolved:
- Delay: Fixed (cache reduced to 30 seconds)
- Service field: Fixed (requestPath now saved)
- User field: Fixed (setUserId/setUserEmail now called in authMiddleware)
files_changed:
- server/src/controllers/adminController.ts: Changed STATS_CACHE_TTL_MS from 5 minutes to 30 seconds (PREVIOUS)
- server/src/services/externalCallTracking.ts: Added requestPath and requestMethod fields to persistLog doc, plus enhanced logging (PREVIOUS)
- server/src/services/requestContext.ts: Added fallback module-level storage for userId/userEmail that persists across SDK callbacks (PREVIOUS - INCOMPLETE)
- server/src/index.ts: Commented out global createRequestContextMiddleware() to avoid conflict with authMiddleware's context (PREVIOUS)
- server/src/middleware/authMiddleware.ts: FIXED - Imported setUserId, setUserEmail, clearFallbackContext. Added calls to populate and clear fallback storage.
