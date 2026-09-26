---
argument-hint: <feature-name-or-technical-spec-path>
description: Transform a Technical Specification (SDD Level 2) into a consolidated backend implementation plan across multiple microservices
---

# SDD Level 3 Backend Implementation Planning

## Input

The following arguments were provided: `$ARGUMENTS`

### Parsing logic:

```
argument_1 = File path or feature name (optional)

CASE 1: File path provided (e.g., "docs/features/SMP-1234/technical_specification.md")
  - Use the provided path as technical_spec_path
  - Extract feature_name from path using regex: match "[A-Z]+-\d+" in path
  - Example: "docs/features/SMP-1234/technical_specification.md" → feature_name = "SMP-1234"

CASE 2: Feature name provided (e.g., "SMP-1234", "foo_add_users")
  - If argument matches pattern "[A-Z]+-\d+":
    - Use as feature_name
    - Technical spec path = docs/features/{feature_name}/technical_specification.md

CASE 3: No argument provided or argument is empty
  - Use AskUserQuestion tool to request the file path:
    - Question: "Please provide the path to the technical specification file"
    - Options:
      A) Enter file path (e.g., docs/features/SMP-1234/technical_specification.md)
  - Then apply CASE 1 logic to the provided path
```

---

## Prerequisites

Before starting, verify:

```bash
# Check if technical specification exists
ls -la docs/features/{feature_name}/technical_specification.md
```

**If not found:** STOP and inform the user:
> "Technical specification not found. Please run `/architecture:A-start-technical-plan {feature_name}` first to generate the SDD Level 2 specification."

---

## Workflow

Follow the **"Explore, Team Selection, Plan, Advice, Update, Clarification and Iterate"** workflow.

---

# Create the Session File

Create `.claude/sessions/context_session_{feature_name}_backend.md` where the plan will be updated with all future iterations and feedback.

Initial content:
```markdown
# Backend Implementation Session: {feature_name}

## Source Documents
- Technical Specification: `docs/features/{feature_name}/technical_specification/technical_specification-v{X.Y.Z}.md`
- API Design: `docs/features/{feature_name}/api_design/api_design-v{X.Y.Z}.md` (if exists)

## Session Status
- [ ] Explore - Analyze technical specification and identify microservices
- [ ] Team Selection - Determine which agents to involve
- [ ] Plan - Create initial implementation plan
- [ ] Advice - Get input from specialized planner agents
- [ ] Clarification - Resolve open questions with user
- [ ] Finalize - Consolidate final implementation plan

---

## Technical Specification Summary

{To be populated during Explore phase}

---

## Selected Microservices

{To be populated after user confirmation}

---

## Implementation Plan

{To be populated during Plan and Advice phases}
```

---

# Explore

## 1. Read Technical Specification

Read and analyze:
- `docs/features/{feature_name}/technical_specification/technical_specification-v{latest}.md`
- `docs/features/{feature_name}/api_design/api_design-v{latest}.md` (if exists)

Extract:
- Affected bounded contexts
- API endpoints to implement
- Business rules
- Data requirements (new entities, fields)
- Events to publish/consume
- Security requirements

## 2. Load Microservices Catalog

Read `backend/REPOSITORIES-SUMMARY.md` to understand available microservices.

## 3. Identify Affected Microservices

Based on the technical specification, identify which microservices will be affected. Present your analysis to the user:

```markdown
## Microservice Analysis

Based on the technical specification for **{feature_name}**, I've identified the following microservices:

### Likely Affected

| Microservice | Technology | Tipology | Reason |
|--------------|------------|----------|--------|
| {ms_1} | {tech} | {tipology} | {why this MS is affected} |
| {ms_2} | {tech} | {tipology} | {why this MS is affected} |

### Possibly Affected

| Microservice | Technology | Tipology | Reason |
|--------------|------------|----------|--------|
| {ms_3} | {tech} | {tipology} | {uncertain reason} |

### Questions

**Q1: Which microservices should be included in the implementation plan?**
- A) Accept my analysis: {list likely affected}
- B) Add: {specify}
- C) Remove: {specify}
- D) Different list entirely
```

**WAIT for user confirmation before continuing.**

## 4. Clone Selected Repositories

After user confirms microservices:

```bash
mkdir -p .claude/sessions/{feature_name}/repos

# Clone each selected repository
git clone --depth 1 https://github.com/company/{repo_name}.git .claude/sessions/{feature_name}/repos/{ms_name}
```

## 5. Analyze Each Microservice

