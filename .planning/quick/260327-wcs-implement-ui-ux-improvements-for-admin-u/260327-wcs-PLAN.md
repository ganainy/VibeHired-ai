---
phase: quick-admin-users-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/pages/AdminUsersPage.tsx
  - client/src/components/usage/UserUsageModal.tsx
autonomous: true

must_haves:
  truths:
    - "Search input debounces API calls by 300ms so rapid typing does not spam the server"
    - "User-visible error message appears when user fetch fails, not just a console log"
    - "Table shows inline loading indicator during pagination/search, not a full spinner replacement"
    - "Modal dismisses on Escape key and backdrop click"
    - "Modal has proper dialog ARIA attributes for screen readers"
    - "Interactive elements have descriptive aria-labels"
  artifacts:
    - path: "client/src/pages/AdminUsersPage.tsx"
      provides: "Debounced search, error state, inline loading, aria-labels"
      contains: "useRef\|useEffect.*debounce\|error\|aria-label"
    - path: "client/src/components/usage/UserUsageModal.tsx"
      provides: "Backdrop click dismiss, Escape key dismiss, ARIA dialog, inline error messages"
      contains: "aria-modal\|role.*dialog\|onKeyDown\|handleBackdrop"
  key_links:
    - from: "client/src/pages/AdminUsersPage.tsx"
      to: "debounce timer"
      via: "useRef + useEffect cleanup"
      pattern: "setTimeout.*searchTerm"
---

<objective>
Improve Admin Users page UX: debounce search, add proper error display, enhance loading states, and add modal dismissal + accessibility attributes.

Purpose: These improvements reduce unnecessary API calls, provide user-visible feedback on errors, and make the admin interface accessible and keyboard-friendly.
Output: Updated AdminUsersPage.tsx and UserUsageModal.tsx with all improvements applied.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@client/src/pages/AdminUsersPage.tsx
@client/src/components/usage/UserUsageModal.tsx
@client/src/components/common/TableOrCards.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add search debounce, error state, and inline loading to AdminUsersPage</name>
  <files>client/src/pages/AdminUsersPage.tsx</files>
  <action>
Modify AdminUsersPage.tsx with these changes (order matters -- read the file first):

**1. Add error state:**
- Add `const [error, setError] = useState<string | null>(null);` alongside existing state declarations.
- In `fetchUsers`, set `setError(null)` at the start of the try block. In the catch block, replace `console.error(...)` with `setError('Failed to load users. Please try again.')`.

**2. Debounce search with useRef + useEffect:**
- Add `const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);` after state declarations.
- Add `const [debouncedSearch, setDebouncedSearch] = useState('');` -- this is the value used for API calls.
- Add a new useEffect that watches `searchTerm` and sets a 300ms timeout to update `debouncedSearch`. Clean up the timeout on unmount or before setting a new one:
  ```
  useEffect(() => {
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm]);
  ```
- Change the existing page-reset useEffect (line 31-33) to depend on `debouncedSearch` instead of `searchTerm`.
- Change the data-fetching useEffect (line 35-37) to call `fetchUsers(page, debouncedSearch)` instead of `fetchUsers(page, searchTerm)`.
- The `onUpdate` callback passed to UserUsageModal should also use `debouncedSearch`: `() => fetchUsers(page, debouncedSearch)`.

**3. Inline loading (do NOT replace entire table with spinner during subsequent loads):**
- Add a `const [isInitialLoad, setIsInitialLoad] = useState(true);` state.
- In `fetchUsers`, set `setIsInitialLoad(false)` inside the finally block (only the first time). The existing `isLoading` state remains for the inline indicator.
- Replace the current `{isLoading ? <Spinner wrapper> : <TableOrCards>}` block (lines 66-188) with:
  - If `isInitialLoad && isLoading`: show the full spinner wrapper (current behavior, lines 67-69).
  - Else: always show TableOrCards, but when `isLoading` is true, render a semi-transparent overlay on top with a small centered spinner, or simply add a subtle "Loading..." text row below the table. Simplest approach: just show TableOrCards and add `opacity-50 pointer-events-none` to its wrapper when `isLoading` is true. This preserves scroll position and context.

**4. Error banner:**
- Between the search header and the table section, add an error banner that renders when `error` is not null:
  ```
  {error && (
    <div className="rounded-xl px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 flex items-center justify-between">
      <span>{error}</span>
      <button onClick={() => { setError(null); fetchUsers(page, debouncedSearch); }} className="ml-3 text-xs font-bold underline hover:no-underline">Retry</button>
    </div>
  )}
  ```

