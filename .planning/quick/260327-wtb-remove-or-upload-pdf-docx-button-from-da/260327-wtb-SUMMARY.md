# Quick Task 260327-wtb: Summary

**Task:** Remove 'Or upload PDF / DOCX' button from dashboard
**Date:** 2026-03-27
**Status:** ✅ Completed

---

## Overview

Removed the "Or upload PDF / DOCX" button from the CV selection section of the job add form on the dashboard page. This simplifies the UI and reduces redundancy.

---

## Changes Made

**File:** `client/src/pages/DashboardPage.tsx`

**Removed:**
- Lines 1354-1367: The "Or upload PDF / DOCX" button and its conditional rendering wrapper
- The button allowed users to click and trigger a hidden file input
- Users can still use CVs by selecting from the dropdown, or the feature can be re-added if needed

**Reason:** Simplify the dashboard UI by removing redundant upload option.

---

## Testing

- [x] Dashboard loads without errors
- [x] CV dropdown still works
- [x] No broken references to removed code

---

## Files Modified

- `client/src/pages/DashboardPage.tsx` (-15 lines)
