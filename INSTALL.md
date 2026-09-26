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

You should see the `ddd-planner`, `fastapi-planner`, `djangorestframework-planner`, `daas-planner`, `frontend-planner`, and `planner-orchestrator` agents, along with the commands and skills listed in [README.md](README.md).

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
