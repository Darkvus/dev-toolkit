---
name: dev-toolkit
description: Front door of the dev-toolkit plugin. Use for backend (FastAPI, DRF, Django DaaS, DDD) and frontend (React + Vite + shadcn/ui) work that must follow the team conventions: planning a feature, scaffolding, adding a CRUD resource or API endpoint, reviewing or auditing code against the conventions, writing commit messages, documenting the stack, or checking plugin health. Routes `/dev-toolkit <command>` to the right convention skills, agents and CLI checks.
version: 3.0.0
user-invocable: true
argument-hint: "[plan · scaffold · crud · api · review · commit · audit · document · doctor · context · hooks] [target]"
---

One front door for the plugin. It owns no conventions: each command loads only the existing convention skills, agents and commands it needs, so context stays small.

## Setup

Run once per session, from the user's project. `${CLAUDE_SKILL_DIR}` is the folder containing this file; the reference files write it as `<skill-dir>`:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/dev-toolkit.mjs" context
```

It prints the detected stack (FastAPI, DRF, Django DaaS, React + Vite + shadcn), layout, git state, the convention skills that apply, and directives. Follow the directives; do not rerun it. Needs Node 18+; without Node, infer the stack from `pyproject.toml` / `package.json` and skip CLI steps.

## Routing

First word of the arguments selects the command. Load its reference file and follow it; load nothing else up front.

| Command | What it does | Reference |
|---|---|---|
| `plan <feature>` | Plan a feature across DDD, API and frontend planners | [reference/plan.md](reference/plan.md) |
| `scaffold <backend\|frontend> <name>` | New service layout or new React + Vite + shadcn app | [reference/scaffold.md](reference/scaffold.md) |
| `crud <resource> <endpoint>` | Backend resource and/or frontend list + forms for it | [reference/crud.md](reference/crud.md) |
| `api <endpoint or change>` | Design or change an endpoint contract | [reference/api.md](reference/api.md) |
| `review [paths \| --changed]` | Audit a diff or paths with CLI findings plus judgment | [reference/review.md](reference/review.md) |
| `commit` | Write and check a commit message | [reference/commit.md](reference/commit.md) |
| `audit [paths]` | Whole-project convention scan, grouped and prioritised | [reference/audit.md](reference/audit.md) |
| `document` | Generate CONVENTIONS.md and `.dev-toolkit/context.json` from the built code | [reference/document.md](reference/document.md) |
| `doctor` | Check plugin files, versions and project config drift | [reference/doctor.md](reference/doctor.md) |
| `context` | Re-print the stack context | [reference/context.md](reference/context.md) |
| `hooks <on\|off\|status>` | Control the post-edit convention hook | [reference/hooks.md](reference/hooks.md) |

Unknown first word: treat the whole input as a feature description and route to `plan`.

## No arguments: menu

Print a short menu from the `context` output only (no file reads), for example:

```
dev-toolkit  ·  detected: fastapi (DDD) + react-vite (shadcn)  ·  branch feat/x, 3 uncommitted
  plan <feature>      scaffold <backend|frontend> <name>   crud <resource> <endpoint>
  api <endpoint>      review --changed (3 files)           commit
  audit               document (no context.json yet)       doctor   hooks status
```

Show only commands that make sense: no `scaffold frontend` when a shadcn app exists, `review --changed` only when the tree is dirty, `document` first when `.dev-toolkit/context.json` is missing. Then ask which one.

## Rules

1. Convention skills (`backend-*`, `frontend-*`) are loaded by name, on demand, for the files being touched. Never paste their content into plans or answers.
2. Existing slash commands (`/explore-plan`, `/scaffold-frontend`, `/add-crud-page`, and the rest) keep working unchanged; the references call them.
3. Updates are PATCH, money is integer cents, distance meters, duration seconds, datetimes UTC (see the skills). Finish any code change with `node "${CLAUDE_SKILL_DIR}/scripts/dev-toolkit.mjs" detect <changed paths>` and fix what it reports.
4. Agents (`dev-toolkit-reviewer`, `dev-toolkit-documenter`, the planners) are launched with the Agent tool using exactly the names in the reference files.