**5. Aria-labels on interactive elements:**
- Search input (line 52): add `aria-label="Search users by email or username"`.
- Pagination Previous button (line 198): add `aria-label="Previous page"`.
- Pagination Next button (line 206): add `aria-label="Next page"`.
- Manage buttons (lines 143, 178): add `aria-label={"Manage user " + u.username}` (table) and `aria-label={"Manage user " + u.username}` (card).
  </action>
  <verify>
    cd "E:/VS-projects/job-app-assistant" && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -30
  </verify>
  <done>
    - Typing in search input debounces API calls by 300ms
    - Failed API calls display a visible error banner with retry button
    - Subsequent page/search changes show inline loading (opacity overlay) instead of replacing entire table
    - All interactive elements have descriptive aria-labels
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Add modal dismissal (Escape + backdrop click) and ARIA dialog attributes</name>
  <files>client/src/components/usage/UserUsageModal.tsx</files>
  <action>
Modify UserUsageModal.tsx with these changes (read the file first):

**1. Add Escape key handler:**
- Add a `useEffect` that listens for `keydown` on `document` and calls `onClose` when the key is `Escape`. Clean up the listener on unmount:
  ```
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  ```

**2. Add backdrop click handler:**
- On the outermost backdrop div (line 123, the one with `className="fixed inset-0 z-[110]..."`) add `onClick={onClose}`.
- On the inner modal content div (line 124, the one with `className="rounded-2xl shadow-2xl..."`) add `onClick={(e) => e.stopPropagation()}` to prevent backdrop dismiss when clicking inside the modal.

**3. Add ARIA dialog attributes:**
- On the inner modal content div (line 124), add: `role="dialog"`, `aria-modal="true"`, `aria-label={data ? "Manage user " + data.username : "User details"}`.
- If there is a heading inside (the h2 at line 138), also add `aria-labelledby` pointing to it by giving the h2 an `id` attribute. Simplest: give the h2 an id like `id="modal-title"` and add `aria-labelledby="modal-title"` to the dialog div.

**4. Replace alert() calls with inline error state:**
- Add `const [actionError, setActionError] = useState<string | null>(null);` state.
- In each handler that currently calls `alert(...)` (handleGrantCredits line 42, handleRoleChange line 54, handlePlanChange line 65, handleCancelSubscription line 79, handleToggleBlock line 96):
  - Replace `alert('Failed to ...')` with `setActionError('Failed to ...')`.
  - Add `setActionError(null)` at the start of each handler (before the try block) so previous errors clear on new attempts.
- Add an inline error banner inside the modal, just below the header section (after the close button row, before the block/unblock bar). It should look like:
  ```
  {actionError && (
    <div className="px-6 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20" style={{ borderBottom: '1px solid var(--border)' }}>
      {actionError}
      <button onClick={() => setActionError(null)} className="ml-2 underline hover:no-underline">Dismiss</button>
    </div>
  )}
  ```

**5. Aria-labels on modal buttons:**
- Close button (line 151): add `aria-label="Close modal"`.
- Block/Unblock button (line 170): add `aria-label={data.isBlocked ? "Unblock user" : "Block user"}`.
- Cancel Subscription button (line 251): add `aria-label="Cancel subscription"`.
- Grant Credits button (line 289): add `aria-label="Grant credits"`.
- Plan select (line 189): add `aria-label="Change user plan"`.
- Role select (line 204): add `aria-label="Change user role"`.
  </action>
  <verify>
    cd "E:/VS-projects/job-app-assistant" && npx tsc --noEmit --project client/tsconfig.json 2>&1 | head -30
  </verify>
  <done>
    - Pressing Escape closes the modal
    - Clicking the dark backdrop closes the modal
    - Clicking inside the modal content does NOT close it
    - Modal has role="dialog", aria-modal="true", and aria-labelledby
    - Error feedback uses inline banner instead of alert()
    - All modal buttons have descriptive aria-labels
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit --project client/tsconfig.json`
2. Grep confirms debounce pattern: `grep -n "setTimeout.*debounce\|searchTimeoutRef" client/src/pages/AdminUsersPage.tsx`
3. Grep confirms ARIA attributes: `grep -n "aria-label\|aria-modal\|role.*dialog" client/src/components/usage/UserUsageModal.tsx`
4. Grep confirms error state: `grep -n "actionError\|setError" client/src/components/usage/UserUsageModal.tsx`
</verification>

<success_criteria>
- Search input debounces API calls by 300ms (no API call per keystroke)
- Failed user fetches show a visible error banner with retry
- Subsequent loading preserves table content with opacity overlay
- Modal dismisses via Escape key and backdrop click
- Modal has proper ARIA dialog attributes
- All alert() calls replaced with inline error messages
- All interactive elements have aria-labels
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/260327-wcs-implement-ui-ux-improvements-for-admin-u/260327-wcs-SUMMARY.md`
</output>
