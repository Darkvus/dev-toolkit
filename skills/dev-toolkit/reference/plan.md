# plan

Plan a feature end to end. Do not restate conventions; the planners load them.

1. If the request is big or unclear, run `/explore-plan <request>`: it creates the session file, selects planners and iterates. For a technical spec across microservices use `/start-working-on-technical-plan`.
2. Order of agents (backend first, so the frontend reads real API contracts):
   - `ddd-planner` (architecture: aggregates, use cases, layers)
   - then `fastapi-planner` or `djangorestframework-planner` or `daas-planner`, chosen from the stack in `context`
   - then `frontend-planner` if the feature has UI
   - then `planner-orchestrator` to consolidate tasks and the release readiness report
3. When the plan is approved: `/create-issues-from-plan` (one GitHub issue per microservice repo) or `/create-new-gh-issue`; implement with `/start-working-on-issue`.
4. Each plan states which convention skills its tasks need, so implementers load only those.
