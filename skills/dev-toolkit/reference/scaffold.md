# scaffold

Argument: `frontend <app-name>` or `backend <service-name>`. If missing, ask.

## frontend
Run `/scaffold-frontend <app-name>` (it loads `frontend-directory-structure`, `frontend-shadcn-ui`, `frontend-data-fetching`, `frontend-testing` and verifies the app end to end). Skip when `context` already shows a shadcn app at that path.

## backend
No generator exists; build the skeleton from the skills, then verify:
1. Load `backend-microservices-directory-structure` (mandatory DDD layout) and `backend-microservices-baas-daas` (pick BaaS vs DaaS).
2. Load `backend-chassis-pattern` for cross-cutting concerns (errors, logging, settings, auth).
3. Load the framework skill: `backend-fastapi` or `backend-django-drf`; add `backend-dependency-management` for the pin policy and `backend-commits` for the gitlint setup.
4. Create only the layers needed by the first aggregate (`domain/`, `application/`, `infrastructure/`, `api/`).
5. Verify with `node <skill-dir>/scripts/dev-toolkit.mjs detect <service>` and the project's tests.
