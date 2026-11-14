# dev-toolkit

A [Claude Code](https://claude.com/claude-code) plugin with agents, commands, and skills for full-stack development:

- **Backend**: Python services with Domain-Driven Design architecture, FastAPI, Django REST Framework, and microservice conventions.
- **Frontend**: React + Vite apps built with [shadcn/ui](https://ui.shadcn.com/), Tailwind CSS v4, TanStack Query/Table, React Hook Form + Zod, and Vitest.

The frontend conventions are designed to consume the backend ones: the same error envelope, query parameter names, units of measurement, and PATCH-only partial updates.

> Formerly `backend-toolkit`. See [INSTALL.md](INSTALL.md#migrating-from-backend-toolkit) to migrate.

## Front door: `/dev-toolkit`

Since 3.0 there is one entry point. `/dev-toolkit` with no arguments detects your stack (FastAPI, DRF, Django DaaS, React + Vite + shadcn) and prints a menu; `/dev-toolkit <command>` routes to a short reference file that loads only the convention skills, agents and commands that command needs. Nothing was removed: every skill, agent and slash command below still works on its own.

| Command | What it does |
|---|---|
| `/dev-toolkit plan <feature>` | Plan across DDD, API and frontend planners, then consolidate |
| `/dev-toolkit scaffold <backend\|frontend> <name>` | New service layout or React + Vite + shadcn app |
| `/dev-toolkit crud <resource> <endpoint>` | Backend resource and/or frontend list + forms |
| `/dev-toolkit api <endpoint>` | Design or change an endpoint contract |
| `/dev-toolkit review [paths \| --changed]` | `dev-toolkit-reviewer` agent: CLI findings plus judgment, ordered fix list |
| `/dev-toolkit commit` | Write a commit message and check it (gitmoji + conventional + `Refs:`) |
| `/dev-toolkit audit [paths]` | Whole-project convention scan, grouped and prioritised |
| `/dev-toolkit document` | `dev-toolkit-documenter` agent: `CONVENTIONS.md` and `.dev-toolkit/context.json` from the built code |
| `/dev-toolkit doctor` | Plugin files, versions and project config drift |
| `/dev-toolkit context` | Detected stack, layout, git state, applicable conventions |
| `/dev-toolkit hooks <on\|off\|status>` | Control the post-edit convention hook |

### CLI

The checker is a zero-dependency Node 18+ script (`skills/dev-toolkit/scripts/dev-toolkit.mjs`). Use it directly in CI or a terminal:

```bash
node skills/dev-toolkit/scripts/dev-toolkit.mjs context                  # stack, layout, git, directives
node skills/dev-toolkit/scripts/dev-toolkit.mjs detect src/ --json       # findings with file:line and severity
node skills/dev-toolkit/scripts/dev-toolkit.mjs detect --changed         # only files changed vs HEAD
node skills/dev-toolkit/scripts/dev-toolkit.mjs detect --list-rules
node skills/dev-toolkit/scripts/dev-toolkit.mjs commit-msg -m "feat(api): add x"
node skills/dev-toolkit/scripts/dev-toolkit.mjs doctor
```

`detect` exits 1 on errors (`--fail-on warn|never` to change). Rules come from the skills: PATCH-only updates, integer cents/meters/seconds, UTC datetimes, DDD dependency direction, error envelope, `limit`/`offset`/`ordering`/`from_`/`to_` query params, single typed API client, `Intl` formatting helpers, vendored `components/ui`, theme tokens, accessibility labels, commit format. Run the tests with `node --test`.

### Hook

A `PostToolUse` hook on `Edit|Write` runs the detector on the changed file and adds a few lines to the agent's context when it finds violations. It never blocks an edit, checks one file, and is silent when clean. Opt out per project with `.dev-toolkit/config.json` (`"hooks": "off"`, `ignoreRules`, `ignoreFiles`) or `/dev-toolkit hooks off`. Suppress one finding with `# dev-toolkit-ignore <rule>` (or `//`).

## What's included

### Agents

Planning agents that translate architecture and requirements into stack-specific implementation plans.

| Agent | Purpose |
|---|---|
| `ddd-planner` | Design or refactor backend architecture using DDD layered architecture (domain, application, infrastructure). |
| `fastapi-planner` | Translate DDD architecture into FastAPI implementation plans (routers, dependency injection, repositories). |
| `djangorestframework-planner` | Translate DDD architecture into Django REST Framework implementation plans with Clean Architecture layering. |
| `daas-planner` | Translate DDD architecture into Django-based Data as a Service (DaaS) implementation plans. |
| `frontend-planner` | Translate features and backend API plans into React + Vite + shadcn/ui plans (routes, components, API hooks, forms, tables, tests). |
| `planner-orchestrator` | Consolidate stack-specific plans into actionable engineering tasks and release readiness reports. |
| `dev-toolkit-reviewer` | Audit a diff or paths against the conventions (CLI findings plus judgment); returns an ordered fix list. |
| `dev-toolkit-documenter` | Generate `CONVENTIONS.md` and `.dev-toolkit/context.json` from the built code. |

> **Other tools:** this toolkit also works with [OpenCode](https://opencode.ai) (`scripts/install-opencode.sh`) and [Codex CLI](https://developers.openai.com/codex) (`scripts/install-codex.sh`). See [INSTALL.md](INSTALL.md).

### Commands

Slash commands for common workflows.

| Command | Purpose |
|---|---|
| `/explore-plan` | Explore, select a team/agent, plan, and iterate on a user request. |
| `/start-working-on-technical-plan` | Turn a Technical Specification into a consolidated implementation plan across microservices (and frontend). |
| `/technical-plan` | Generate a technical plan, always in Spanish, from a specification (file path or pasted text). |
| `/create-issues-from-plan` | Create GitHub issues in each affected microservice repository from per-microservice plans. |
| `/create-new-gh-issue` | Create a new GitHub issue for a feature from a context session file. |
| `/start-working-on-issue` | Implement a GitHub issue created by `create-issues-from-plan`. |
| `/update-docstrings` | Replace legacy header docstrings with descriptive module documentation. |
| `/update-permissions` | Synchronize the permissions definition YAML into a microservice. |
| `/scaffold-frontend` | Create a new React + Vite + shadcn/ui app with our structure, data layer, theming and test setup, verified end to end. |
| `/add-crud-page` | Add a list + create/edit/delete UI for a backend resource: schemas, API hooks, server-side table, forms, route and tests. |

### Skills

`dev-toolkit` is the orchestrator skill described above. The rest are convention references that Claude loads automatically when relevant.

#### Backend

| Skill | Purpose |
|---|---|
| `backend-api-design` | REST API conventions: error format, status codes, naming, versioning. |
| `backend-chassis-pattern` | Shared infrastructure and cross-cutting concerns for microservices. |
| `backend-commits` | Git commit message format, types, and scoping rules. |
| `backend-dependency-management` | Version pinning, update strategy, and approval process. |
| `backend-django-drf` | DRF ViewSet, serializer, `@action`, and permission class conventions. |
| `backend-encoding` | Country, language, currency, timezone, and coordinate formats. |
| `backend-fastapi` | FastAPI router, dependency injection, and Pydantic schema conventions. |
| `backend-microservices-baas-daas` | BaaS vs. DaaS microservice types and when to use each. |
| `backend-microservices-directory-structure` | Mandatory DDD directory layout and naming conventions. |
| `backend-permission-management` | RBAC pattern, permission checking, and FastAPI/DRF integration. |
| `backend-units-of-measurement` | Standard units: meters, cents, seconds, UTC datetime. |
| `backend-url-query-params` | Query parameter, pagination, sorting, and filtering conventions. |

#### Frontend

| Skill | Purpose |
|---|---|
| `frontend-shadcn-ui` | Project init, adding/updating components with the shadcn CLI, ownership of `components/ui`, composition and variants. |
| `frontend-theming` | Semantic CSS variable tokens, adding custom tokens, dark mode in Vite, radius and fonts. |
| `frontend-directory-structure` | Feature-based layout mirroring backend bounded contexts, naming, import boundaries, routing, env vars. |
| `frontend-data-fetching` | Typed HTTP client, backend error envelope, Zod-validated responses, TanStack Query keys/queries/mutations, PATCH. |
| `frontend-forms` | React Hook Form + Zod + shadcn `Field`, mapping backend 400 errors to fields, dirty-field PATCH. |
| `frontend-data-tables` | Server-side TanStack Table v9 with URL state mapped to backend query params. |
| `frontend-units-and-formatting` | Cents, meters, seconds and UTC: `Intl` formatting and conversion helpers. |
| `frontend-accessibility` | WCAG 2.2 AA checklist for composing shadcn/ui components. |
| `frontend-testing` | Vitest + Testing Library + MSW setup and what to test. |

The frontend skills cover **team conventions**. For the shadcn/ui component catalog and CLI reference, `/scaffold-frontend` can also install the official tooling (`npx skills add shadcn/ui` and the shadcn MCP server).

## Typical flow

Shortcut: `/dev-toolkit plan <feature>`, then `/dev-toolkit crud <resource> <endpoint>`, then `/dev-toolkit review --changed`. Spelled out:

1. `/explore-plan <feature>` → `ddd-planner` → `fastapi-planner` / `djangorestframework-planner` → `frontend-planner`
2. `planner-orchestrator` consolidates the plans into task lists
3. `/scaffold-frontend <app>` once per frontend app
4. `/add-crud-page <resource> <endpoint> --plan docs/features/<feature>/frontend.md` per screen

## Installation

See [INSTALL.md](INSTALL.md).

## License

No license specified.
