---
status: awaiting_human_verify
trigger: "Recent AI & Apify calls in admin dashboard don't always have user field showing with real values, most of the times it shows placeholder '-'"
created: 2026-03-27T00:00:00.000Z
updated: 2026-03-27T00:00:00.000Z
---

## Current Focus
hypothesis: createRequestContextMiddleware is imported but never registered as middleware, so userId/userEmail are never set in async context
test: Confirmed - middleware is imported in index.ts but never used with app.use()
expecting: Without this middleware, the AsyncLocalStorage never gets user data, so all external calls show "-" for user
next_action: Add the request context middleware to the middleware chain before protected routes

## Symptoms
expected: Real user emails should show for all AI/Apify calls in the admin dashboard
actual: Mostly shows "-" placeholder, works sometimes but not always
errors: None reported
reproduction: View /admin dashboard, look at "Recent AI & Apify Calls" section - User column mostly shows "-"
timeline: Works sometimes but not always - inconsistent behavior

## Eliminated

## Evidence
- timestamp: 2026-03-27T00:00:00.000Z
  checked: server/src/index.ts - middleware setup
  found: createRequestContextMiddleware is imported on line 43 but never used with app.use()
  implication: The AsyncLocalStorage never gets populated with userId/userEmail from req.user

- timestamp: 2026-03-27T00:00:00.000Z
  checked: server/src/services/requestContext.ts
  found: getUserId() and getUserEmail() read from asyncLocalStorage.getStore()
  implication: If middleware never runs, these functions always return undefined

- timestamp: 2026-03-27T00:00:00.000Z
  checked: server/src/services/externalCallTracking.ts
  found: persistLog() calls getUserId() and getUserEmail() (lines 132-136) to populate log document
  implication: Since async context is never set, all logs have undefined userId/userEmail

- timestamp: 2026-03-27T00:00:00.000Z
  checked: server/src/controllers/adminController.ts - getAdminStats()
  found: Recent calls query uses $lookup to join users collection and fallback to userEmail field (lines 199-234)
  implication: Query works correctly but data was never saved in the first place

## Resolution
root_cause: createRequestContextMiddleware is imported in index.ts but never registered as middleware, so AsyncLocalStorage never gets populated with user context. All external API calls are logged without userId/userEmail, showing "-" in the admin dashboard.
fix: Added app.use(createRequestContextMiddleware()) at line 104 in server/src/index.ts, positioned after request logger and before protected routes mount. This ensures req.user data (populated by authMiddleware) is stored in AsyncLocalStorage for all subsequent requests, making it available to getUserId() and getUserEmail() in externalCallTracking.ts.
verification: Needs manual testing - verify that new AI/Apify calls show user emails in admin dashboard after server restart
files_changed:
- server/src/index.ts: Added createRequestContextMiddleware() to middleware chain
