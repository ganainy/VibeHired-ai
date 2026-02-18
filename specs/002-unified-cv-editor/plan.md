# Implementation Plan: Unified CV Edit-Review Workspace

**Branch**: `002-unified-cv-editor` | **Date**: 2026-02-16 | **Spec**: `e:\VS-projects\job-app-assistant\specs\002-unified-cv-editor\spec.md`
**Input**: Feature specification from `e:\VS-projects\job-app-assistant\specs\002-unified-cv-editor\spec.md`

## Summary

Deliver one unified CV workspace where users edit text directly on a single A4 document surface and download the exact same formatted PDF they were editing. The implementation uses `pdfme` in the browser with a stable template + input mapping model so in-session editing and generated output stay consistent across CV Management and Review & Finalize entry points, with a hard cutover that removes legacy compatibility paths.

## Technical Context

**Language/Version**: TypeScript (`client` TS ~5.7, `server` TS ~5.8), React 19, Node.js runtime for backend  
**Primary Dependencies**: React, Vite, Express 5, Mongoose, existing CV APIs, `pdfme` packages (`@pdfme/ui`, `@pdfme/generator`, `@pdfme/common`, `@pdfme/schemas`)  
**Storage**: MongoDB via existing CV documents (`cvJson`, `templateId`, branch/job linkage)  
**Testing**: Existing project has no automated test suite configured for this area; validation via targeted manual workflow checks + existing `npm run build --workspace=client` and `npm run build --workspace=server`  
**Target Platform**: Web browser (desktop-first A4 editing experience) + existing Node/Express API  
**Project Type**: Web application (monorepo with frontend + backend)  
**Performance Goals**: A4 editing interactions feel immediate and document updates are visible within ~500ms for typical CV field edits on standard desktop hardware  
**Constraints**: Single-page A4 editable experience only (no split editor/preview), preserve CV variant context, avoid data loss on navigation, downloaded PDF must match edited content, no backward-compatibility UI/code path retention after migration  
**Scale/Scope**: Existing authenticated users managing multiple CV variants (primary/branch/job-specific), one unified editing experience reused from two existing entry points

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Constitution file (`e:\VS-projects\job-app-assistant\.specify\memory\constitution.md`) is ratified and defines enforceable principles for single-source CV data, authz, migration safety, and scope discipline.
- **Initial Gate Result**: PASS (plan aligns with unified editing, authz checks, and migration auditability requirements).
- **Post-Design Gate Result**: PASS (no constitution violations or complexity exceptions identified).

## Project Structure

### Documentation (this feature)

```text
specs/002-unified-cv-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
client/
└── src/
    ├── pages/
    │   ├── CVManagementPage.tsx
    │   └── ReviewFinalizePage.tsx
    ├── components/
    │   └── cv-editor/
    └── services/
        └── cvApi.ts

server/
└── src/
    ├── routes/
    │   └── cvs.ts
    ├── models/
    │   └── CV.ts
    └── utils/
        └── pdfGenerator.ts
```

**Structure Decision**: Use the existing monorepo web structure and implement the unified A4 editing capability primarily in `client/src/pages` and `client/src/components/cv-editor`, while extending existing `server/src/routes/cvs.ts` endpoints only where persistence/output parity APIs are needed.

## Phase 0: Research Plan

1. Validate `pdfme` browser workflow for editable form surface + deterministic PDF generation from the same template/inputs.
2. Define mapping strategy between current `cvJson` sections and `pdfme` template fields.
3. Decide synchronization and autosave strategy to prevent mismatch between visible A4 edits and persisted CV data.
4. Define one-time migration and cutover strategy from legacy edit/preview modes to the strict single A4 editing mode.

## Phase 1: Design Plan

1. Produce entity model for editable A4 sessions, template bindings, and CV variant safety.
2. Define API contracts for loading, saving, and exporting the same rendered content.
3. Document quickstart flow for opening, editing, saving, and downloading the identical PDF.
4. Update agent context with newly introduced technology (`pdfme`) and cutover assumptions.

## Migration Strategy

1. Create an idempotent migration script in `server/src/scripts/migrateCvWorkspaceData.ts`.
2. Convert legacy CV editing fields/state into the new workspace-compatible representation.
3. Produce migration summary counts (processed, migrated, skipped, failed) and failure logs.
4. Remove legacy route/view mode compatibility logic after migration verification.

## Phase 2: Task Planning Approach

Generate tasks that sequence:
1. Foundation (`pdfme` integration scaffolding and template-input adapter),
2. Entry point unification (`/manage-cv` and `/review` routing/state convergence),
3. Save/export parity checks,
4. Hardening for unsaved changes and variant isolation.

## Complexity Tracking

No constitution violations or complexity exceptions identified at planning stage.
