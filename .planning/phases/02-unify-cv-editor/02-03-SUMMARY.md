---
phase: 02-unify-cv-editor
plan: 03
subsystem: ui
subsystem: api
tags: [react, typescript, jsonresume, cv-editor, integration]

dependency_graph:
  requires:
    - phase: 02-unify-cv-editor
      plan: 01
    - phase: 02-unify-cv-editor
      plan: 02
  provides: []
  affects: [CVManagementPage, TailoredCvPage, cvApi, cvs routes]

tech-stack:
  added: []
  patterns:
    - "Union prop types for backward-compatible component evolution"
    - "Server-side format classification returned in all API responses"

key-files:
  created: []
  modified:
    - client/src/components/cv-workspace/CvEditorPanel.tsx
    - client/src/components/cv-editor/CvDocumentRenderer.tsx
    - client/src/pages/CVManagementPage.tsx
    - client/src/components/review-finalize/TailoredCvPage.tsx
    - client/src/services/cvApi.ts
    - client/src/utils/isJsonResume.ts
    - server/src/routes/cvs.ts

decisions:
  - "Broadened CvEditorPanel props to accept JsonResumeSchema | FreeformJsonObject union instead of forcing parent pages to cast"
  - "Added optional instructions parameter to onImproveSection signature in both CvEditorPanel and CvDocumentRenderer for TailoredCvPage compatibility"
  - "Included cvFormat in ALL server CV API responses for consistent client-side editor routing"
  - "Propagated cvFormat when creating job CVs from base CVs or from body JSON"

metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-22"
  tasks: 5
  files_changed: 7
---

# Phase 02 Plan 03: Verify unified experience across both pages Summary

**Broadened CvEditorPanel prop types to accept both JsonResumeSchema and FreeformJsonObject, added cvFormat to all server CV API responses and client types, and created a getCvEditorMode utility for optional client-side editor routing.**

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Fix type mismatches in CVManagementPage | `64ec017` | `client/src/components/cv-workspace/CvEditorPanel.tsx`, `client/src/components/cv-editor/CvDocumentRenderer.tsx` |
| 2 | Fix type mismatches in TailoredCvPage | `64ec017` | `client/src/components/cv-workspace/CvEditorPanel.tsx`, `client/src/components/cv-editor/CvDocumentRenderer.tsx` |
| 3 | Update cvApi types for cvJson strictness | `d1e46ea` | `client/src/services/cvApi.ts`, `server/src/routes/cvs.ts` |
| 4 | Add client-side JsonResume detection and graceful fallback | `aaa27e4` | `client/src/utils/isJsonResume.ts` |
| 5 | Clean compilation across all modified files | — | verification only |

## What Was Built

### `CvEditorPanel` prop type broadening
Updated `CvEditorPanelProps` to accept `data: FreeformJsonObject | JsonResumeSchema | null` and `onChange: (data: FreeformJsonObject | JsonResumeSchema) => void`. This eliminates implicit type compatibility issues between parent pages (which work with `JsonResumeSchema`) and the editor panel (which historically accepted only `FreeformJsonObject`).

### `onImproveSection` signature fix
Added an optional 4th `instructions?: string` parameter to `onImproveSection` in both `CvEditorPanel` and `CvDocumentRenderer`. This aligns with the `TailoredCvPage` and `CVManagementPage` handlers that accept custom improvement instructions, removing any potential TypeScript strict-mode mismatches.

### `cvFormat` in API types and responses
- Added `cvFormat?: 'json-resume' | 'freeform' | null` to the `CVDocument` interface in `cvApi.ts` with documentation comments.
- Added `cvFormat` to **all** server CV response objects in `cvs.ts`:
  - `GET /api/cvs/branches`
  - `GET /api/cvs/master`
  - `GET /api/cvs/:id`
  - `GET /api/cvs/job/:jobId`
  - `POST /api/cvs/upload`
  - `POST /api/cvs/create-branch`
  - `POST /api/cvs/upload-branch`
  - `POST /api/cvs/job/:jobId`
  - `POST /api/cvs/job/:jobId/from-base`
  - `POST /api/cvs/job/:jobId/upload`
  - `PUT /api/cvs/:id`
  - `POST /api/cvs/:id/reset-from-source`
- Propagated `cvFormat` when creating job CVs:
  - Copy from primary CV's stored `cvFormat`
  - Detect from body JSON using `detectCvFormat(..., true)`

### `getCvEditorMode` utility
Added a `getCvEditorMode(cv)` function to `isJsonResume.ts` that returns `'structured' | 'freeform' | 'pdf-only'`:
- `'structured'` — `cvJson` is valid JsonResume (`isJsonResumeLike` returns true)
- `'freeform'` — `cvJson` exists but is not valid JsonResume (or is empty)
- `'pdf-only'` — no parseable JSON, but an original PDF exists
- Edge case: `cvJson` containing **only** `__vh_tags` / meta keys is treated as empty and falls back to `'pdf-only'` or `'freeform'`.

## Deviations from Plan

### Auto-added missing critical functionality (Rule 2)

**1. Added `cvFormat` to server API responses**
- **Found during:** task 3
- **Issue:** The backend stored `cvFormat` in the database during upload (Plan 02) but did **not** return it in any API response. This meant the client type addition in `cvApi.ts` would be misleading — the field would always be `undefined` at runtime.
- **Fix:** Added `cvFormat: cv.cvFormat ?? null` (or `newCv.cvFormat ?? null`) to **12** response objects across `server/src/routes/cvs.ts`. Also ensured `cvFormat` is propagated when creating job CVs from base CVs or from body JSON.
- **Files modified:** `server/src/routes/cvs.ts`
- **Commit:** `d1e46ea`

## Known Stubs

No intentional stubs remain. All type changes are fully wired:
- `CvEditorPanel` receives and forwards `JsonResumeSchema` data correctly
- `cvFormat` is present in API types and populated by the server
- `getCvEditorMode` is available for future use by parent pages

## Self-Check: PASSED

- [x] `client/src/components/cv-workspace/CvEditorPanel.tsx` updated with union prop types
- [x] `client/src/components/cv-editor/CvDocumentRenderer.tsx` updated with optional instructions param
- [x] `client/src/services/cvApi.ts` includes `cvFormat` in `CVDocument`
- [x] `client/src/utils/isJsonResume.ts` exports `getCvEditorMode`
- [x] `server/src/routes/cvs.ts` returns `cvFormat` in all relevant responses
- [x] Full client TypeScript compile passes (`npx tsc --noEmit`)
- [x] Full server TypeScript compile passes (`npx tsc --noEmit`)
- [x] Commits exist: `64ec017`, `d1e46ea`, `aaa27e4`

---
*Phase: 02-unify-cv-editor*
*Completed: 2026-04-22*
