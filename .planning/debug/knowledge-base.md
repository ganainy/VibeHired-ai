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
