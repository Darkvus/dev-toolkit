---
argument-hint: <feature-name>
description: Create GitHub issues in each affected microservice repository from per-microservice implementation plans
---

# SDD Level 4 Create GitHub Issues from Backend Implementation Plans

## Input

Issue key: `$ARGUMENTS`

This command reads the per-microservice implementation plans created by `start-working-on-technical-plan.md` and creates individual GitHub issues in each affected microservice repository.

---

## Step 0: Validate Plan Files Structure

### 0.1 Check for Default Path Files (Error Detection)

First, check if any agent wrote to default paths instead of microservice-specific paths. This indicates an error in the planning process:

```bash
# Check for default path files that should NOT exist
ls -la docs/features/{feature_name}/backend.md      # Should NOT exist (ddd-planner default)
ls -la docs/features/{feature_name}/drf.md          # Should NOT exist (djangorestframework-planner default)
ls -la docs/features/{feature_name}/daas.md         # Should NOT exist (daas-planner default)
ls -la docs/features/{feature_name}/fastapi.md      # Should NOT exist (fastapi-planner default)
```

**If any default path file exists:**

1. **Read and analyze its content** to determine which microservice it was meant for
2. **Warn the user:**

```markdown
⚠️ **Warning: Default Path Files Detected**

The following files were created with default paths instead of microservice-specific paths:

| File | Expected Path | Content Summary |
|------|---------------|-----------------|
| `backend.md` | Should be `backend_{ms_name}.md` | {summary of content} |
| `drf.md` | Should be `backend_{ms_name}.md` | {summary of content} |

**Options:**
- A) I'll incorporate the content from these files into the corresponding microservice issues
- B) Re-run the planning command to fix the output paths
- C) Manually rename the files and continue
```

**WAIT for user decision before continuing.**

### 0.2 List Available Microservice Plans

```bash
# List all microservice-specific plan files
ls -la docs/features/{feature_name}/backend_*.md
```

This should show files like:
- `docs/features/{feature_name}/backend_users-ms.md`
- `docs/features/{feature_name}/backend_orders-ms.md`
- etc.

---

## Step 1: Read Implementation Plans

### 1.1 Read Context Files

**Session context:**
- `.claude/sessions/context_session_{feature_name}_backend.md`

**Technical specification (for additional context):**
- `docs/features/{feature_name}/technical_specification.md`

### 1.2 Read Per-Microservice Plans

For each `backend_{ms_name}.md` file found in `docs/features/{feature_name}/`:

Read and extract:
- Microservice name (from filename and header)
- Repository name
- Technology stack
- Tipology (BaaS, DaaS, Worker)
- Role in feature
- Domain changes (new/modified entities)
- Files to create/modify
- API endpoints
- Database migrations
- Events (publish/consume)
- Testing requirements
- External dependencies (API calls to other microservices)
- Implementation order/phase

### 1.3 Also Check Default Path Files (if user chose option A)

If default path files exist and user chose to incorporate them:
- Read each default path file
- Identify which microservice it corresponds to
- Merge the content with the microservice-specific plan or use it if no specific plan exists

---

## Step 2: Parse Per-Microservice Plan Files

**Token note:** Steps 2-5 read a full implementation plan, draft an issue body from it, and push it to GitHub — all of that content only matters for one microservice at a time and doesn't need to stay in the main conversation afterward. For features with more than 2 microservices, run Steps 2-5 for each microservice as a separate general-purpose subagent call (pass it the plan file path and the templates below) and have it report back only the created issue URL + a one-line summary. Do Steps 2-5 inline only when there are 1-2 microservices.

For each `backend_{ms_name}.md` file found in Step 0.2, extract:

```markdown
### {Microservice Name}

**Repository:** `company/{repo_name}`
**Technology:** {Django/FastAPI}
**Tipology:** {BaaS/DaaS/Worker}

#### Domain Changes
{content}

#### Files to Create
{table}

#### Files to Modify
{table}

#### API Endpoints
{table}

#### Database Migrations
{content}

#### Events
{content}

#### Testing
{content}
```

Build a structured list of all microservices with their implementation details.

---

## Step 3: Draft Issues

For each microservice, create an issue draft with this structure:

### Title Format
`✨ feat({feature_name}): {brief_description} - {microservice_name}`

### Issue Body Structure

