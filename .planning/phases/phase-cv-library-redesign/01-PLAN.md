---
wave: 1
depends_on: []
files_modified:
  - client/src/pages/CVManagementPage.tsx
  - client/src/components/cv-management/Sidebar.tsx
  - client/src/components/jobs/JobCvCard.tsx
  - client/src/components/layout/Sidebar.tsx
  - client/src/components/layout/Header.tsx
autonomous: true
requirements_addressed: []
---

# Plan: CV Library UI/UX Redesign — Clarity & Education

## Objective
Redesign the "Manage Your CVs" page to clearly communicate its purpose (managing base/master resumes) and its relationship to job-tailored CVs. Remove confusion between base CVs and job-specific tailored CVs.

## Problem Statement
Users are confused because:
1. The page title "Manage Your CVs" implies ALL CVs, but only base CVs are shown
2. The subtitle mentions "tailor" but tailoring happens inside jobs, not here
3. No explanation of the relationship between base CVs and job-tailored CVs
4. Users don't know why they'd create multiple base CVs
5. The "branching" concept is technical jargon without clear purpose
6. Within jobs, it's unclear that the tailored CV is an independent copy

## must_haves
- Page title/subtitle clearly communicates "base resumes as starting points"
- Users understand the relationship: Base CV → AI Tailoring → Job-specific CV
- Each base CV card shows usage context (how many jobs use it)
- JobCvCard clearly shows the tailored CV is independent of the base CV
- Navigation labels are consistent ("CV Library" everywhere)

---

## Task 1: Rename & Reposition the Page

### <read_first>
- client/src/pages/CVManagementPage.tsx (page header section, lines 939-948)
- client/src/components/layout/Sidebar.tsx (nav items, line 168)
- client/src/components/layout/Header.tsx (nav items, line 172)
- client/src/components/onboarding/RouteOnboarding.tsx (route labels, lines 31-32)
</read_first>

### <action>
1. In `CVManagementPage.tsx` line 942, change the page title from "Manage Your CVs" to "CV Library"
2. In `CVManagementPage.tsx` line 945, change the subtitle from "Create, edit, and tailor your CVs for different job applications" to "Your base resumes — the starting point for tailored job applications"
3. In `client/src/components/layout/Sidebar.tsx` line 168, change the nav label from "Manage CV" to "CV Library"
4. In `client/src/components/layout/Header.tsx` line 172, change the nav label from "Manage CV" to "CV Library"
5. Keep the route path `/manage-cv` unchanged to avoid breaking bookmarks/links
</action>

### <acceptance_criteria>
- `CVManagementPage.tsx` contains `>CV Library<` (page h1 title)
- `CVManagementPage.tsx` contains "Your base resumes" (subtitle)
- `Sidebar.tsx` nav item contains "CV Library"
- `Header.tsx` nav item contains "CV Library"
- Route path `/manage-cv` is unchanged
</acceptance_criteria>

---

## Task 2: Add Educational Banner for First-Time Users

### <read_first>
- client/src/pages/CVManagementPage.tsx (zero-state hero section, lines 950-1021)
- client/src/components/onboarding/TourBanner.tsx (existing banner pattern)
</read_first>

### <action>
1. In the zero-CV hero section (line 950 area), add a brief explanatory section BELOW the "No CVs Yet" heading and BEFORE the upload form:

```
Add a concise 2-line explanation:
"Your base resume is the foundation. When you apply to jobs, we create AI-tailored copies — your original stays untouched."

Below this text, add a simple 3-step visual:
Step 1: "Upload Base CV" (icon: upload)
Step 2: "Apply to Jobs" (icon: briefcase)
Step 3: "Get Tailored CVs" (icon: sparkle/magic)
Connected by arrows or a horizontal flow.
```

2. Style it as an info callout box with:
   - Light blue/indigo background (`bg-indigo-50 dark:bg-indigo-900/20`)
   - Rounded corners, small padding
   - Text color matching existing muted text style
   - Keep it compact — no more than ~120px height total

3. This banner should ONLY appear when `allCvs.length === 0 && !showMockTour`
</action>

### <acceptance_criteria>
- Zero-state hero section contains the text "Your base resume is the foundation"
- Zero-state hero section shows a 3-step visual flow (Upload → Jobs → Tailored)
- Banner only appears when no CVs exist (not when CVs are loaded)
- Banner uses indigo/accent background color
- When CVs exist, the banner is not visible
</acceptance_criteria>

---

## Task 3: Improve Sidebar CV Cards with Context

### <read_first>
- client/src/components/cv-management/Sidebar.tsx (full file — CV card rendering)
- client/src/services/cvApi.ts (CVDocument type definition)
- server/src/models/CV.ts (CV schema — check what fields are available)
</read_first>

### <action>
1. In `Sidebar.tsx`, update each CV card in the list to show:
   - **Primary badge**: If `cv.isPrimary` or `cv.isMasterCv`, show a small "Primary" badge with star icon, styled with `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`
   - **Language badge**: Show the detected language ("EN" / "DE") as a small pill next to the CV name
   - **Usage count**: If available from the CV document, show "Used in N jobs" below the name. If the backend doesn't return this count, show it only for non-primary CVs with text "Ready for job applications"

