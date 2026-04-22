---
phase: 02-unify-cv-editor
plan: 02
subsystem: server
subsystem: cv-pipeline
tags: [jsonresume, normalization, migration, cv-upload]
dependency_graph:
  requires: []
  provides: [02-03]
  affects: [cv-editor, cv-renderer, pdf-generator]
tech-stack:
  added:
    - jest
    - ts-jest
    - @types/jest
  patterns:
    - TDD with Jest for heuristic normalization logic
    - Batch migration script with dry-run support
key-files:
  created:
    - server/src/utils/cvNormalizer.test.ts
    - server/src/scripts/migrate-freeform-to-jsonresume.ts
    - server/jest.config.js
  modified:
    - server/src/utils/cvNormalizer.ts
    - server/src/utils/cvFormatDetector.ts
    - server/src/routes/cvs.ts
    - server/package.json
    - server/tsconfig.json
decisions:
  - "Idempotency check runs on RAW input before normalizeSectionNames/normalizeCvFieldNames to avoid breaking already-valid JsonResume (e.g., position → title alias would mutate valid work items)."
  - "Date parsing supports MM/YYYY, Month YYYY, YYYY, and German separators (bis, –, -) with ISO-like output (YYYY-MM)."
  - "Format detector strict mode requires basics + 2+ other valid sections to reduce false-positive json-resume classification."
  - "Migration script skips already-json-resume CVs and only updates when compaction produces different data or improves format classification."
metrics:
  duration: "~45 minutes"
  completed_date: "2026-04-22"
  tasks: 4
  files_changed: 8
---

# Phase 02 Plan 02: Robust JsonResume Normalization Pipeline Summary

**One-liner:** Added a comprehensive freeform-to-JsonResume compaction function with TDD-validated heuristics, integrated it into the upload pipeline, created a batch migration script for existing data, and hardened the format detector with structure validation and strict mode.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create comprehensive freeform-to-JsonResume compacting function | `501de89` | `server/src/utils/cvNormalizer.ts`, `server/src/utils/cvNormalizer.test.ts`, `server/jest.config.js`, `server/package.json`, `server/tsconfig.json` |
| 2 | Update upload pipeline to use compacted JsonResume | `c4520d7` | `server/src/routes/cvs.ts` |
| 3 | Create batch migration script for existing freeform CVs | `53e3cda` | `server/src/scripts/migrate-freeform-to-jsonresume.ts` |
| 4 | Improve cvFormatDetector heuristics | `679d613` | `server/src/utils/cvFormatDetector.ts`, `server/src/routes/cvs.ts` |

## What Was Built

### `compactFreeformToJsonResume` (cvNormalizer.ts)
A heuristic-driven function that converts AI-parsed freeform CV data into clean `JsonResumeSchema`:
- **Section name normalization** via existing `normalizeSectionNames` (German/English aliases)
- **Basics extraction** from `Header Info`, `KONTAKT`, etc. with profile detection (LinkedIn, GitHub, Xing)
- **Work/Education compaction** mapping `title`/`subtitle`/`dates`/`bullets` → `position`/`name`/`startDate`/`highlights`
- **Date parsing** supporting `MM/YYYY`, `Month YYYY`, `YYYY`, German `bis`, en-dash, em-dash, and `Present`
- **Skills normalization** handling flat string arrays, category objects, single strings, and keyed objects
- **Language parsing** from single strings like `"German (Native), English (Fluent)"`
- **Generic section mapping** for certificates, projects, awards, volunteer, interests, references, publications
- **Cleanup** removing empty values, `__vh_tags`, and `__*` meta keys
- **Idempotency** preserving already-valid JsonResume with minimal changes

### Tests (cvNormalizer.test.ts)
10 Jest tests covering German sections, freeform work/education mapping, Header Info extraction, flat skills, language string parsing, date formats, cleanup, and idempotency.

### Upload Pipeline Update (cvs.ts)
Both `POST /api/cvs/upload` and `POST /api/cvs/upload-branch` now:
1. Parse the raw CV via AI
2. Store the raw result as `originalCvJson`
3. Compact via `compactFreeformToJsonResume`
4. Detect format using **strict mode**

### Migration Script (migrate-freeform-to-jsonresume.ts)
Standalone Node.js/TypeScript script that:
- Connects to MongoDB using existing env config
- Finds CVs where `cvFormat === 'freeform'` or null/undefined
- Compacts each candidate and only updates when data changes or format improves
- Supports `--dry-run` for safe preview
- Processes in batches of 100
- Logs per-document progress and final summary
- Gracefully handles errors per document without stopping the batch

### Format Detector Improvements (cvFormatDetector.ts)
- **Empty handling:** Returns `'freeform'` for empty/null objects
- **Structure validation:** `basics` must be an object; array sections must be arrays
- **Ratio threshold:** Raised from 0.5 to 0.6
- **Strict mode:** Requires `basics` + 2+ other valid known sections
- Upload pipeline now uses `detectCvFormat(normalizedCvJson, true)`

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixed Issues (TDD iteration)

During TDD development of `compactFreeformToJsonResume`, several heuristic edge cases were discovered and fixed inline:

1. **Idempotency before normalization** — The initial plan suggested running `normalizeSectionNames` and `normalizeCvFieldNames` first, then checking idempotency. This broke valid JsonResume because `normalizeCvFieldNames` aliases `position` → `title` inside work items. Fixed by moving `isAlreadyJsonResume` to the **raw input** before any mutation.

2. **Date regex splitting on `/`** — The initial split regex included `/` which incorrectly split `MM/YYYY` date ranges into 4 parts. Removed `/` from separators.

3. **Language regex capturing commas** — The regex `/([^(]+)/` captured leading `, ` in multi-language strings. Fixed by stripping leading/trailing commas and spaces: `.replace(/^[\s,;]+|[\s,;]+$/g, '')`.

4. **Languages string check blocked by `continue`** — In `isAlreadyJsonResume`, the `typeof cvJson.languages === 'string'` check was placed after a `continue` for non-array entries, so it never executed. Moved the check before the `continue`.

5. **Null values in flat skill arrays** — `extractSkills` used `String(null)` → `"null"` in the mixed-array fallback. Fixed by filtering `d == null || typeof d === 'string'` and keeping only truthy trimmed strings.

## Known Stubs

No intentional stubs remain. All normalization heuristics are wired to real data extraction.

## Self-Check: PASSED

- [x] `compactFreeformToJsonResume` exists in `cvNormalizer.ts` and compiles
- [x] `cvNormalizer.test.ts` passes (10/10)
- [x] Both upload handlers call `compactFreeformToJsonResume` before storing
- [x] `originalCvJson` preserves raw parsed data
- [x] Migration script compiles and supports `--dry-run`
- [x] `detectCvFormat` supports strict mode and validates structure
- [x] Upload pipeline uses `detectCvFormat(..., true)`
- [x] All server-side TypeScript compiles without errors (via `npx tsc --noEmit`)