```markdown
## Context

This issue is part of the implementation for **{feature_name}**.

**Overall Feature:** {title from technical specification}
**This Microservice's Role:** {role from plan summary}

### Reference Documents
- Technical Specification: `docs/features/{feature_name}/technical_specification.md`
- Implementation Plan: `docs/features/{feature_name}/backend_{ms_name}.md`
- Jira Issue: https://company.atlassian.net/browse/{feature_name}

---

## Quick Summary

### Key Changes Required

1. **{Change Category 1}:** {brief description}
2. **{Change Category 2}:** {brief description}
3. **{Change Category 3}:** {brief description}

### Files Overview

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | {path} | {purpose} |
| MODIFY | {path} | {changes} |

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| {method} | {path} | {purpose} |

---

## Dependencies

- **Blocked by:** {list issues in other repos that must be completed first, or "None"}
- **Blocks:** {list issues in other repos that depend on this, or "None"}
- **Implementation Phase:** {phase number from Implementation Order}

---

## Full Implementation Plan

> ⚠️ **CRITICAL**: The COMPLETE implementation plan is posted in the comments below.
> Each section of the plan is in a separate comment for easy navigation.
> Follow the plan EXACTLY. Do NOT summarize or skip any details.

**Plan size:** {plan_chars} characters
**Sections:** {number_of_sections} comments below
**Source File:** `.claude/doc/{feature_name}/backend_{ms_name}.md`

### Plan Index

| # | Section | Characters |
|---|---------|------------|
| 1 | {section_1_title} | {section_1_chars} |
| 2 | {section_2_title} | {section_2_chars} |
| 3 | {section_3_title} | {section_3_chars} |
| ... | ... | ... |

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
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Write API tests
- [ ] Verify query optimization (N+1 prevention)

### Phase 7: Verification
- [ ] All tests pass
- [ ] Code review approved
- [ ] CI/CD passes
- [ ] Manual testing complete

---

## Definition of Done

- [ ] All implementation checklist items completed
- [ ] All tests passing with required coverage
- [ ] API documentation updated (OpenAPI/Swagger)
- [ ] Database migrations tested and reversible
- [ ] No security vulnerabilities introduced
- [ ] Performance requirements met
- [ ] Ready for deployment

---

## Deployment Notes

- **Phase:** {position in implementation order}
- **Backward compatibility:** {any breaking changes?}
- **Rollback strategy:** {how to revert}
- **Post-deployment verification:** {what to check after deploy}
```

---

## Step 4: Review All Issues

Present ALL issue drafts and ask for approval:

```markdown
## Issue Drafts Ready for {feature_name}

I've prepared **{N} issues** for the following repositories:

| # | Repository | Microservice | Phase | Dependencies |
|---|------------|--------------|-------|--------------|
| 1 | company/{repo1} | {ms1} | 1 | None |
| 2 | company/{repo2} | {ms2} | 2 | Depends on #1 |
| 3 | company/{repo3} | {ms3} | 2 | Depends on #1 |
| 4 | company/{repo4} | {ms4} | 3 | Depends on #2, #3 |

### Implementation Order

```
Phase 1: {repo1}
    ↓
Phase 2: {repo2} ──┬── {repo3}  [parallel]
                   │
Phase 3:          {repo4}
```

### Questions

**Are these issues ready to create?**
- A) Yes, create all issues
- B) Modify specific issues: {specify}
- C) Skip some microservices: {specify}
- D) Add labels or assignees first
```

**WAIT for user approval before creating issues.**

---

## Step 5: Create Issues

After approval, for each microservice:

### 5.1 Verify Repository Exists

```bash
gh repo view company/{repo_name} --json name
```

If repository doesn't exist, notify user and skip.

### 5.2 Read and Parse Plan Content

**MANDATORY FIRST STEP**: Read the COMPLETE plan file and parse it into sections.

```bash
# Count characters in the plan file
wc -c .claude/doc/{feature_name}/backend_{ms_name}.md
```

**Store:**
- `plan_content`: The COMPLETE, UNMODIFIED content of `backend_{ms_name}.md`
- `plan_chars`: Character count from wc -c
- `sections`: Array of sections split by `## ` headers

**Parse the plan into sections:**
```
sections = split plan_content by "## " headers
Each section = {
  title: the header text (e.g., "Summary", "Architecture", "Implementation Details")
  content: everything from this ## to the next ## (or end of file)
  chars: character count of this section
}
```

