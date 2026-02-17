# Feature Specification: Unified CV Edit-Review Workspace

**Feature Branch**: `002-unified-cv-editor`  
**Created**: 2026-02-16  
**Status**: Draft  
**Input**: User description: "Fix inconsistency between /review job-specific CV editing and /manage CV editing by unifying into one page that supports both editing and PDF review simultaneously, similar to attached design."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit directly on one A4 page (Priority: P1)

As a job seeker, I can edit CV text directly on a single A4 PDF-like page so formatting and content changes happen in the same place without switching views.

**Why this priority**: This addresses the core inconsistency and removes the highest-friction step in the CV workflow.

**Independent Test**: Can be fully tested by opening one CV, editing key sections (summary, experience, education) directly on the A4 page, and confirming the document immediately reflects those text changes in place.

**Acceptance Scenarios**:

1. **Given** a user opens a CV workspace, **When** they click/select text on the A4 document surface, **Then** they can edit that text in place on the same page.
2. **Given** a user is in the unified workspace, **When** they save changes, **Then** the same A4 document surface shows the saved content and formatting.

---

### User Story 2 - Use one experience from both entry points (Priority: P2)

As a user entering from either CV management or seeing a job specific CV, I see the same editing-and-reviewing experience Which is a single editable A4 paper so behavior is predictable regardless of where I started.

**Why this priority**: Consistent behavior across entry points reduces confusion and avoids duplicated mental models.

**Independent Test**: Can be tested by opening the unified workspace from both CV management and job review and validating the same controls, structure, and outcomes are available.

**Acceptance Scenarios**:

1. **Given** a user opens a CV from CV management, **When** the workspace loads, **Then** the same edit-and-review interface appears as when opening from job review.
2. **Given** a user opens from job review with job context, **When** they edit and save, **Then** the saved result remains associated with that job-specific CV variant.

---

### User Story 3 - Protect edits during long sessions (Priority: P3)

As a user refining a CV over multiple edits, I can avoid accidental data loss and recover safely if I navigate away or encounter interruptions.

**Why this priority**: Long editing sessions are common for CV polishing and require reliable protection against loss.

**Independent Test**: Can be tested by making unsaved changes, attempting to leave the workspace, and verifying warning/recovery behavior while preserving latest saved data.

**Acceptance Scenarios**:

1. **Given** unsaved edits exist, **When** the user attempts to exit, **Then** the system warns them and allows them to keep editing or leave intentionally.
2. **Given** the session is interrupted after a successful save, **When** the user reopens the workspace, **Then** they see the most recently saved CV content and matching PDF review.

### Edge Cases

- User opens a CV that has missing required sections; the workspace must still load and clearly indicate incomplete content.
- User switches between multiple CV variants rapidly; the workspace must not apply edits to the wrong CV.
- A4 document rendering fails temporarily; editing state must be preserved and the user must receive a clear retry path.
- User has no job-specific CV yet from job review; system should create or prompt for a job-specific variant before editing.
- Concurrent updates occur from another session; system must prevent silent overwrite and guide the user to reconcile.
- Unauthorized user attempts to access/edit/export another user's CV; system must deny access with no data mutation.

## Assumptions

- Existing authentication and permission rules remain unchanged.
- Existing CV data model supports both base CVs and job-specific variants before migration.
- Unified workspace replaces page switching for edit vs review but does not expand scope into new CV authoring features.
- Users expect near-real-time visual feedback directly on the A4 document surface while editing.
- Legacy UI and compatibility paths are intentionally removed after migration to the new workspace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single A4 document workspace where users can edit CV text directly on the formatted page.
- **FR-002**: System MUST allow users to enter the same unified workspace from both CV management and job review entry points.
- **FR-003**: System MUST preserve the active CV context (base CV vs job-specific variant) throughout the editing session.
- **FR-004**: System MUST reflect text edits immediately on the same A4 document surface during the session.
- **FR-005**: Users MUST be able to save changes from the unified workspace without navigating to a different page.
- **FR-006**: System MUST show clear save state feedback (for example, saved, saving, or unsaved changes).
- **FR-007**: System MUST warn users before leaving when unsaved changes are present.
- **FR-008**: System MUST recover the most recently saved version when the user reopens the same CV workspace.
- **FR-009**: System MUST prevent edits to CVs the current user is not authorized to modify.
- **FR-009**: System MUST prevent edits to CVs the current user is not authorized to modify, return a forbidden response for unauthorized requests, and ensure no data mutation occurs.
- **FR-010**: System MUST present consistent structure, terminology, and actions regardless of entry point.
- **FR-011**: System MUST provide user-visible error handling when A4 document rendering fails, without discarding user edits.
- **FR-012**: System MUST ensure save actions apply only to the currently selected CV variant.
- **FR-013**: System MUST remove legacy edit/preview compatibility code paths and route users exclusively through the new editable A4 workspace.
- **FR-014**: System MUST provide and execute a migration process that converts legacy CV editing data into the new workspace scheme before cutover.
- **FR-014**: System MUST provide and execute a migration process that converts legacy CV editing data into the new workspace scheme before cutover, including dry-run support and detailed migration reporting.
- **FR-015**: System MUST define and document rollback steps for migration failures and block cutover when unresolved migration failures remain.

### Key Entities *(include if feature involves data)*

- **CV Document**: A user-owned resume containing structured sections (e.g., summary, experience, education).
- **CV Variant**: A CV version scoped either as a general/base CV or tailored to a specific job.
- **Edit Session**: The active user interaction state, including current variant, save status, and unsaved changes.
- **Editable A4 Document Surface**: The single formatted CV page the user interacts with directly for in-place text editing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of users complete a CV edit-and-review cycle without visiting a second page.
- **SC-002**: Median time to make and confirm a targeted CV change (edit + review) is reduced by at least 30% compared with the current split-flow baseline.
- **SC-003**: At least 95% of save attempts result in the saved content being visible on the same editable A4 document surface after save completes.
- **SC-004**: User-reported confusion tickets related to "where to edit vs where to review" decrease by at least 50% within one release cycle.
- **SC-005**: At least 90% of users can successfully complete first-time editing from either entry point without guidance.
- **SC-006**: 100% of active legacy CV records are migrated successfully to the new workspace format with no unrecoverable data loss.
- **SC-006**: 100% of active legacy CV records are migrated successfully to the new workspace format with no unrecoverable data loss, verified by migration summary report.
- **SC-007**: 100% of unauthorized workspace edit/export attempts return forbidden responses and produce zero successful unauthorized mutations during validation.
