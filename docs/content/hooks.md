---
title: Hooks
section: Hooks
order: 1
description: The post-edit convention hook that dev-toolkit v3 ships, and how to control it.
v3: true
---

# Hooks

<span class="badge">v3</span> Hooks are scripts Claude Code runs on events. Unlike skills, they run whether or not the model remembers the rule, so dev-toolkit uses one for the thing that must always happen: checking each edited file against the conventions.

## How they get registered

- **Marketplace install:** the plugin's `hooks/hooks.json` is picked up automatically.
- **npx install:** the files are copied to `.claude/hooks/dev-toolkit/`, but the installer does not edit your `settings.json`. Add the entry yourself, or use the marketplace install for automatic wiring.

## The post-edit hook

@@include hooks-reference

@@include hooks-json