**CRITICAL PROHIBITION**:
- ❌ DO NOT summarize ANY section under ANY circumstances
- ❌ DO NOT paraphrase, condense, or abbreviate ANY section
- ❌ DO NOT replace code blocks with descriptions
- ❌ DO NOT omit "less important" sections
- ✅ DO use the EXACT text from the file, character for character
- ✅ DO preserve ALL sections, even small ones

### 5.3 Strategy: One Comment Per Section (ALWAYS)

**This command ALWAYS uses the "one comment per section" strategy.**

This approach guarantees:
- ✅ NO information loss (each section posted independently)
- ✅ NO summarization (sections posted exactly as written)
- ✅ Easy navigation (each section is a separate comment)
- ✅ No size limits issues (comments are small and focused)

**Structure:**
```
Issue Body:
  - Context
  - Quick Summary (extracted key points)
  - Dependencies
  - Plan Index (list of sections with comment links)
  - Implementation Checklist
  - Definition of Done
  - Deployment Notes

Comments (one per section):
  - Comment 1: ## Overview/Summary
  - Comment 2: ## Architecture
  - Comment 3: ## Implementation Details
  - Comment 4: ## API Endpoints
  - Comment 5: ## Database Migrations
  - Comment 6: ## Testing
  - Comment 7: ## Implementation Checklist (from plan)
  - ... (one comment for each ## section in the plan)
```

### 5.4 Create Issue Body

```markdown
## Context

This issue is part of the implementation for **{feature_name}**.

**Overall Feature:** {title from technical specification}
**This Microservice's Role:** {role from plan summary}

### Reference Documents
- Technical Specification: `.claude/doc/{feature_name}/technical_specification.md`
- Implementation Plan: `.claude/doc/{feature_name}/backend_{ms_name}.md`
- Jira Issue: https://company.atlassian.net/browse/{feature_name}

---

## Quick Summary

### Key Changes Required

1. **{Change Category 1}:** {brief description}
2. **{Change Category 2}:** {brief description}
3. **{Change Category 3}:** {brief description}

### Files Overview

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | {path} | {purpose} |
| MODIFY | {path} | {changes} |

---

## Dependencies

- **Blocked by:** {list issues in other repos that must be completed first, or "None"}
- **Blocks:** {list issues in other repos that depend on this, or "None"}
- **Implementation Phase:** {phase number from Implementation Order}

---

## Full Implementation Plan

> ⚠️ **CRITICAL**: The COMPLETE implementation plan is posted in the comments below.
> Each section of the plan is in a separate comment for easy navigation.
> Follow the plan EXACTLY. Do NOT summarize or skip any details.

**Plan size:** {plan_chars} characters
**Sections:** {number_of_sections} comments below
**Source File:** `.claude/doc/{feature_name}/backend_{ms_name}.md`

### Plan Index

| # | Section | Characters |
|---|---------|------------|
| 1 | {section_1_title} | {section_1_chars} |
| 2 | {section_2_title} | {section_2_chars} |
| 3 | {section_3_title} | {section_3_chars} |
| ... | ... | ... |

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
- [ ] Write unit tests (>80% coverage)
- [ ] Write integration tests
- [ ] Write API tests
- [ ] Verify query optimization (N+1 prevention)

### Phase 7: Verification
- [ ] All tests pass
- [ ] Code review approved
- [ ] CI/CD passes
- [ ] Manual testing complete

---

## Definition of Done

- [ ] All implementation checklist items completed
- [ ] All tests passing with required coverage
- [ ] API documentation updated (OpenAPI/Swagger)
- [ ] Database migrations tested and reversible
- [ ] No security vulnerabilities introduced
- [ ] Performance requirements met
- [ ] Ready for deployment

---

## Deployment Notes

- **Phase:** {position in implementation order}
- **Backward compatibility:** {any breaking changes?}
- **Rollback strategy:** {how to revert}
- **Post-deployment verification:** {what to check after deploy}
```

### 5.5 Create the Issue

```bash
gh issue create \
  --repo company/{repo_name} \
  --title "✨ feat({feature_name}): {brief_description} - {microservice_name}" \
  --body "$(cat <<'EOF'
{issue_body_from_5.4}
EOF
)" \
  --label "feature,{feature_name}"
```

**Capture the issue number from the output.**

### 5.6 Add Plan Sections as Comments (MANDATORY)

**IMMEDIATELY after creating the issue**, add ONE COMMENT PER SECTION:

