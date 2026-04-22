# Project Roadmap

## Phase 01: Interview Buddy Speed Optimization
- Status: Complete

## Phase 02: Unify CV Editor
- Status: In Planning
- **Goal:** Unify the /manage-cv and tailored CV page using JsonResume because the current freeform editor is brittle and gives weird results with odd CVs it's not prepared for.
- **Requirements:** [CV-EDIT-01, CV-EDIT-02, CV-EDIT-03]
- **Plans:** 2/3 plans executed

### Context
The current CV editing experience uses a freeform renderer (`FreeformCvRenderer` + `InPlaceCvEditor`) that depends on AI-generated `__vh_tags` to know how to display and edit CV content. When users upload CVs with unusual structures, missing tags, or non-standard sections, the renderer produces broken layouts and confusing editing experiences. A structured `CvDocumentRenderer` already exists that edits proper `JsonResumeSchema` data, but `CvEditorPanel` (used by both pages) does not use it.

### Plans
- [x] 02-01-PLAN.md — Refactor CvEditorPanel with JsonResume-first rendering
- [x] 02-02-PLAN.md — Robust JsonResume normalization pipeline
- [ ] 02-03-PLAN.md — Verify unified experience across both pages
