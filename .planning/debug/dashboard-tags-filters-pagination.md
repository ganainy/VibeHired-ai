---
status: awaiting_human_verify
trigger: "dashboard-tags-filters-pagination"
created: 2026-04-23T00:00:00Z
updated: 2026-04-23T00:00:00Z
---

## Current Focus

hypothesis: When `groupByTag` is true, `displayedJobs` still returns the paginated `jobs` state (10 items), not `allJobs`. The grouped view is computed from only 10 items and pagination controls are hidden, so users cannot access jobs on other pages.
test: Read DashboardPage.tsx `displayedJobs` and `groupedJobs` logic; verify `groupByTag` gated behavior.
expecting: `displayedJobs` useMemo always returns `jobs` regardless of `groupByTag`, and the grouped view hides pagination controls.
next_action: Update `displayedJobs` to return `allJobs` when `groupByTag` is true.

## Symptoms

expected: Tags and quick filters should reflect all data across all pages (the entire dataset)
actual: Tags and quick filters are limited to only what's visible on the currently selected/viewed page
errors: No error messages reported
reproduction: Issue is always visible upon loading the dashboard. Navigate to any page and the tags/filters only show content from that page.
timeline: Issue appeared immediately after the pagination feature was implemented on the dashboard

## Eliminated

## Evidence

- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx
  found: Server-side pagination fetch uses limit:10 and stores only current page in `jobs` state
  implication: All tag/filter computations derived from `jobs` are paginated
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 432-463
  found: `tagCounts`, `availableTags`, `hasUntaggedJobs` all iterate over `jobs`
  implication: Tag filters only show tags present on current page
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 596-604
  found: `favoriteCount`, `notesCount`, `needsFollowUpJobIds` all filter over `jobs`
  implication: Quick filter counts only reflect current page
- timestamp: 2026-04-23T00:00:00Z
  checked: server/src/routes/jobApplications.ts lines 101-151
  found: Server handler always applies pagination (defaults page=1, limit=10)
  implication: No way for client to request all matching jobs for aggregate computation
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx (previous fix)
  found: `allJobs` state added, `fetchAllJobsForFilters` useEffect fetches with `limit: 'all'`, tag/filter counts updated to use `allJobs`
  implication: Previous fix looked correct but user reports it's still broken
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/services/jobApi.ts lines 33-235
  found: `jobsInFlightRequest` is a single global promise (not keyed by params). `getJobs` returns it for ANY in-flight request regardless of params.
  implication: On mount, paginated fetch fires first and sets `jobsInFlightRequest`. The `all` fetch immediately after returns the SAME promise, so `allJobs` gets paginated data (10 jobs).
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 665-795
  found: `fetchJobs` effect runs before `fetchAllJobsForFilters` effect (declaration order). `fetchAllJobsForFilters` has no dependency on `currentPage`, so navigating pages never refetches `allJobs`.
  implication: If `allJobs` is poisoned with paginated data on initial load, it stays wrong forever (until filters change).
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 799-804
  found: `displayedJobs` useMemo always returns `jobs` (paginated, 10 items). Comment says "show all jobs" but code doesn't.
  implication: When `groupByTag` is true, grouping operates on only the current page of jobs.
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 2154-2173
  found: When `groupByTag` is true, grouped view renders but pagination controls are completely hidden.
  implication: Users cannot navigate to other pages when grouping is enabled, making remaining jobs inaccessible.
- timestamp: 2026-04-23T00:00:00Z
  checked: client/src/pages/DashboardPage.tsx lines 806-857
  found: `groupedJobs` is computed from `displayedJobs`, which is paginated.
  implication: Groups only contain jobs from the current page, not all matching jobs.

## Resolution

root_cause: 
  - Previous issue: The `getJobs` function in `jobApi.ts` used a single global `jobsInFlightRequest` promise for request deduplication. Because this variable was shared across ALL parameter combinations, the `limit: 'all'` fetch returned the SAME in-flight promise as the paginated fetch. This caused `allJobs` to receive paginated data (only 10 jobs).
  - NEW issue: Even after fixing the deduplication bug, the `displayedJobs` useMemo in `DashboardPage.tsx` always returns the paginated `jobs` state, regardless of whether `groupByTag` is enabled. When `groupByTag` is true, `groupedJobs` is computed from `displayedJobs` (only 10 items from the current page), and pagination controls are hidden. This means users see an incomplete grouped view with no way to access jobs on other pages.

fix: 
  1. Previous fix (already applied): 
     - Server: Added support for `limit=all` query parameter in `getJobsHandler`.
     - Client API: Updated `GetJobsParams` to accept `limit: 'all'` and updated cache key builder accordingly.
     - Dashboard: Added `allJobs` state and `fetchAllJobsForFilters` useEffect to fetch unpaginated data for tag/filter counts.
     - **CRITICAL FIX**: In `client/src/services/jobApi.ts`, replaced the single global `jobsInFlightRequest` with a `Map<string, Promise<JobsResponse>>` keyed by `paramsKey`.
  2. NEW fix:
     - In `client/src/pages/DashboardPage.tsx`, updated the `displayedJobs` useMemo to return `allJobs` (unpaginated) when `groupByTag` is true, instead of always returning `jobs` (paginated). This ensures the grouped view includes all matching jobs across all pages.

verification: 
  - Client TypeScript compilation passes (`npx tsc --noEmit` in client/).
  - Server TypeScript compilation passes (`npx tsc --noEmit` in server/).
  - The `displayedJobs` useMemo now returns `allJobs` when `groupByTag` is true, ensuring grouped views include all matching jobs.

files_changed:
  - client/src/pages/DashboardPage.tsx
