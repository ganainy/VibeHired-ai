# Implementation Plan: Multi-Branch CV System

**Branch**: `001-multi-cv-selection` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/001-multi-cv-selection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a multi-branch CV system allowing users to maintain multiple CV versions for different career paths (e.g., IT Helpdesk, Programming, Cybersecurity), with a primary CV as default and job-specific tracking of which base CV was used. Phase 1 (data model changes) is complete.

## Technical Context

**Language/Version**: Node.js/TypeScript (Backend), React/TypeScript (Frontend)  
**Primary Dependencies**: Express.js, Mongoose, React, Vite  
**Storage**: MongoDB with Mongoose ODM  
**Testing**: Jest for unit tests, manual testing for integration  
**Target Platform**: Web application (client + server)  
**Project Type**: Full-stack web application  
**Performance Goals**: <500ms API response times, <2s page loads  
**Constraints**: Backward compatibility with existing data, transaction-safe migrations  
**Scale/Scope**: Single-user per session, moderate data volume (CVs, jobs per user)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Data integrity maintained during migration
- Backward compatibility preserved
- API contracts follow REST principles
- TypeScript types ensure compile-time safety

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-cv-selection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
