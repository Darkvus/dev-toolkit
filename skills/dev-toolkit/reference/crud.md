# crud

Arguments: `<resource> <endpoint>` (e.g. `vehicle /api/v1/vehicles`). Add `--plan <file>` to reuse a `frontend-planner` plan.

1. Backend does not have the resource yet: plan first (`/dev-toolkit plan`), then load the stack skill from `context` (`backend-fastapi` or `backend-django-drf`), plus `backend-api-design`, `backend-url-query-params`, `backend-units-of-measurement`, `backend-permission-management`. Updates are PATCH.
2. Frontend: run `/add-crud-page <resource> <endpoint> [--plan ...]`. It loads the eight frontend skills and builds schemas, API hooks, server-side table, forms, route and tests.
3. Finish with `detect --changed`; fix findings before reporting done.
