---
wave: 1
depends_on: []
files_modified:
  - server/src/scripts/migrate-user-cv-to-jsonresume.ts
autonomous: true
requirements_addressed: []
---

# Plan: User-Specific CV Migration Script

## Objective
Create a one-time script that converts all base CVs for a specific user (identified by email) from freeform format to JsonResume format.

## Problem Statement
The existing `migrate-freeform-to-jsonresume.ts` script migrates ALL freeform CVs across all users. Sometimes an admin needs to target a specific user's CVs for migration — either for testing, debugging, or selective cleanup.

## must_haves
- Script accepts user email as CLI argument
- Only converts base CVs (jobApplicationId = null)
- Uses same compaction logic as existing migration (compactFreeformToJsonResume)
- Supports --dry-run flag
- Reports clear summary of actions taken

---

## Task 1: Create User-Specific Migration Script

### <read_first>
- server/src/scripts/migrate-freeform-to-jsonresume.ts (existing migration logic)
- server/src/models/CV.ts (CV model schema)
- server/src/models/User.ts (User model for email lookup)
- server/src/utils/cvNormalizer.ts (compactFreeformToJsonResume function)
- server/src/utils/cvFormatDetector.ts (detectCvFormat function)
</read_first>

### <action>
1. Create `server/src/scripts/migrate-user-cv-to-jsonresume.ts` with the following structure:

```typescript
#!/usr/bin/env ts-node
/**
 * User-specific CV migration: converts freeform base CVs to JsonResume for a single user.
 *
 * Usage:
 *   cd server
 *   npx ts-node src/scripts/migrate-user-cv-to-jsonresume.ts user@example.com
 *   npx ts-node src/scripts/migrate-user-cv-to-jsonresume.ts user@example.com --dry-run
 */
```

2. Parse CLI arguments:
   - First non-flag argument = user email (required)
   - `--dry-run` flag for preview mode

3. Flow:
   a. Connect to MongoDB
   b. Find user by email (from User model)
   c. If user not found, exit with error
   d. Query base CVs for that user: `{ userId, jobApplicationId: null }`
   e. Filter to freeform candidates: `cvFormat: 'freeform' | null | undefined`
   f. For each candidate:
      - Skip if already json-resume
      - Run `compactFreeformToJsonResume`
      - Run `detectCvFormat` on result
      - Update if improved
   g. Print summary

4. Error handling:
   - User not found → clear error message
   - No base CVs found → informative message
   - No freeform CVs to migrate → informative message
   - Individual CV errors → log and continue

### <acceptance_criteria>
- Script file exists at `server/src/scripts/migrate-user-cv-to-jsonresume.ts`
- Running without email argument prints usage and exits with code 1
- Running with non-existent email prints "User not found" and exits with code 1
- Running with valid email migrates freeform base CVs to JsonResume
- `--dry-run` mode reports what would change without modifying data
- Summary shows: candidates found, migrated, unchanged, skipped, errors
- Only base CVs (jobApplicationId = null) are processed
- Script exits with code 0 on success, 1 on errors
</action>

---

## Verification
- [ ] Script file created with correct shebang and imports
- [ ] Email parsing works (required argument)
- [ ] User lookup by email works
- [ ] Base CV query filters correctly (jobApplicationId = null)
- [ ] Freeform detection matches existing script logic
- [ ] Compaction uses same `compactFreeformToJsonResume` function
- [ ] Format detection uses same `detectCvFormat` function
- [ ] --dry-run mode prevents writes
- [ ] Summary output is clear and accurate
- [ ] Error cases handled gracefully
- [ ] No TypeScript compilation errors
