# dev-toolkit

A [Claude Code](https://claude.com/claude-code) plugin with agents, commands, and skills for full-stack development:

- **Backend**: Python services with Domain-Driven Design architecture, FastAPI, Django REST Framework, and microservice conventions.
- **Frontend**: React + Vite apps built with [shadcn/ui](https://ui.shadcn.com/), Tailwind CSS v4, TanStack Query/Table, React Hook Form + Zod, and Vitest.

The frontend conventions are designed to consume the backend ones: the same error envelope, query parameter names, units of measurement, and PATCH-only partial updates.

> Formerly `backend-toolkit`. See [INSTALL.md](INSTALL.md#migrating-from-backend-toolkit) to migrate.

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

Convention references that Claude loads automatically when relevant.

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

1. `/explore-plan <feature>` → `ddd-planner` → `fastapi-planner` / `djangorestframework-planner` → `frontend-planner`
2. `planner-orchestrator` consolidates the plans into task lists
3. `/scaffold-frontend <app>` once per frontend app
4. `/add-crud-page <resource> <endpoint> --plan docs/features/<feature>/frontend.md` per screen

## Installation

See [INSTALL.md](INSTALL.md).

## License

No license specified.
