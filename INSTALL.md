# Installation

`dev-toolkit` is a [Claude Code](https://claude.com/claude-code) plugin. Install it via a plugin marketplace pointing at this repository.

## 1. Add the marketplace

From inside Claude Code:

```
/plugin marketplace add Darkvus/dev-toolkit
```

Or, if you've cloned the repo locally:

```
/plugin marketplace add /path/to/dev-toolkit
```

## 2. Install the plugin

```
/plugin install dev-toolkit@dev-toolkit
```

## 3. Verify

Restart Claude Code (or start a new session) and check that the plugin's agents, commands, and skills are available:

```
/agents
/help
```

You should see the `ddd-planner`, `fastapi-planner`, `djangorestframework-planner`, `daas-planner`, `frontend-planner`, `planner-orchestrator`, `dev-toolkit-reviewer` and `dev-toolkit-documenter` agents, the `/dev-toolkit` skill, along with the commands and skills listed in [README.md](README.md).

Then run `/dev-toolkit doctor` to check the installation, and `/dev-toolkit` to see the menu for the current project.

Requirements: Node 18+ for the CLI and the post-edit hook (without Node both are skipped silently; skills, agents and commands still work).

## Updating

```
/plugin marketplace update dev-toolkit
```

## Uninstalling

```
/plugin uninstall dev-toolkit@dev-toolkit
```

## Migrating from backend-toolkit

Version 2.0.0 renamed the repository, marketplace and plugin from `backend-toolkit` to `dev-toolkit`. Existing installations keep working until you update, but the plugin ID changed, so reinstall once:

```
/plugin uninstall backend-toolkit@backend-toolkit
/plugin marketplace remove backend-toolkit
/plugin marketplace add Darkvus/dev-toolkit
/plugin install dev-toolkit@dev-toolkit
```

All agents, commands and backend skills keep their names. Only the plugin namespace changes (for example `backend-toolkit:backend-fastapi` → `dev-toolkit:backend-fastapi`).

## Migrating to 3.0.0

3.0.0 is backward compatible: every skill, agent and slash command keeps its name and behavior. New: the `/dev-toolkit` skill (front door), the `dev-toolkit-reviewer` and `dev-toolkit-documenter` agents, a CLI at `skills/dev-toolkit/scripts/dev-toolkit.mjs`, and a `PostToolUse` hook (`hooks/hooks.json`).

```
/plugin marketplace update dev-toolkit
/plugin update dev-toolkit@dev-toolkit
```

- The hook is on by default and only reports (it never blocks an edit). To turn it off for a project: `/dev-toolkit hooks off`, or create `.dev-toolkit/config.json` with `{ "hooks": "off" }`. Add `.dev-toolkit/` to version control if you want the team to share ignores and the generated `context.json`.
- Projects with their own conventions (a different error envelope, a custom API client) can silence rules with `ignoreRules` / `ignoreFiles`, or run `/dev-toolkit document` so the deviations are recorded.
- Run `node --test` in a clone of this repository to run the CLI's test suite.