For each cloned repository:
- Analyze project structure (`tree -L 3`)
- Identify existing patterns (DDD layers, models, APIs)
- Find relevant existing code related to the feature
- Document technology stack and architecture

---

# Team Selection

Select which planner subagents will be involved based on each microservice's technology:

| Technology | Tipology | Agent |
|------------|----------|-------|
| Python Django | BaaS | djangorestframework-planner |
| Python Django | DaaS | daas-planner |
| Python FastAPI | Any | fastapi-planner |
| Python (general) | Any | ddd-planner |
| React + Vite (frontend) | Any | frontend-planner |

**Agent Execution Order:**
1. First invoke **ddd-planner** to establish domain architecture
2. Wait for completion
3. Then invoke framework-specific planners (**fastapi-planner**, **djangorestframework-planner**, **daas-planner**)
4. If the feature has a user interface, invoke **frontend-planner** after the backend planners, passing their plans so the UI uses the real API contract

Present the team selection to user:

```markdown
## Proposed Agent Team

Based on the technology and tipology of each microservice, I propose the following agents:

| Microservice | Technology | Tipology | Agent(s) | Execution Order |
|--------------|------------|----------|----------|-----------------|
| {ms_1} | Django | BaaS | ddd-planner → djangorestframework-planner | 1 → 2 |
| {ms_2} | Django | DaaS | ddd-planner → daas-planner | 1 → 3 |
| {ms_3} | FastAPI | BaaS | ddd-planner → fastapi-planner | 1 → 4 |

### Execution Strategy

- **Sequential (must wait):** ddd-planner must complete before framework-specific planners
- **Parallel (can run together):** Framework-specific planners for different microservices

### Questions

**Q2: Do you approve this agent selection?**
- A) Yes, proceed with the proposed agents
- B) Change agent for specific microservice: {specify which and why}
- C) Skip agents for some microservices (I'll provide manual guidance)
- D) Add additional agents: {specify}
```

**WAIT for user confirmation before continuing.**

---

# Plan

Create an initial implementation plan covering ALL microservices in a single document.

Think hard and write up a detailed implementation plan that includes:
- Domain model changes per microservice
- API endpoints to implement
- Database migrations needed
- Event publishing/consuming
- Integration points between microservices
- Testing strategy

If there are things you still do not understand or questions you have for the user, pause here to ask them before continuing.

---

# Advice

Invoke the selected planner subagents to get detailed implementation guidance.

**IMPORTANT for planner subagents:**
- Provide the FULL context from the session file
- Tell them to create their detailed implementation plan
- Do NOT ask for "quick validation" or "brief recommendations"
- Let them do their complete job

**Prompt structure for planner agents:**

```
I need you to create a detailed implementation plan for {feature_name} - specifically for microservice {ms_name}.

**IMPORTANT - Output Path:**
Save your plan to: `docs/features/{feature_name}/backend_{ms_name}.md`

**Context**:
- Technical Specification: docs/features/{feature_name}/technical_specification.md
- Microservice Code: .claude/sessions/{feature_name}/repos/{ms_name}

**Requirements for this microservice**:
{Extract relevant sections from technical spec}

**Existing code structure**:
{Summary from Explore phase}

Please analyze the existing codebase and create your detailed implementation plan. Focus on:
1. Files to create/modify
2. Domain entities and business logic
3. API endpoints
4. Database changes
5. Integration points (calls to other microservices, events published/consumed)
6. Testing approach

Use the template structure from the command that invoked you, saving to the specified output path.
```

After each agent completes, verify the plan file was created at `docs/features/{feature_name}/backend_{ms_name}.md`.

---

# Update

Update the session file with:
- List of implementation plan files created (one per microservice)
- Summary of key architectural decisions

**Create ONE implementation plan file per microservice:**

For each microservice `{ms_name}`, create `docs/features/{feature_name}/backend_{ms_name}.md`:

```markdown
# Backend Implementation Plan: {ms_name}

## Overview

**Feature:** {feature_name}
**Microservice:** {ms_name}
**Repository:** `company/{repo_name}`
**Technology:** {Django/FastAPI}
**Tipology:** {BaaS/DaaS/Worker}
**Status:** Ready for Implementation
**Created:** {date}

## Technical Specification Reference

See: `docs/features/{feature_name}/technical_specification.md`

---

## Summary

{2-3 paragraph description of what this microservice does for the feature, key changes required, and architecture notes}

### Key Changes Required

1. **{Change Category 1}:** {brief description}
2. **{Change Category 2}:** {brief description}
3. **{Change Category 3}:** {brief description}

---

## Architecture

### Layer Breakdown

| Layer | Responsibilities | Dependencies |
|-------|-----------------|--------------|
| {Layer 1} | {responsibilities} | {dependencies} |
| {Layer 2} | {responsibilities} | {dependencies} |

### File Structure

```
apps/{context}/
├── models/
│   └── {file}.py          # {ACTION}: {description}
├── serializers/
│   └── {file}.py          # {ACTION}: {description}
├── views/
│   └── {file}.py          # {ACTION}: {description}
└── urls/
    └── {file}.py          # {ACTION}: {description}
