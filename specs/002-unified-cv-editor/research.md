# Research: Unified Editable A4 CV Workspace

## Decision 1: Use `pdfme` Form + Generator in-browser for edit/download parity

- **Decision**: Use `Form` from `@pdfme/ui` as the interactive A4 editing surface and use `generate` from `@pdfme/generator` with the same `template` and `form.getInputs()` for download/export.
- **Rationale**: `pdfme` explicitly supports creating a form from template+inputs and generating a PDF from the same inputs, which directly satisfies: "the downloaded PDF is the same PDF being edited." This minimizes transformation drift between editing and export.
- **Alternatives considered**:
  - Keep current custom React editor + separate preview rendering: rejected because it preserves split behavior and mismatch risk.
  - Server-side-only PDF regeneration (no client-side parity): rejected because user cannot trust that what they edit is exactly what they download.

## Decision 2: Keep a single canonical data model (`cvJson`) with a deterministic `pdfme` adapter

- **Decision**: Keep `cvJson` as source-of-truth in persistence and add a deterministic mapping layer between `cvJson` and `pdfme` template inputs.
- **Rationale**: Existing APIs, analytics, ATS, and generation flows already rely on `cvJson`; replacing this model would cause unnecessary migration risk. Adapter strategy localizes UI/PDF concerns while preserving platform compatibility.
- **Alternatives considered**:
  - Replace stored CV model with raw `pdfme` inputs: rejected due to high migration cost and likely breaking existing features.
  - Dual write to both models as independent sources of truth: rejected due to conflict complexity.

## Decision 3: Enforce single-page A4 editing mode in both entry points

- **Decision**: Remove split mental model and present one editable A4 surface for both `/manage-cv` and `/review` CV editing flows.
- **Rationale**: Feature goal is consistency and no separate edit-vs-preview pages; forcing one mode avoids UI drift and user confusion.
- **Alternatives considered**:
  - Keep optional split mode: rejected because it reintroduces inconsistent behavior and training burden.
  - Keep separate pages with shared components: rejected because user still switches contexts.

## Decision 4: Save behavior uses debounced autosave + explicit save state + navigation protection

- **Decision**: Implement debounced autosave for field edits, explicit status indicator (`saving/saved/unsaved/error`), and unsaved-leave guard.
- **Rationale**: Direct in-page editing increases frequency of small edits; debounce prevents save storms while preserving perceived reliability.
- **Alternatives considered**:
  - Manual-save only: rejected due to higher data-loss risk for long sessions.
  - Save on every keystroke: rejected due to backend load and race conditions.

## Decision 5: Download path uses the active CV variant context without conversion fallback

- **Decision**: Download API/workflow always generates from current variant context (primary, branch, or job-specific) and current template+inputs shown in the active A4 session.
- **Rationale**: This ensures FR-003/FR-012 alignment and prevents accidental cross-variant exports.
- **Alternatives considered**:
  - Always export from primary CV only: rejected because it violates job-specific editing expectations.
  - Export from last saved server copy only: rejected because user expects the visible edited document.

## Decision 6: Performance envelope and rendering scope

- **Decision**: Optimize for single-page A4 rendering first; paginate/multipage behavior is out-of-scope for this feature release.
- **Rationale**: Requirement explicitly targets one A4 paper editable experience; limiting scope reduces delivery risk and preserves quality.
- **Alternatives considered**:
  - Full multi-page template redesign now: rejected as scope expansion.
  - Continue template-specific preview rendering for some templates: rejected due to inconsistent UX.

## Decision 7: Testing strategy for this repo state

- **Decision**: Use targeted manual scenario validation plus existing build verification (`npm run build --workspace=client` and `npm run build --workspace=server`) since no automated tests are configured for this workflow.
- **Rationale**: Matches current repository constraints and still validates feature safely.
- **Alternatives considered**:
  - Introduce full E2E suite in this feature: rejected as out-of-scope and likely to delay core UX fix.

## Decision 8: No backward compatibility; use one-time migration + hard cutover

- **Decision**: Do not keep legacy edit/preview compatibility code paths. Implement a one-time migration script and cut over all users to the new editable A4 workspace.
- **Rationale**: Maintaining dual paths increases complexity and regression risk, and conflicts with the product direction of one unified editing experience.
- **Alternatives considered**:
  - Keep legacy routes behind a fallback flag: rejected because it prolongs inconsistency and doubles maintenance.
  - Perform manual per-user migration on first login: rejected due to unpredictable user latency and harder rollback control.