```bash
# For each section in the plan file (split by ## headers):

# Comment 1: First section (usually Overview/Summary)
gh issue comment {issue_number} --repo company/{repo_name} --body "$(cat <<'EOF'
## 📋 Plan Section 1/{total_sections}: {section_title}

---

{EXACT CONTENT OF THIS SECTION - NO MODIFICATIONS}
EOF
)"

# Comment 2: Second section
gh issue comment {issue_number} --repo company/{repo_name} --body "$(cat <<'EOF'
## 📋 Plan Section 2/{total_sections}: {section_title}

---

{EXACT CONTENT OF THIS SECTION - NO MODIFICATIONS}
EOF
)"

# Continue for ALL sections...

# Comment N: Last section
gh issue comment {issue_number} --repo company/{repo_name} --body "$(cat <<'EOF'
## 📋 Plan Section {N}/{total_sections}: {section_title}

---

{EXACT CONTENT OF THIS SECTION - NO MODIFICATIONS}
EOF
)"
```

**Section Parsing Rules:**
1. Split the plan file by `## ` (level 2 headers)
2. Each split becomes one comment
3. The header text becomes the section title
4. Everything until the next `## ` (or EOF) is the section content
5. Preserve ALL formatting, code blocks, tables, etc.
6. Include the `## ` header in the comment content

**Example:** If plan has these sections:
```markdown
# Backend Plan: configuration-daas    <- Part of first section (no ##)

## Overview                           <- Section 1
{content}

## Architecture                       <- Section 2
{content}

## Implementation Details             <- Section 3
{content}

## Testing                           <- Section 4
{content}
```