2. Remove the "category" label from the card subtitle if it's redundant with the display name. Instead show the category only if it differs from the display name.

3. Add a tooltip on the "Create Branch" button that says: "Create a specialized version for a different career focus (e.g., one for frontend, one for DevOps)"

4. The branch creation flow in `CreateBranchModal.tsx` should include a helper text: "Branches are independent copies you can customize for different career paths. Each job application gets its own tailored copy."
</action>

### <acceptance_criteria>
- Primary/master CV shows a "Primary" badge with star icon
- Each CV card shows a language indicator (EN/DE)
- "Create Branch" button has a tooltip explaining the purpose
- CreateBranchModal contains helper text about what branches are for
- Cards are not significantly taller than before (keep compact)
</acceptance_criteria>

---

## Task 4: Add Contextual Guidance for Branch Creation

### <read_first>
- client/src/components/cv-management/CreateBranchModal.tsx (modal content)
</read_first>

### <action>
1. In `CreateBranchModal.tsx`, add an informational banner at the top of the modal (below the title, above the form):

```
"When to create a branch:
• Different career focus (e.g., Frontend vs DevOps)
• Different language versions of your CV
• Different experience levels to highlight"
```

2. Style it as a subtle info box: `bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400`

3. Update the modal title from whatever it currently is to "Create a Specialized Resume" (if it says something technical like "Create Branch")

4. Change the branch name input placeholder to something like "e.g., Frontend Developer, DevOps Engineer"
</action>

### <acceptance_criteria>
- CreateBranchModal contains the "When to create a branch" guidance
- Modal title uses user-friendly language (not "branch")
- Branch name input has an example placeholder
- Info box uses gray background, small text
</acceptance_criteria>

---

## Task 5: Clarify Job CV Relationship in JobCvCard

### <read_first>
- client/src/components/jobs/JobCvCard.tsx (full file — the expanded CV editor section)
- client/src/services/cvApi.ts (CVDocument type, createJobCvFromBase function)
</read_first>

### <action>
1. In `JobCvCard.tsx`, when a tailored CV exists (after fetching from `getJobCv`), add an info banner above the CV editor:

```
"This is a tailored copy — edits here don't affect your base resume."
```

Style: `bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300` with an info icon.

2. If the base CV that was used for tailoring can be identified (from `tailoringChanges` or CV metadata), add a link: "Based on: [Base CV Name]" that navigates to `/manage-cv?cv=[baseCvId]`

3. In the "Replace CV" panel, add a brief explanation when it opens:
```
"Replacing will create a fresh copy from the selected base resume. Your current tailored CV will be overwritten."
```

4. The replace button label should be "Replace with Base CV" instead of just "Replace CV" if it currently says that.
</action>

### <acceptance_criteria>
- JobCvCard shows "tailored copy" info banner when a job CV exists
- Info banner has blue background with info icon
- "Replace CV" panel shows a warning about overwriting
- Replace button text is clear about what it does
</acceptance_criteria>

---

## Task 6: Add CV Usage Section to CV Library Page

### <read_first>
- client/src/pages/CVManagementPage.tsx (main content area layout, lines 1047-1318)
- client/src/components/cv-management/Sidebar.tsx (sidebar card rendering)
- server/src/controllers/cvController.ts (check if usage count is already returned)
- server/src/models/CV.ts (CV schema)
</read_first>

### <action>
1. **Backend check first**: Read `server/src/controllers/cvController.ts` to check if `GET /api/cvs/branches` already returns a count of job CVs derived from each base CV. If not, add a `usedByJobCount` field to the branches response by counting CVs where `jobApplicationId` is set and the CV was created from this base CV.

2. **In the Sidebar.tsx**: On each base CV card, if `usedByJobCount > 0`, show a small text: "Used in {N} job applications" with a briefcase icon. If 0, show "Not used yet".

3. **In CVManagementPage.tsx** main editor area: Below the CV editor, add a collapsible "Used in Jobs" section that shows:
   - A list of job titles that use this base CV (if available from the API)
   - Each job title is a link that navigates to that job's detail page
   - If no jobs use it yet: "This resume hasn't been used for any applications yet."

4. Only show this section when `activeCv` is a base CV (not during upload/replace states).
</action>

### <acceptance_criteria>
- Sidebar CV cards show usage count ("Used in N job applications" or "Not used yet")
- Editor area has a "Used in Jobs" section when a base CV is selected
- Job titles in the usage section link to the job detail pages
- Section is hidden during upload/replace states
- If backend doesn't return usage data, the UI gracefully hides this section
</acceptance_criteria>

---

## Verification
- [ ] Page title is "CV Library" and subtitle explains base resumes
- [ ] Zero-state shows the educational flow (Upload → Jobs → Tailored)
- [ ] Sidebar cards show Primary badge, language, and usage context
- [ ] Branch creation modal has clear guidance
- [ ] JobCvCard shows the "tailored copy" info banner
- [ ] CV usage section shows which jobs use each base CV
- [ ] No broken links or missing imports
- [ ] Dark mode supported for all new elements
