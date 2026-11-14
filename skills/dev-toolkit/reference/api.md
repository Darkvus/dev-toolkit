# api

Design or change an endpoint contract.

1. Load `backend-api-design` (error envelope, status codes, naming), `backend-url-query-params` (limit/offset, ordering, `from_`/`to_`, plurals), `backend-units-of-measurement` and `backend-encoding` (cents, meters, seconds, UTC, ISO codes).
2. Framework specifics: `backend-fastapi` or `backend-django-drf` (from `context`); permissions: `backend-permission-management`.
3. Output: method + path, request/response schemas, query params, errors, permission, unit fields. Partial updates are PATCH with only changed fields.
4. If a frontend consumes it, note the Zod schema and query keys it implies (`frontend-data-fetching`) instead of writing them.
5. After implementing, run `detect` on the changed backend files.
