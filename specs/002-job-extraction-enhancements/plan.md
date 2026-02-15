# Plan: Job Extraction Enhancements & CV Branch Integration

**Feature ID**: `002-job-extraction-enhancements`  
**Created**: 2026-02-15  
**Status**: Planning Complete

## Overview

This feature enhances the job extraction workflow to:
1. Add CV branch selection **before** AI extraction starts
2. Add job link and status fields to the extraction form
3. Add job type field (full-time, part-time, etc.) with AI extraction
4. Filter CV dropdown in generation to show only branches (exclude job-specific CVs)

## Requirements Summary

### 1. Pre-Extraction Form Enhancement
- Show CV branch dropdown **before** AI extraction
- Add job link (URL) input field
- Add status dropdown (default: "Not Applied")
- Add job type dropdown (AI will also try to detect it)

### 2. Job Type Field
- New field: `jobType` with predefined values:
  - Full-time
  - Part-time
  - Working Student
  - Internship
  - Contract
  - Freelance
- AI should extract and suggest job type during extraction
- User can override AI suggestion

### 3. CV Branch Filtering in Generation
- When generating tailored CV/cover letter, show only CV branches
- Exclude job-specific CVs from the dropdown
- Job-specific CVs should only appear in their specific job page

---

## Technical Implementation Plan

### Phase 1: Backend - Data Model & AI Extraction Updates

#### Task 1.1: Add jobType to JobApplication Model
**File**: `server/src/models/JobApplication.ts`

Add new field:
```typescript
jobType: {
  type: String,
  enum: ['full-time', 'part-time', 'working-student', 'internship', 'contract', 'freelance', null],
  default: null
}
```

#### Task 1.2: Update ExtractedJobData Interface
**File**: `server/src/utils/aiExtractor.ts`

Add `jobType` to the extraction interface:
```typescript
export interface ExtractedJobData {
    // ... existing fields
    jobType?: 'full-time' | 'part-time' | 'working-student' | 'internship' | 'contract' | 'freelance' | null;
}
```

#### Task 1.3: Update AI Extraction Prompts
**File**: `server/src/utils/aiExtractor.ts`

Update both `extractFieldsWithGemini` and `extractJobDataFromText` prompts to:
- Extract employment type/job type from the posting
- Map common terms to our enum values (e.g., "Vollzeit" → "full-time", "Werkstudent" → "working-student")

#### Task 1.4: Update parseExtractionResponse
**File**: `server/src/utils/aiExtractor.ts`

Add validation for jobType field in the response parser.

---

### Phase 2: Backend - API Endpoint Updates

#### Task 2.1: Update createJobFromTextBodySchema
**File**: `server/src/validations/jobApplicationSchemas.ts`

Add optional fields:
```typescript
baseCvId: z.string().optional().nullable(),
jobUrl: z.string().url().optional().nullable(),
status: z.enum([...]).optional(),
jobType: z.enum(['full-time', 'part-time', ...]).optional().nullable()
```

#### Task 2.2: Update createJobFromTextHandler
**File**: `server/src/routes/jobApplications.ts`

Modify the handler to:
- Accept additional fields from request body
- Pass `baseCvId`, `jobUrl`, `status`, `jobType` to the new job document
- Use provided values or AI-extracted values for jobType

#### Task 2.3: Update extractFromTextHandler
**File**: `server/src/routes/jobApplications.ts`

Ensure the PATCH endpoint also handles jobType extraction.

---

### Phase 3: Frontend - Pre-Extraction Form

#### Task 3.1: Update DashboardPage State
**File**: `client/src/pages/DashboardPage.tsx`

Add new state variables:
```typescript
const [selectedCvBranchId, setSelectedCvBranchId] = useState<string | null>(null);
const [preExtractionJobUrl, setPreExtractionJobUrl] = useState<string>('');
const [preExtractionStatus, setPreExtractionStatus] = useState<string>('Not Applied');
const [preExtractionJobType, setPreExtractionJobType] = useState<string | null>(null);
```

#### Task 3.2: Create Pre-Extraction Form UI
**File**: `client/src/pages/DashboardPage.tsx`

Add before the textarea:
- CV Branch dropdown (populated from `cvs` state, filtered to show only branches)
- Job URL input field
- Status dropdown
- Job Type dropdown (optional, AI will also detect)

