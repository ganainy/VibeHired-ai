# Job App Assistant Constitution

## Core Principles

### I. Single Source of Truth for CV Data
- The system MUST keep CV persistence grounded in one canonical model and deterministic adapters.
- Features MUST avoid dual runtime sources of truth for the same CV content.

### II. Unified Editing Experience
- User-facing CV editing MUST use a single workspace paradigm for a given feature scope.
- Legacy edit flows MAY exist only during planned migration windows and MUST be removed after cutover.

### III. Authorization and Data Isolation
- All CV read/write/export operations MUST enforce authenticated ownership checks.
- Unauthorized edit attempts MUST return explicit forbidden responses and MUST NOT mutate data.

### IV. Migration Safety and Auditability
- Schema/flow migrations MUST be idempotent and safe to re-run.
- Migration runs MUST produce auditable summaries (processed, migrated, skipped, failed) and failure logs.
- Cutover MUST include rollback instructions when migration failures are non-zero.

### V. Simplicity and Scope Discipline
- Implementations MUST prefer the simplest design that meets the approved spec.
- Teams MUST avoid adding out-of-scope UX features during delivery.

## Quality and Security Requirements

- APIs MUST validate inputs and return stable error semantics.
- Release gates MUST include build validation for affected workspaces.
- New critical paths MUST have explicit acceptance criteria in spec and tasks.

## Development Workflow and Gates

- Spec, plan, and tasks MUST remain consistent before implementation begins.
- Any high or critical analysis issue MUST be resolved or explicitly waived before implementation.
- Migration features MUST include dry-run validation and post-migration verification steps.

## Governance

- This constitution supersedes local planning conventions when conflicts arise.
- Amendments require a documented rationale and version update in this file.
- Compliance is verified during specification analysis and task planning.

**Version**: 1.0.0 | **Ratified**: 2026-02-16 | **Last Amended**: 2026-02-16
