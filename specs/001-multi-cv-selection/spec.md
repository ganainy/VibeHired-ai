# Feature Specification: Multi-Branch CV System

**Feature Branch**: `001-multi-cv-selection`  
**Created**: [DATE]  
**Status**: In Progress (Phase 1 Complete)  
**Input**: User description: "Implement multi-branch CV system with categories"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Multiple CV Branches (Priority: P1)

As a job seeker, I want to create and maintain multiple CV versions tailored for different career paths (e.g., IT Helpdesk, Programming, Cybersecurity) so that I can apply to jobs that match my specific skills and experience.

**Why this priority**: This is the core functionality that enables users to have specialized CVs for different job types, which is essential for effective job applications.

**Independent Test**: Can be fully tested by creating multiple CV branches, uploading different content for each, and verifying they are stored separately.

**Acceptance Scenarios**:

1. **Given** I have a primary CV, **When** I create a new CV branch called "Programming", **Then** a new CV is created with the same content as primary but marked as a branch
2. **Given** I have multiple CV branches, **When** I view my CV list, **Then** I see all branches with their categories and display names
3. **Given** I have a primary CV, **When** I create a job application, **Then** I can select which CV branch to use for that application

---

### User Story 2 - Set Primary CV (Priority: P2)

As a job seeker, I want to designate one CV as my primary/default version so that when I don't specify a branch for a job application, the system uses my primary CV.

**Why this priority**: Provides a fallback default behavior and ensures backward compatibility with existing job applications.

**Independent Test**: Can be tested by setting a CV as primary and verifying it's used as default for new job applications.

**Acceptance Scenarios**:

1. **Given** I have multiple CV branches, **When** I set one as primary, **Then** only one CV can be primary at a time
2. **Given** I have a primary CV set, **When** I create a job application without specifying a CV, **Then** the primary CV is automatically selected
3. **Given** I try to delete my primary CV, **When** I have other CVs, **Then** I'm prompted to set another as primary first

---

### User Story 3 - Job-Specific CV Selection (Priority: P2)

As a job seeker, I want to select which CV branch to use when creating a job application so that I can match the most appropriate CV to each job opportunity.

**Why this priority**: Enables targeted job applications with the most relevant CV version.

**Independent Test**: Can be tested by creating a job application and selecting a specific CV branch.

**Acceptance Scenarios**:

1. **Given** I have multiple CV branches, **When** I create a job application, **Then** I can choose which CV branch to associate with it
2. **Given** I select a CV branch for a job, **When** the application is saved, **Then** the job record shows which base CV was used
3. **Given** I view job application details, **When** I look at the CV section, **Then** I see which branch/version was used

---

### User Story 4 - Manage CV Branches (Priority: P3)

As a job seeker, I want to rename, organize, and manage my CV branches so that I can keep them well-organized as my career evolves.

**Why this priority**: Provides maintenance capabilities for long-term CV management.

**Independent Test**: Can be tested by renaming branches and verifying the changes persist.

**Acceptance Scenarios**:

1. **Given** I have a CV branch, **When** I rename it, **Then** the new name appears in all relevant UI
2. **Given** I have unused CV branches, **When** I delete them, **Then** they're removed but primary CV is protected
3. **Given** I create a new branch, **When** I specify a category, **Then** it's saved and displayed with the branch

## Technical Requirements

### Data Model Changes
- CV model: Add `isPrimary`, `category`, `displayName` fields
- JobApplication model: Add `baseCvId`, `jobCategory` fields
- Unique constraint: Only one CV can be primary per user
- Migration: Convert existing master CVs to primary, preserve job-CV relationships

### API Endpoints
- GET /api/cvs/branches - List all CV branches for user
- POST /api/cvs/create-branch - Create new CV branch
- PATCH /api/cvs/:id/set-primary - Set CV as primary
- PATCH /api/cvs/:id/rename - Rename CV branch
- Update existing CV upload to set primary flag
- Update job application creation to accept baseCvId

### UI Changes
- CV Management page: Show branches with categories
- Add Job modal: Include CV branch selection dropdown
- Primary CV indicator in CV lists
- Branch creation/editing forms

### Migration Strategy
- Safe migration script with transaction rollback
- Backward compatibility during transition
- Validation of data integrity post-migration

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
