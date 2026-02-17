# Quickstart: Unified Editable A4 CV Workspace

## Goal

Edit CV content directly on one A4 PDF-like page and download the same document output without switching pages.

## Prerequisites

- Repository dependencies installed in workspace root.
- Existing authentication flow available.
- Feature branch checked out: `002-unified-cv-editor`.

## Setup

1. Install pdfme packages in client workspace:
   - `npm install --workspace=client @pdfme/ui @pdfme/generator @pdfme/common @pdfme/schemas`
2. Run app locally:
   - `npm run dev`

## Migration and Cutover

1. Run migration script before enabling full cutover:
   - `npm run migrate-cv-workspace --workspace=server`
2. Verify migration summary:
   - Processed count, migrated count, skipped count, failed count.
3. Confirm failed count is 0 before removing legacy paths.

## User Flow Validation

1. Open CV from **Manage CV** entry point.
2. Confirm one editable A4 document surface is shown (no separate preview page).
3. Click/select text on A4 page and edit content in place.
4. Confirm save status changes through `unsaved -> saving -> saved`.
5. Download PDF from the same workspace.
6. Verify downloaded PDF content/format matches the A4 document being edited.
7. Repeat from **Review & Finalize** entry point and confirm same behavior.

## Variant Safety Validation

1. Open a branch CV and edit/download.
2. Open a job-specific CV and edit/download.
3. Verify each save/export applies only to the active variant context.

## Failure Handling Validation

1. Make edits and simulate save failure.
2. Confirm user sees error state with retry path.
3. Confirm edits are not silently discarded.

## Build Validation

- `npm run build --workspace=client`
- `npm run build --workspace=server`
