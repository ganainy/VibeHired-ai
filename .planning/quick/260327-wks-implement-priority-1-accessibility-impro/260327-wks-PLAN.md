# Quick Task 260327-wks: Priority 1 Accessibility Improvements for Job Dashboard

**Status:** Ready for execution
**Target:** `client/src/pages/DashboardPage.tsx` (2031 lines)
**Date:** 2026-03-27

---

## Overview

Implement 7 Priority 1 (CRITICAL) accessibility improvements for the Job Dashboard page to ensure WCAG 2.1 Level AA compliance and better usability for keyboard/screen reader users.

---

## Plan

### Task 1: Fix Touch Target Sizes and Add ARIA Labels

**Files:** `client/src/pages/DashboardPage.tsx`

**Action:**
1. **Fix touch target sizes** - Find all `w-8 h-8` button classes (32px) and add `min-h-[44px]` to meet WCAG 44×44px minimum:
   - Line 932: Notes icon in table actions
   - Line 939: URL link buttons in table actions
   - Line 951: Favorite button in table actions
   - Line 954: Follow-up button in table actions
   - Line 957: Delete button in table actions
   - Line 1032: Notes icon in card actions
   - Line 1039: URL link buttons in card actions
   - Line 1045: Favorite button in card actions
   - Line 1048: Follow-up button in card actions
   - Line 1051: Delete button in card actions
   - Line 1134: Mobile collapse button (already w-8 h-8, add min-h)
   - Line 1184: CV file remove button
   - Line 1617: Demo tour favorite button
   - Line 1620: Demo tour delete button

2. **Add aria-labels to interactive elements:**
   - Line 1421: Search input - add `aria-label="Search jobs by title, company, or contact name"`
   - Line 1426: Search input placeholder is descriptive - OK
   - Line 1440: Status filter select - add `aria-label="Filter by status"`
   - Line 1456: Job type filter select - add `aria-label="Filter by job type"`
   - Line 1477: Favorites toggle button - add `aria-label="Toggle favorites filter"` and `aria-pressed={filterFavorite}`
   - Line 1496: Has Notes toggle button - add `aria-label="Toggle notes filter"` and `aria-pressed={filterHasNotes}`
   - Line 1511: Needs Follow-up button - add `aria-label="Toggle follow-up filter"` and `aria-pressed={showOnlyDueFollowUps}`
   - Line 1690: Modal close button - has `aria-label="Close"` - OK
   - Lines 951, 1045: Favorite button - add `aria-label={job.isFavorite ? "Remove from favorites" : "Add to favorites"}`
   - Lines 954, 1048: Follow-up button - add `aria-label="Open follow-up email actions"`
   - Lines 957, 1051: Delete button - has `title="Delete"` - add `aria-label="Delete job application"`

**Verify:**
- All action buttons have `min-h-[44px]` class added
- All interactive elements have descriptive `aria-label` attributes
- Toggle buttons have `aria-pressed` attributes

**Done:** Touch targets meet 44×44px minimum and all interactive elements are accessible to screen readers.

---

### Task 2: Add Skip Link, Focus Management, and ARIA Regions

**Files:** `client/src/pages/DashboardPage.tsx`

**Action:**
1. **Add skip link** (after line 1087, after main container opening):
   ```tsx
   {/* Skip link for keyboard users */}
   <a
     href="#main-content"
     className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-zinc-900 focus:text-white focus:rounded-lg"
   >
     Skip to main content
   </a>
   ```

2. **Add id to main content** (line 1091, update existing div):
   ```tsx
   <div id="main-content" className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
   ```

3. **Fix Status dropdown keyboard navigation** (update StatusDropdown component, lines 669-715):
   - Add `onKeyDown` handler to trap focus within dropdown when open
   - Add `aria-expanded={isOpen}` to trigger button
   - Add `aria-haspopup="listbox"` to trigger button
   - Add `role="listbox"` to dropdown container
   - Add `role="option"` to each status option
   - Ensure Escape key closes dropdown and returns focus to trigger
   - Ensure Enter/Space selects option and closes dropdown

4. **Add focus trap to modal** (lines 1683-1974):
   - Create a `useFocusTrap` hook or add useEffect to manage focus
   - On modal open: focus first focusable element (jobTitle input)
   - Trap focus within modal while open (Tab/Shift+Tab cycles inside)
   - On modal close: return focus to trigger button (Add Job button)
   - Add `role="dialog"` to modal container
   - Add `aria-modal="true"` to modal container
   - Add `aria-labelledby` pointing to modal title

5. **Add aria-live region for toast** (lines 2009-2015):
   - Wrap Toast component in an aria-live region:
   ```tsx
   <div role="status" aria-live="polite" aria-atomic="true">
     {toast && (
       <Toast
         message={toast.message}
         type={toast.type}
         onClose={() => setToast(null)}
       />
     )}
   </div>
   ```

6. **Add aria-label to main table** (update TableOrCards usage, line 1635):
   - Add `aria-label="Job applications table"` to TableOrCards component

**Verify:**
- Skip link appears when pressing Tab after page load
- Main content has id="main-content"
- Status dropdown has proper ARIA attributes and keyboard nav
- Modal traps focus and returns it on close
- Toast announcements are read by screen readers
- Table has descriptive aria-label

**Done:** Keyboard navigation works properly, screen reader users get appropriate announcements.

---

## Summary

This plan addresses 7 Priority 1 accessibility issues:

1. ✅ Touch target sizes (44×44px minimum)
2. ✅ ARIA labels on all interactive elements
3. ✅ Skip link for keyboard users
4. ✅ Status dropdown keyboard navigation
5. ✅ Modal focus trap
6. ✅ ARIA live region for toast notifications
7. ✅ Table aria-label

All changes are contained within `client/src/pages/DashboardPage.tsx` (2031 lines).
