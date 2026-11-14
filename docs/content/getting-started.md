---
title: Introduction
section: Getting started
order: 1
description: What dev-toolkit is, what it ships and how the pieces fit together.
---

# Introduction

dev-toolkit is a plugin for [Claude Code](https://claude.com/claude-code) that packages one team's way of building full-stack software: a **Domain-Driven Design Python backend** (FastAPI or Django REST Framework) and a **React + Vite + shadcn/ui frontend** that consumes it.

It ships four kinds of files, all plain markdown:

| Kind | What it does | Loaded |
|---|---|---|
| [Skills](skills/) | Convention references: error format, units, query params, form handling | Automatically, when the task matches the skill description |
| [Commands](commands/) | Slash commands for repeatable workflows | When you type `/name` |
| [Agents](agents/) | Planning subagents that turn requirements into stack-specific plans | When Claude delegates, or you ask for one |
| [Hooks](hooks/) | Scripts the harness runs on events | Automatically, once registered |

## The front door: `/dev-toolkit`

<span class="badge">v3</span> One orchestrator command routes to everything else. Instead of remembering nine command names, type `/dev-toolkit` and a sub-command. With no arguments it prints a menu based on what it detects in your project:

```text
/dev-toolkit plan "vehicle fleet tracking"
/dev-toolkit scaffold frontend admin-panel
/dev-toolkit crud vehicle /api/v1/vehicles
/dev-toolkit review --changed
```

See the [command reference](commands/) for every sub-command. The original commands (`/explore-plan`, `/add-crud-page`, ...) still work.

## A typical flow

1. `/dev-toolkit plan <feature>` runs `ddd-planner`, then `fastapi-planner` or `djangorestframework-planner`, then `frontend-planner`.
2. `planner-orchestrator` consolidates the plans into task lists.
3. `/dev-toolkit scaffold frontend <app>` once per frontend app.
4. `/dev-toolkit crud <resource> <endpoint>` per screen.
5. `/dev-toolkit review --changed` before you open a pull request.

## Why the two halves match

The frontend skills are written to consume the backend ones. Both sides agree on the same [conventions](conventions/): updates are always `PATCH`, money is integer cents, distances are integer meters, durations are integer seconds, errors share one envelope, and list endpoints take the same query parameters. Skills reference each other, so Claude gets the matching rule on both sides of the wire.

## Next

- [Install it](install/)
- Browse [skills](skills/), [commands](commands/) and [agents](agents/)
- Read the [conventions](conventions/)
