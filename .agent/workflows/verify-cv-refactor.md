---
description: Verify the unified CV model refactoring across the application
---

# Unified CV Model Verification

This workflow guides you through verifying the recent refactoring of the CV system to use the Unified CV Model.

## 1. Verify Backend Compilation
Ensure the server code compiles without errors, confirming type safety for the new `CV` model usages.

```bash
cd server
npx tsc --noEmit
```

## 2. Verify Frontend Compilation
Ensure the client code uses the new `cvApi` functions correctly.

```bash
cd client
npx tsc --noEmit
```

## 3. Manual Verification Steps

Access the application in your browser (`http://localhost:5173`) and perform the following:

### QA 1: CV Management Page
1. Go to **CV Management**.
2. **Switch** between "Master CV" and different "Job CVs" in the sidebar.
3. **Verify** the editor loads the correct content for each.
4. **Edit** a Job CV and **Save**.
5. **Reload** the page and confirm changes persist.
6. **Delete** a Job CV and confirm it disappears.

### QA 2: Review & Finalize Page (Critical)
1. Go to **Jobs Board**.
2. Click **Review Application** for a job (or create a new one).
3. **Verify** the CV editor loads:
   - If a Job CV exists, it should load.
   - If not, it should default to Master CV content (or empty/legacy draft).
4. **Edit** the CV content in the "Edit CV" tab.
5. Click **Save Changes**.
   - *Backend Check:* This should now update the `CV` document (check MongoDB `cvs` collection if possible, or reload page).
6. **Generate PDFs**: Click "Render PDFs".
   - This triggers the backend PDF generator.
   - *Verification:* The backend should pick up your *latest edits* (which are now in the `CV` model) and generate the PDF.
   - Download the PDF and check if your edits are there.

### QA 4: Job CV Card (Jobs List)
1. Go to **Jobs Board**.
2. Click **Expand & Edit** on a job card.
3. **Edit** the CV content and **Save**.
4. **Reload** and expand again.
5. **Verify** the content is saved.

## TroubleShooting

- **PDFs are stale?** 
  - Ensure `generator.ts` was updated to read from `CV` model. (It was in this update).
- **Runtime Errors?**
  - Check console for missing `cvApi` exports or 404s on CV routes.