#### Task 3.3: Update createJobFromTextApi
**File**: `client/src/services/jobApi.ts`

Update function signature:
```typescript
export const createJobFromTextApi = async (
  text: string, 
  options?: {
    baseCvId?: string | null;
    jobUrl?: string;
    status?: string;
    jobType?: string | null;
  }
): Promise<JobApplication>
```

#### Task 3.4: Update handleCreateFromTextSubmit
**File**: `client/src/pages/DashboardPage.tsx`

Pass the pre-extraction form values to the API call.

---

### Phase 4: Frontend - CV Branch Filtering in Generation

#### Task 4.1: Add API Endpoint for Branch-Only CVs
**File**: `server/src/routes/cvs.ts`

Create new endpoint or modify existing to return only CV branches:
```typescript
GET /api/cvs/branches-only
```
Returns only CVs where `isMasterCv === false` AND `isPrimary === false` (pure branches).

**Alternative**: Filter on frontend using existing data.

#### Task 4.2: Update CV Selection in ReviewFinalizePage
**File**: `client/src/pages/ReviewFinalizePage.tsx`

Filter the CV dropdown in the generation modal:
- Filter out job-specific CVs (CVs that have `jobApplication` field set)
- Show only primary CV and branch CVs

#### Task 4.3: Update availableCvs Logic
**File**: `client/src/pages/ReviewFinalizePage.tsx`

Modify the `availableCvs` derivation to exclude job-specific CVs:
```typescript
const availableCvs = useMemo(() => {
  return allCvs.filter(cv => !cv.jobApplication); // Only branches and primary
}, [allCvs]);
```

---

### Phase 5: Type Updates & Validation

#### Task 5.1: Update Frontend Types
**File**: `client/src/services/jobApi.ts`

Add `jobType` to `JobApplication` interface:
```typescript
jobType?: 'full-time' | 'part-time' | 'working-student' | 'internship' | 'contract' | 'freelance' | null;
```

#### Task 5.2: Update CVDocument Type
**File**: `client/src/services/cvApi.ts`

Ensure `CVDocument` interface includes `isPrimary` and `isMasterCv` for filtering.

---

## File Changes Summary

### Backend Files
| File | Changes |
|------|---------|
| `server/src/models/JobApplication.ts` | Add `jobType` field |
| `server/src/utils/aiExtractor.ts` | Add jobType extraction |
| `server/src/validations/jobApplicationSchemas.ts` | Add validation schemas |
| `server/src/routes/jobApplications.ts` | Update handlers |

### Frontend Files
| File | Changes |
|------|---------|
| `client/src/pages/DashboardPage.tsx` | Add pre-extraction form |
| `client/src/pages/ReviewFinalizePage.tsx` | Filter CV dropdown |
| `client/src/services/jobApi.ts` | Update API functions and types |
| `client/src/services/cvApi.ts` | Ensure proper types |

---

## UI/UX Flow

### Updated Extraction Flow
```
1. User pastes job description text
2. User selects:
   - CV Branch (dropdown, required)
   - Job URL (optional)
   - Status (dropdown, default: "Not Applied")
   - Job Type (dropdown, optional - AI will also detect)
3. User clicks "Extract with AI"
4. AI extracts job details including job type
5. Job is created with all provided + extracted values
6. baseCvId is set from selected CV branch
```

### CV Selection in Generation
```
1. User navigates to job's Review & Finalize page
2. User clicks "Generate Tailored CV" or "Generate Cover Letter"
3. CV dropdown shows:
   - Primary CV (if exists)
   - All CV branches
   - NO job-specific CVs
4. User selects base CV for generation
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| AI fails to extract job type | Low | Field is optional, user can select manually |
| Breaking existing API contracts | Medium | Keep all new fields optional |
| CV filtering logic incorrect | Low | Clear filtering criteria (exclude jobApplication field) |

---

## Success Criteria

- [ ] Pre-extraction form shows CV branch, job URL, status, and job type fields
- [ ] Job type is extracted by AI and stored correctly
- [ ] baseCvId is set from selected CV branch during extraction
- [ ] CV dropdown in generation shows only branches (no job-specific CVs)
- [ ] All existing functionality continues to work