Then create 4 comments:
1. "Plan Section 1/4: Overview" (includes the # header as preamble)
2. "Plan Section 2/4: Architecture"
3. "Plan Section 3/4: Implementation Details"
4. "Plan Section 4/4: Testing"

### 5.7 Verify All Sections Were Posted

**MANDATORY VERIFICATION**: After posting all comments:

1. Count total sections in original plan
2. Count comments created
3. Sum character counts of all comments
4. Compare with original `plan_chars`

```bash
# List comments to verify
gh issue view {issue_number} --repo company/{repo_name} --json comments --template '{{len .comments}} comments'
```

**If section count doesn't match or chars differ by >5%:**

```markdown
⚠️ **Verification Warning**

Plan sections: {original_section_count}
Comments created: {comment_count}
Plan file size: {plan_chars} characters
Total posted: {posted_chars} characters
Difference: {diff} characters ({percentage}%)

This may indicate content was accidentally omitted. Please verify:
1. Check each comment in the issue
2. Compare against source file: `.claude/doc/{feature_name}/backend_{ms_name}.md`
```

### 5.8 Capture Issue Details

Store the issue number, URL, and comment count for linking.

---

## Step 6: Link Issues

After all issues are created, add cross-reference comments:

```bash
gh issue comment {issue_number} --repo company/{repo_name} --body "$(cat <<'EOF'
## 🔗 Related Issues for {feature_name}

### Dependencies
- Depends on: company/{other_repo}#{number}

### Blocks
- Blocks: company/{another_repo}#{number}

### All Issues in This Feature
| Repository | Issue | Phase |
|------------|-------|-------|
| company/{repo1} | #{num1} | 1 |
| company/{repo2} | #{num2} | 2 |
EOF
)"
```

---

## Step 7: Update Session File

Update `.claude/sessions/context_session_{feature_name}_backend.md` with:

```markdown
## GitHub Issues Created

| Microservice | Repository | Issue | URL | Phase |
|--------------|------------|-------|-----|-------|
| {ms1} | company/{repo1} | #{num1} | {url1} | 1 |
| {ms2} | company/{repo2} | #{num2} | {url2} | 2 |

### Issue Dependencies
- #{num1} → #{num2} (must complete first)
- #{num2}, #{num3} can run in parallel
- #{num4} depends on #{num2} and #{num3}
```

---

## Step 8: Summary Report

Present final summary:

```markdown
## ✅ Issues Created for {feature_name}

### Summary

| Microservice | Repository | Issue | URL | Status |
|--------------|------------|-------|-----|--------|
| {ms1} | company/{repo1} | #{num1} | {url1} | ✅ Created |
| {ms2} | company/{repo2} | #{num2} | {url2} | ✅ Created |

### Implementation Order

```
Phase 1: company/{repo1}#{num1}
    ↓
Phase 2: company/{repo2}#{num2} + company/{repo3}#{num3}
    ↓
Phase 3: company/{repo4}#{num4}
```

### Cross-References Added
- All issues linked with dependencies
- Feature label `{feature_name}` applied to all

### Next Steps

1. **Assign team members** to each issue
2. **Add to project board** for tracking
3. **Start Phase 1** implementation in {repo1}
4. **Coordinate** Phase 2 parallel work

### Reference Documents

- Technical Specification: `docs/features/{feature_name}/technical_specification.md`
- Implementation Plans: `docs/features/{feature_name}/backend_*.md` (one per microservice)
- Session File: `.claude/sessions/context_session_{feature_name}_backend.md`
- Jira Issue: https://company.atlassian.net/browse/{feature_name}
```

---

## Rules

### 🚨 CRITICAL: Full Plan Inclusion (ZERO TOLERANCE)

**This is the most important rule. Violations are unacceptable.**

```
┌─────────────────────────────────────────────────────────────────┐
│  THE IMPLEMENTATION PLAN MUST BE INCLUDED EXACTLY AS WRITTEN   │
│                                                                 │
│  ❌ NEVER summarize ANY section                                 │
│  ❌ NEVER paraphrase                                            │
│  ❌ NEVER condense                                              │
│  ❌ NEVER abbreviate                                            │
│  ❌ NEVER omit sections (even small ones)                       │
│  ❌ NEVER replace code with descriptions                        │
│  ❌ NEVER say "see file for details"                            │
│  ❌ NEVER merge sections together                               │
│                                                                 │
│  ✅ ALWAYS split plan by ## headers                             │
│  ✅ ALWAYS create ONE comment PER SECTION                       │
│  ✅ ALWAYS use the EXACT text from backend_{ms_name}.md         │
│  ✅ ALWAYS measure character count before and after             │
│  ✅ ALWAYS verify all sections were posted                      │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- The implementation plan contains specific code, file paths, and business logic
- A summary loses critical implementation details
- Developers need the EXACT plan to implement correctly
- The plan was carefully crafted - every word matters
- Splitting by sections ensures NO information can be lost

**Content Strategy: One Comment Per Section (ALWAYS)**

This command ALWAYS uses the "one comment per section" strategy:

1. **Parse plan** by `## ` headers into sections
2. **Create issue** with summary, index, and checklists
3. **Add one comment** for EACH section (exact content, no modifications)
4. **Verify** section count and total characters match

**Benefits:**
- ✅ NO information loss (each section posted independently)
- ✅ NO summarization possible (sections are atomic units)
- ✅ Easy navigation (each section is a separate comment)
- ✅ No size limits issues (comments are small and focused)
- ✅ Verifiable (count sections = count comments)

**Verification Requirement:**
- ALWAYS count sections in original plan
- ALWAYS count comments created
- ALWAYS verify total characters match (±5%)
- If discrepancy, STOP and alert user

### Issue Creation

- **DO** verify repository exists before creating issues
- **DO** wait for user approval before creating any issues
- **DO** include cross-references between related issues
- **DO** respect implementation order and dependencies
- **DO** use consistent labeling across all issues
- **DO** update the session file with created issues
- **DO** check for default path files (error detection) before proceeding
- **DO** use `wc -c` to measure plan file size
- **DO** parse plan into sections by `## ` headers
- **DO** create ONE comment for EACH section (no exceptions)
- **DO** include Plan Index table in issue body
- **DO** verify section count matches comment count
- **ALWAYS** read from per-microservice plan files: `backend_{ms_name}.md`
- **ALWAYS** warn user if default path files are found (indicates planning error)
- **ALWAYS** add comments IMMEDIATELY after issue creation
- **NEVER** create issues without user approval
- **NEVER** skip linking dependent issues
- **NEVER** summarize ANY section (see CRITICAL section above)
- **NEVER** merge multiple sections into one comment
- **NEVER** omit sections, even small or "unimportant" ones
- **IF** default path files exist, incorporate their content after user approval
- **IF** a repository doesn't exist, notify user and skip it

### GitHub CLI Commands Reference

```bash
# Verify repo exists
gh repo view company/{repo} --json name

# Create issue
gh issue create --repo company/{repo} --title "title" --body "body" --label "label1,label2"

# Add comment
gh issue comment {number} --repo company/{repo} --body "comment"

# View created issue
gh issue view {number} --repo company/{repo} --web
```
