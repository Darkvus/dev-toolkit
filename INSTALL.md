# Installation

`dev-toolkit` is a [Claude Code](https://claude.com/claude-code) plugin and also works with [OpenCode](https://opencode.ai) and [Codex CLI](https://developers.openai.com/codex). See [Installing in OpenCode](#installing-in-opencode) and [Installing in Codex](#installing-in-codex).

For Claude Code, install it via a plugin marketplace pointing at this repository.

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

---

## Installing in OpenCode

OpenCode has no plugin marketplace, so `scripts/install-opencode.sh` installs the toolkit into OpenCode's config directories:

```bash
git clone https://github.com/Darkvus/dev-toolkit.git
cd dev-toolkit

scripts/install-opencode.sh              # global: ~/.config/opencode
scripts/install-opencode.sh --project    # only the current project: ./.opencode
scripts/install-opencode.sh --target DIR # custom OpenCode config dir
```

What it does:

| Item | OpenCode location | Notes |
|---|---|---|
| Skills | `skills/<name>/SKILL.md` | Copied as-is (same format as Claude Code). |
| Agents | `agents/<name>.md` | Converted: Claude-only frontmatter (`model`, `tools`, `color`, `name`) is replaced by `mode: subagent` plus permissions. Agents use the model configured in OpenCode. |
| Commands | `commands/<name>.md` | `argument-hint` is dropped; `$ARGUMENTS` works in both tools. |

Re-run the script after pulling updates; it overwrites previously installed files. Restart OpenCode and check that the commands (e.g. `/technical-plan`) and agents are listed.

---

## Installing in Codex

`scripts/install-codex.sh` installs the toolkit into Codex's skill and subagent directories:

```bash
scripts/install-codex.sh                 # user scope: ~/.agents/skills + ~/.codex/agents
scripts/install-codex.sh --project       # current repo: ./.agents/skills + ./.codex/agents
scripts/install-codex.sh --skills-dir DIR --agents-dir DIR   # custom locations
```

| Item | Codex location | Notes |
|---|---|---|
| Skills | `skills/<name>/SKILL.md` | Copied as-is (same format as Claude Code). |
| Commands | `skills/<command-name>/SKILL.md` | Codex custom prompts are deprecated, so commands become skills. Invoke them with `$technical-plan <spec>`. `$ARGUMENTS` is rewritten to "the text the user wrote after the skill name". |
| Agents | `agents/<name>.toml` | Converted to Codex subagents (`name`, `description`, `developer_instructions`, `sandbox_mode = "workspace-write"`). They use the model configured in Codex. Ask Codex to spawn them by name, e.g. "use fastapi-planner to plan this". |

Differences to keep in mind: Codex does not run a command's agent orchestration automatically (it delegates to subagents only when asked), and tool names mentioned in the instructions (such as `AskUserQuestion`) map to whatever Codex offers for asking the user. Re-run the script after pulling updates.
