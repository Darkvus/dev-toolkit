---
argument-hint: <resource> <endpoint> [--plan docs/features/<feature>/frontend.md]
description: Add a list + create/edit/delete UI for a backend resource (schemas, API hooks, server-side table, forms, route and tests)
---

# Add CRUD Page

## Input

`$ARGUMENTS`: the resource name (singular, kebab-case, e.g. `vehicle`), the collection endpoint (e.g. `/api/v1/vehicles`) and, optionally, a frontend plan created by the `frontend-planner` agent.

Load these skills before writing code: `frontend-directory-structure`, `frontend-shadcn-ui`, `frontend-data-fetching`, `frontend-forms`, `frontend-data-tables`, `frontend-units-and-formatting`, `frontend-accessibility`, `frontend-testing`.

---

## Phase 1: Discover the contract

Find the resource's contract, in this order of preference:

1. The frontend plan passed with `--plan` (API Usage, Schemas, Forms and Tables sections).
2. The backend's OpenAPI document (FastAPI: `GET {VITE_API_URL}/openapi.json`; DRF: drf-spectacular's schema endpoint) if the backend is running.
3. The backend plan in `docs/features/*/fastapi.md` or `drf.md`, or the backend code (routers/viewsets, Pydantic schemas/serializers, filter classes).

Extract: fields and types (with units), required fields and limits, the list filters and their names, sorting fields, pagination style, which fields are editable, and whether delete exists.

If something essential is missing (for example, the list filters), ask the user with options A) B) C) before continuing. Never invent fields.

## Phase 2: Plan

Show the user a short plan and wait for confirmation:

- Route: `/{resources}` (+ `/{resources}/:id` if a detail page is needed)
- Columns, sortable columns and filters (→ query params)
- Create and edit form fields (form type → API type, conversions)
- shadcn components to add

## Phase 3: Implement

Follow the skills' reference implementation (the `vehicles` example) for each file:

| File | Skill |
| --- | --- |
| `src/features/{resources}/schemas/{resource}.ts`: API schema, form schema, filters type | `frontend-data-fetching`, `frontend-forms` |
| `src/features/{resources}/api/{resources}.ts`: key factory, list/detail queries, create/update (PATCH)/delete mutations | `frontend-data-fetching` |
| `src/features/{resources}/components/{resources}-table.tsx`: server-side table | `frontend-data-tables` |
| `src/features/{resources}/components/{resource}-form.tsx`: create/edit form with backend error mapping | `frontend-forms` |
| `src/features/{resources}/pages/{resources}-page.tsx`: URL state, filters, create dialog, delete confirmation | `frontend-data-tables`, `frontend-shadcn-ui` |
| `src/app/router.tsx`: lazy route | `frontend-directory-structure` |

Add any missing shadcn components with `npx shadcn@latest add ... -y`.

## Phase 4: Tests

Write tests with MSW handlers that use the real backend shapes:

- The form sends converted units and only changed fields on edit (PATCH).
- A backend 400 shows the message under the matching field.
- The page sends `limit`/`offset`/`ordering`/filters from the URL and renders loading, empty and error states.

## Phase 5: Verify

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

All must pass. Fix failures before reporting.

## Phase 6: Report

```markdown
## CRUD page added: {resources}

- Route: /{resources}
- Files created: {list}
- Backend contract assumptions: {list, or "none"}
- Checks: typecheck ✅ lint ✅ tests ✅ build ✅
```

## Rules

- **NEVER** call `fetch` from components; always go through the feature's API hooks.
- **NEVER** use PUT; updates are PATCH with changed fields only.
- **NEVER** paginate or sort a backend collection on the client.
- **ALWAYS** keep backend field names and units in schemas; convert only for display and input.
- **ALWAYS** handle loading, empty and error states.
