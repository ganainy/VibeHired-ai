# Tasks: Unified CV Edit-Review Workspace

**Input**: Design documents from `/specs/002-unified-cv-editor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/unified-cv-workspace.openapi.yaml, quickstart.md

**Tests**: No automated test tasks are included because the specification does not explicitly request TDD or new automated tests for this feature.

**Organization**: Tasks are grouped by user story so each story is independently implementable and verifiable.

## Format: `[ID] [P?] [Story?] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add `pdfme` dependencies and scaffold shared workspace modules.

- [ ] T001 Install `pdfme` dependencies in client/package.json
- [ ] T002 Create pdfme workspace module scaffold entry in client/src/components/cv-editor/pdfme/index.ts
- [ ] T003 [P] Create CV workspace API client service in client/src/services/cvWorkspaceApi.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared backend/frontend foundations required by all stories.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [ ] T004 Create request/response validation schemas for workspace APIs in server/src/validations/cvWorkspaceSchemas.ts
- [ ] T005 Implement workspace load/save/export service logic in server/src/services/cvWorkspaceService.ts
- [ ] T006 Add workspace API endpoints from contract in server/src/routes/cvs.ts
- [ ] T033 [P] Enforce authorization ownership checks for workspace GET/PATCH/POST endpoints in server/src/routes/cvs.ts
- [ ] T007 [P] Implement cvJson ↔ pdfme input mapping adapter in client/src/components/cv-editor/pdfme/mappers.ts
- [ ] T008 [P] Implement reusable single-A4 pdfme editor wrapper in client/src/components/cv-editor/PdfmeA4Editor.tsx
- [ ] T009 Implement shared save-state and debounce hook in client/src/components/cv-editor/pdfme/useWorkspaceSaveState.ts
- [ ] T010 Create idempotent migration script for legacy CV editing data in server/src/scripts/migrateCvWorkspaceData.ts
- [ ] T034 [P] Add migration dry-run mode and summary output in server/src/scripts/migrateCvWorkspaceData.ts
- [ ] T035 [P] Add migration failure log output and non-zero-failure blocking behavior in server/src/scripts/migrateCvWorkspaceData.ts

**Checkpoint**: Foundation complete; user stories can now be implemented.

---

## Phase 3: User Story 1 - Edit directly on one A4 page (Priority: P1) 🎯 MVP

**Goal**: Deliver one editable A4 CV surface where download output matches what the user edits.

**Independent Test**: Open one CV, edit text directly on A4 surface, save, download, and confirm downloaded PDF matches current edited content.

### Implementation for User Story 1

- [ ] T011 [US1] Create unified CV workspace page shell in client/src/pages/CVWorkspacePage.tsx
- [ ] T012 [P] [US1] Implement A4 editor plugin bindings in client/src/components/cv-editor/PdfmeA4Editor.tsx
- [ ] T013 [P] [US1] Register workspace route and navigation entry in client/src/App.tsx
- [ ] T014 [US1] Integrate workspace load/save/export API calls in client/src/pages/CVWorkspacePage.tsx
- [ ] T015 [US1] Wire download action to export current workspace version in client/src/pages/CVWorkspacePage.tsx
- [ ] T016 [US1] Show explicit save-state feedback (unsaved/saving/saved/error) in client/src/pages/CVWorkspacePage.tsx

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Use one experience from both entry points (Priority: P2)

**Goal**: Ensure CV Management and Review & Finalize both land on the same editable A4 workspace behavior.

**Independent Test**: Open the same CV context from each entry point and verify identical single-page A4 editing behavior with correct variant context.

### Implementation for User Story 2

- [ ] T017 [US2] Implement job-to-workspace context resolver endpoint in server/src/routes/cvs.ts
- [ ] T018 [P] [US2] Update CV management entry navigation to unified workspace in client/src/pages/CVManagementPage.tsx
- [ ] T019 [P] [US2] Update review/finalize entry navigation to unified workspace in client/src/pages/ReviewFinalizePage.tsx
- [ ] T020 [P] [US2] Add variant context banner/metadata binding (primary/branch/job-specific) in client/src/pages/CVWorkspacePage.tsx
- [ ] T021 [US2] Enforce active variant safety checks on save/export in server/src/services/cvWorkspaceService.ts

