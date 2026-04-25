---
phase: 3
plan: 03-01
status: complete
date: 2026-04-24
---

# Phase 03 Plan 01 Summary: User-Specific CV Migration Script

## Objective
Create a one-time script that converts all base CVs for a specific user (identified by email) from freeform format to JsonResume format.

## What Was Done

### Files Created
- `server/src/scripts/migrate-user-cv-to-jsonresume.ts` — New migration script

### Implementation Details

The script follows the same migration logic as the existing `migrate-freeform-to-jsonresume.ts` but targets a single user:

1. **CLI Interface**:
   - Required argument: user email address
   - Optional flag: `--dry-run` for preview mode
   - Usage validation with clear error messages

2. **Flow**:
   - Connect to MongoDB
   - Find user by email (case-insensitive)
   - Query base CVs: `{ userId, jobApplicationId: null, cvFormat: freeform|null|undefined }`
   - For each CV: detect format → compact if freeform → update if improved
   - Print detailed summary

3. **Error Handling**:
   - Missing/invalid email → usage message + exit code 1
   - User not found → clear error + exit code 1
   - No freeform CVs → informative message + exit code 0
   - Individual CV errors → log and continue

4. **Reuses Existing Utilities**:
   - `compactFreeformToJsonResume` from `cvNormalizer.ts`
   - `detectCvFormat` from `cvFormatDetector.ts`

## Verification

- [x] Script file created with correct shebang and imports
- [x] Email parsing works (required argument)
- [x] User lookup by email works
- [x] Base CV query filters correctly (jobApplicationId = null)
- [x] Freeform detection matches existing script logic
- [x] Compaction uses same `compactFreeformToJsonResume` function
- [x] Format detection uses same `detectCvFormat` function
- [x] --dry-run mode prevents writes
- [x] Summary output is clear and accurate
- [x] Error cases handled gracefully
- [x] No TypeScript compilation errors (project build succeeds)

## Usage

```bash
cd server
npx ts-node src/scripts/migrate-user-cv-to-jsonresume.ts user@example.com
npx ts-node src/scripts/migrate-user-cv-to-jsonresume.ts user@example.com --dry-run
```