```

---

## Domain Model

- **Entities**: {list with (NEW) or (MODIFIED) markers}
- **Value Objects**: {list or None}
- **Aggregates**: {aggregate root identification}
- **Key Business Rules**:
  - {rule 1}
  - {rule 2}

---

## Implementation Details

> **CRITICAL**: This section contains the actual implementation code/pseudocode.
> Each file must include: Action, Purpose, and Key signatures with code.

### File: {path/to/file.py}

- **Action**: CREATE | MODIFY
- **Purpose**: {what this file does}
- **Key signatures**:

```python
# Actual implementation code or detailed pseudocode
class EntityName(BaseModel):
    """
    Docstring explaining the entity
    """
    field_name: type = default_value  # Comment explaining field

    def method_name(self, param: type) -> return_type:
        """Method docstring"""
        # Implementation logic
        pass
```

- **Notes**:
  - {Implementation note 1}
  - {Implementation note 2}

### File: {path/to/another_file.py}

- **Action**: CREATE | MODIFY
- **Purpose**: {what this file does}
- **Key signatures**:

```python
# Continue with actual code for each file...
```

- **Notes**:
  - {Notes specific to this file}

{Repeat for EACH file that needs to be created or modified}

---

## API Endpoints

| Method | Path | Purpose | Request Schema | Response Schema |
|--------|------|---------|----------------|-----------------|
| POST | `/api/v1/{resource}` | {purpose} | `{RequestModel}` | `{ResponseModel}` |
| GET | `/api/v1/{resource}/{id}` | {purpose} | - | `{ResponseModel}` |

### Endpoint Details

#### {METHOD} {path}

**Purpose:** {detailed purpose}

**Request Body:**
```json
{
  "field": "value",
  "nested": {
    "field": "value"
  }
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "field": "value"
}
```

**Error Responses:**
- `400`: {validation error scenarios}
- `403`: {permission denied scenarios}
- `404`: {not found scenarios}

---

## Database Migrations

### Migration Strategy

{Zero-downtime strategy if applicable, or standard migration approach}

### Migration 1: {description}

```python
# Django migration or SQL
class Migration(migrations.Migration):
    operations = [
        migrations.CreateModel(
            name='ModelName',
            fields=[
                ('id', models.UUIDField(primary_key=True)),
                # ... fields
            ],
        ),
    ]
```

### Migration 2: {description}

```python
# Continue with each migration...
```

---

## Events Integration

### Events Published

| Event | When | Payload | Consumers |
|-------|------|---------|-----------|
| `{event_name}` | {trigger} | `{PayloadSchema}` | {list of consuming microservices} |

### Events Consumed

| Event | From | Action | Handler |
|-------|------|--------|---------|
| `{event_name}` | {source microservice} | {what action to take} | `{HandlerClass}` |

---

## External Dependencies

### API Calls to Other Microservices

| Target MS | Endpoint | Purpose | When Called |
|-----------|----------|---------|-------------|
| {ms_name} | GET /api/v1/{resource} | {purpose} | {trigger} |

### Configuration

Required environment variables:
- `{ENV_VAR_NAME}`: {description}

---

## Testing

### Test Strategy

{Brief description of testing approach}

### Unit Tests

**File**: `tests/unit/test_{component}.py`

```python
import pytest

class Test{ComponentName}:
    """Test suite for {component}"""

    def test_{scenario}(self, {fixtures}):
        """
        Test {what is being tested}
        """
        # Arrange
        {setup code}

        # Act
        {action code}

        # Assert
        assert {assertions}

    def test_{another_scenario}(self, {fixtures}):
        """
        Test {another scenario}
        """
        pass
```

**Test Fixtures** (add to conftest.py):

```python
@pytest.fixture
def {fixture_name}():
    """
    {fixture description}
    """
    return {
        "field": "value"
    }
