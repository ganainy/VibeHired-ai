---
status: awaiting_human_verify
trigger: "today-applications-count-bug"
created: 2026-03-27T00:00:00.000Z
updated: 2026-03-27T00:00:02.000Z
---

## Current Focus
hypothesis: Root cause found and fix applied
test: Added job.status === 'Applied' condition to the filter
expecting: TODAY'S APPLICATIONS will only count jobs with status 'Applied'
next_action: Request user verification in their environment

## Symptoms
expected: TODAY'S APPLICATIONS should only count jobs with status 'Applied'
actual: Counts all jobs created today regardless of their status
errors: None reported
reproduction: User adds job using "Extract with AI" feature, the job gets created with status "Not Applied" but TODAY'S APPLICATIONS count still increases
started: Issue occurs when adding jobs through "Extract with AI" - jobs with "Not Applied" status are counted

## Eliminated

## Evidence
- timestamp: 2026-03-27T00:00:00.000Z
  checked: DashboardPage.tsx lines 1239-1245
  found: The filter only checks if job.createdAt is today's date, completely ignoring job.status
  implication: All jobs created today are counted regardless of their status (Applied, Not Applied, Interview, etc.)

## Resolution
root_cause: The todayCount filter in DashboardPage.tsx (lines 1239-1245) only checked if a job was created today, but did not filter by job status. This caused all jobs created today to be counted in TODAY'S APPLICATIONS regardless of whether they had status 'Applied', 'Not Applied', or any other status.
fix: Added job.status === 'Applied' condition to the filter so only jobs with status 'Applied' created today are counted.
verification: Awaiting user verification
files_changed: ["client/src/pages/DashboardPage.tsx"]
