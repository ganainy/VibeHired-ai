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
