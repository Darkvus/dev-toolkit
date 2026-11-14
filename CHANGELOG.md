# Changelog

## 3.0.0

Orchestrator release. Backward compatible: no skill, agent or slash command was renamed or removed.

### Added
- `/dev-toolkit` orchestrator skill with sub-commands `plan`, `scaffold`, `crud`, `api`, `review`, `commit`, `audit`, `document`, `doctor`, `context`, `hooks`. Each routes to `skills/dev-toolkit/reference/<command>.md`, which loads the existing convention skills, agents and commands on demand. No-argument call prints a stack-aware menu.
- CLI `skills/dev-toolkit/scripts/dev-toolkit.mjs` (Node 18+, no dependencies): `context`, `detect`, `commit-msg`, `hooks`, `ignore`, `doctor`, `hook`.
- Convention detector with 13 rules derived from the skills (PATCH-only updates, integer units, UTC datetimes, DDD layering, error envelope, query params, typed API client, `Intl` formatting, UTC ISO format, vendored `components/ui`, theme tokens, class merging, accessibility labels) plus the commit message check. `--json`, severity, `file:line`, inline and config suppression.
- `PostToolUse` hook on `Edit|Write` (`hooks/hooks.json`): fast, non-blocking, opt-out through `.dev-toolkit/config.json`.
- Agents `dev-toolkit-reviewer` and `dev-toolkit-documenter`.
- Unit tests with fixtures for every rule (`node --test`).

### Changed
- `plugin.json` 3.0.0 (declares the `skills` path); `marketplace.json` carries the version; README and INSTALL document the front door, CLI and migration.

## 2.0.0
- Renamed `backend-toolkit` to `dev-toolkit`; added the React + Vite + shadcn/ui frontend skills, `frontend-planner` and the `/scaffold-frontend` and `/add-crud-page` commands.
