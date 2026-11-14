---
title: CLI
section: CLI
order: 1
description: The dev-toolkit command line - installer and project inspection commands.
---

# CLI

`npx dev-toolkit` has two groups of commands. No runtime dependencies; Node 18 or newer.

## Installer

| Command | What it does |
|---|---|
| `install` | Copy skills, agents, commands and hooks into the target folder. |
| `update` | Re-sync with the current version. Same safety rules as `install`; files dropped upstream are removed if you did not edit them. |
| `uninstall` | Remove files the installer put there. |
| `status` | List files that are `modified`, `outdated`, `missing` or `new`. |

### Options

| Flag | Meaning |
|---|---|
| `--target claude\|generic` | `claude` writes `.claude/`; `generic` writes `.agents/` and manages an `AGENTS.md` block. Default `claude`. |
| `--scope user\|project` | `user` is your home folder, `project` is the current directory. Default `user`. |
| `--dir <path>` | Use this destination folder instead. |
| `--dry-run` | Print every action, write nothing. |
| `--force` | Overwrite or delete files even if you edited them. |

### How edits are protected

The installer records a SHA-256 checksum of every file it writes in `.dev-toolkit-manifest.json` inside the destination. On `update` and `uninstall`:

- a file whose checksum still matches the manifest is safe to replace or remove;
- a file you edited is skipped and reported, unless `--force`;
- a file that already existed before the first install is treated as yours and left alone.

```bash
$ npx dev-toolkit update
skip     agents/frontend-planner.md (edited locally; use --force)
update   skills/backend-fastapi/SKILL.md
```

## Project inspection

<span class="badge">v3</span> These commands hand off to `skills/dev-toolkit/scripts/dev-toolkit.mjs`, the same script the `/dev-toolkit` skill and the edit hook run, so terminal, chat and hook always agree. The script is part of the package, so `npx dev-toolkit detect` works without installing anything.

```bash
npx dev-toolkit context
npx dev-toolkit detect --changed
npx dev-toolkit doctor
```

If the script is missing (an older version), the command exits with code 2 and says so. The script's own help, copied at build time:

@@include cli-help

## Detection rules

`detect` scans files for convention violations. These are the rules in this version, read from the script at build time (`detect --list-rules`):

@@include cli-rules

Silence a rule for the project with `ignore rule <id>` or a file glob with `ignore file <glob>`; both write to `.dev-toolkit/config.json`. See [Hooks](hooks/) for the config format and inline ignores.
