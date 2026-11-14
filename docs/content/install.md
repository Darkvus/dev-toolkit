---
title: Install
section: Getting started
order: 2
description: Install dev-toolkit through the Claude Code marketplace, with npx, or by hand.
---

# Install

Pick the route that matches your tool. All of them install the same files.

@@tab Claude Code marketplace
Best for Claude Code: updates come through the plugin system and hooks are wired automatically.

```text
/plugin marketplace add Darkvus/dev-toolkit
/plugin install dev-toolkit@dev-toolkit
```

Restart Claude Code, then check:

```text
/agents
/help
```

Update or remove later:

```text
/plugin marketplace update dev-toolkit
/plugin uninstall dev-toolkit@dev-toolkit
```
@@tab npx (Claude Code)
Copies skills, agents, commands and hooks into `.claude/`. Needs Node 18 or newer.

```bash
# For you, in every project (~/.claude)
npx dev-toolkit install

# For this repository only (./.claude), committed with the project
npx dev-toolkit install --scope project

# Preview first
npx dev-toolkit install --dry-run
```

Keep it current and inspect it:

```bash
npx dev-toolkit update
npx dev-toolkit status
npx dev-toolkit uninstall
```

Files you edited are never overwritten or removed unless you pass `--force`. See the [CLI page](cli/) for details.
@@tab Other tools
For tools that read an `AGENTS.md` and a skills folder, use the generic target. It writes to `./.agents/` and adds a managed block to `AGENTS.md` that lists the skills.

```bash
npx dev-toolkit install --target generic --scope project
```

Choose another folder with `--dir`:

```bash
npx dev-toolkit install --target generic --dir ./tools/agents
```

The skills are plain markdown with a short frontmatter, so any tool that can read files can use them. Slash commands and subagents are Claude Code features; other tools can read them as reference documents.
@@tab Manual
Clone the repository and copy the folders yourself.

```bash
git clone https://github.com/Darkvus/dev-toolkit.git
cp -r dev-toolkit/skills/*   ~/.claude/skills/
cp    dev-toolkit/agents/*.md   ~/.claude/agents/
cp    dev-toolkit/commands/*.md ~/.claude/commands/
```

Or add a local checkout as a marketplace:

```text
/plugin marketplace add /path/to/dev-toolkit
/plugin install dev-toolkit@dev-toolkit
```
@@end

## Migrating from backend-toolkit

Version 2.0.0 renamed the plugin. Reinstall once:

```text
/plugin uninstall backend-toolkit@backend-toolkit
/plugin marketplace remove backend-toolkit
/plugin marketplace add Darkvus/dev-toolkit
/plugin install dev-toolkit@dev-toolkit
```

All agents, commands and backend skills keep their names. Only the namespace changes, for example `backend-toolkit:backend-fastapi` becomes `dev-toolkit:backend-fastapi`.