**Checkpoint**: User Stories 1 and 2 are independently functional.

---

## Phase 5: User Story 3 - Protect edits during long sessions (Priority: P3)

**Goal**: Prevent data loss with autosave, leave guards, and conflict/error recovery.

**Independent Test**: Make unsaved edits, attempt to leave, simulate save/render failures, and verify recovery path preserves user changes.

### Implementation for User Story 3

- [ ] T022 [US3] Add unsaved-changes leave guard for browser/tab and in-app navigation in client/src/pages/CVWorkspacePage.tsx
- [ ] T023 [US3] Implement debounced autosave and retry workflow in client/src/components/cv-editor/pdfme/useWorkspaceSaveState.ts
- [ ] T024 [US3] Implement version-conflict handling (409) and reconcile flow in client/src/pages/CVWorkspacePage.tsx
- [ ] T025 [P] [US3] Return and persist workspace version/lastSavedAt from save endpoint in server/src/services/cvWorkspaceService.ts
- [ ] T026 [P] [US3] Add A4 rendering failure fallback + retry UI in client/src/components/cv-editor/PdfmeA4Editor.tsx

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency pass, docs update, and build validation.

- [ ] T027 [P] Remove obsolete split edit/preview mode code paths in client/src/pages/CVManagementPage.tsx
- [ ] T028 [P] Remove obsolete split edit/preview mode code paths in client/src/pages/ReviewFinalizePage.tsx
- [ ] T029 Remove legacy compatibility routes/helpers in server/src/routes/cvs.ts
- [ ] T030 Execute migration script and record migration summary in specs/002-unified-cv-editor/quickstart.md
- [ ] T031 Update feature usage notes in specs/002-unified-cv-editor/quickstart.md
- [ ] T032 Run build validation commands and record results in specs/002-unified-cv-editor/quickstart.md
- [ ] T036 Validate unauthorized workspace edit/export attempts return forbidden with no mutation and record evidence in specs/002-unified-cv-editor/quickstart.md
- [ ] T037 Add migration rollback runbook and post-migration verification checklist in specs/002-unified-cv-editor/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; blocks all stories.
- **Phase 3 (US1)**: depends on Phase 2, including migration script availability (T010).
- **Phase 4 (US2)**: depends on Phase 2 and integrates with US1 route/page.
- **Phase 5 (US3)**: depends on Phase 2 and builds resilience over US1 behavior.
- **Phase 6 (Polish)**: depends on completion of desired stories and includes migration execution/cutover.

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories after foundation.
- **US2 (P2)**: depends on unified workspace from US1 but remains independently testable by entry-point parity.
- **US3 (P3)**: depends on unified workspace from US1 but remains independently testable by resilience workflows.

### Within Each Story

- Shared contracts/services before page integration.
- API integration before UX refinements.
- Core behavior before cleanup.

---

## Parallel Execution Examples

### User Story 1

- Run T012 and T013 in parallel after T011 because they modify separate files: client/src/components/cv-editor/PdfmeA4Editor.tsx and client/src/App.tsx.

### User Story 2

- Run T017 and T018 in parallel because they touch different entry pages: client/src/pages/CVManagementPage.tsx and client/src/pages/ReviewFinalizePage.tsx.

### User Story 3

- Run T025 and T026 in parallel because they affect backend save metadata and frontend rendering fallback in separate files.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (Phase 1).
2. Complete Foundational prerequisites (Phase 2).
3. Complete User Story 1 (Phase 3).
4. Validate independent test for US1 and demo single editable A4 + matching download.

### Incremental Delivery

1. Deliver US1 for core value.
2. Add US2 for entry-point consistency.
3. Add US3 for reliability and data-loss protection.
4. Execute migration cutover and remove legacy paths.
5. Finish with polish/build validation.

### Suggested MVP Scope

- **MVP**: Through Phase 3 (US1) only.
- **Post-MVP**: Phase 4 (US2) then Phase 5 (US3).