```

### Integration Tests

**File**: `tests/integration/test_{use_case}.py`

```python
# Integration test code...
```

### Test Coverage Requirements

- Unit tests: >80% coverage on business logic
- Integration tests: All API endpoints
- Performance: {specific requirements if any}

---

## Implementation Order

### Dependencies

{If this MS depends on others being implemented first, specify here}

- **Blocked by**: {list of microservices that must be deployed first}
- **Blocks**: {list of microservices that depend on this}

### Step-by-Step Order

1. {step 1 - typically models/entities}
2. {step 2 - typically serializers/DTOs}
3. {step 3 - typically views/controllers}
4. {step 4 - typically tests}
5. {step 5 - typically migrations}

---

## Implementation Checklist

### Phase 1: Domain Layer
- [ ] Create/modify domain entities
- [ ] Create value objects
- [ ] Define repository interfaces

### Phase 2: Infrastructure Layer
- [ ] Implement repository (infrastructure)
- [ ] Create database migrations
- [ ] Configure DI container

### Phase 3: Application Layer
- [ ] Create application services/use cases
- [ ] Implement serializers with validation

### Phase 4: API Layer
- [ ] Implement API endpoints/viewsets
- [ ] Register URL routes
- [ ] Update OpenAPI documentation

### Phase 5: Events (if applicable)
- [ ] Set up event publishing
- [ ] Set up event consumption

### Phase 6: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write API tests
- [ ] Verify query optimization (N+1 prevention)

### Phase 7: Deployment
- [ ] Verify all tests pass
- [ ] Deploy to staging
- [ ] Manual testing
- [ ] Deploy to production

---

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| {risk} | High/Medium/Low | High/Medium/Low | {mitigation} |

---

## Critical Notes

> **IMPORTANT**: Read these notes before implementing

1. **{Note Category 1}**: {detailed explanation of gotcha, security concern, or performance consideration}

2. **{Note Category 2}**: {another critical note}

3. **{Note Category 3}**: {another critical note}

---

## Deployment Notes

### Deployment Order

1. {First deployment step}
2. {Second deployment step}

### Rollback Strategy

{How to revert if deployment fails}

### Post-Deployment Verification

- [ ] {Verification step 1}
- [ ] {Verification step 2}

---

## Open Questions

{List any remaining questions or decisions needed for this microservice}
```

---

# Clarification

Ask the user questions about anything unclear, providing possible solutions in A) B) C) format:

- User scenarios
- Edge cases
- Integration requirements
- Performance needs
- Dependencies
- Implementation order preferences

**IMPORTANT:** Wait for user answers before continuing.

---

# Iterate

Evaluate the plan and iterate over it until you have the final plan with the solution.

After each iteration:
1. Update the session file
2. Update the microservice plan files as needed
3. Ask for further feedback if needed

---

## Output Summary

When complete, provide:

```
## Backend Implementation Plan Complete: {feature_name}

**Plan Files Created:**
- `docs/features/{feature_name}/backend_{ms_1}.md`
- `docs/features/{feature_name}/backend_{ms_2}.md`

**Session File:** `.claude/sessions/context_session_{feature_name}_backend.md`

### Microservices Covered

| Microservice | Technology | Plan File | Summary |
|--------------|------------|-----------|---------|
| {ms_1} | {tech} | `backend_{ms_1}.md` | {brief summary} |
| {ms_2} | {tech} | `backend_{ms_2}.md` | {brief summary} |

### Implementation Order

1. {ms_1}: {reason}
2. {ms_2}: {reason}

### Key Decisions

1. {decision_1}
2. {decision_2}

### Next Steps

1. Create feature branches in each repository
2. Follow implementation plan per microservice (each MS has its own plan file)
3. Coordinate cross-MS changes via events
4. Run integration tests
```

---

## Rules

- **DO NOT** implement code - this command produces plans only
- **DO** ask for user confirmation on microservice selection
- **DO** ask for user confirmation on agent selection
- **DO** clone repositories to analyze existing code
- **DO** invoke planner agents for detailed guidance
- **DO** create ONE implementation plan file per microservice
- **ALWAYS** validate technical specification exists before starting
- **ALWAYS** let planner agents complete their full job (don't ask for "quick" advice)
- **ALWAYS** wait for user answers during Clarification phase
- **ALWAYS** tell planner agents the exact output path for their plan: `docs/features/{feature_name}/backend_{ms_name}.md`
- **NEVER** proceed without user confirmation on microservice selection
- **NEVER** proceed without user confirmation on agent selection

### User Confirmation Checkpoints

The following phases REQUIRE user confirmation before continuing:

1. **Explore (Q1):** Microservice selection - which microservices are affected
2. **Team Selection (Q2):** Agent selection - which planning agents to invoke
3. **Clarification:** Open questions about requirements, edge cases, dependencies
