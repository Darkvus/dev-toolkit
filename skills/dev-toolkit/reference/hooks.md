# hooks

A `PostToolUse` hook (matcher `Edit|Write`) runs the detector on the file just changed and adds a short note to the agent's context when it finds convention violations. It never blocks an edit, scans one file, has a 5 s timeout, and stays silent when clean. Only `.py`, `.ts`, `.tsx`, `.js`, `.jsx` in projects with a `pyproject.toml`, `requirements.txt`, `package.json`, `manage.py` or `.dev-toolkit/` are checked; `info` findings are not surfaced.

## Commands

The first argument is the action; default `status`. Run from the project root:

| Action | Command | Effect |
|---|---|---|
| `status` | `node <skill-dir>/scripts/dev-toolkit.mjs hooks status` | Print state, ignored rules and files |
| `on` | `... hooks on` | `"hooks": "on"` in `.dev-toolkit/config.json` |
| `off` | `... hooks off` | `"hooks": "off"` (the hook exits immediately) |
| `ignore rule <id>` | `... ignore rule raw-format` | Add to `ignoreRules` (all files) |
| `ignore file <glob>` | `... ignore file "legacy/**"` | Add to `ignoreFiles` (all rules) |

Print the script output verbatim. After `off`, add: "New edits will not be checked in this project until `/dev-toolkit hooks on`."

## Config: `.dev-toolkit/config.json`

```json
{
  "hooks": "on",
  "ignoreRules": ["class-concat"],
  "ignoreFiles": ["legacy/**", "**/*.generated.ts"],
  "severity": { "raw-palette-color": "off", "a11y-label": "error" },
  "errorHandler": true
}
```

- `ignoreRules` and `ignoreFiles` apply to the hook and to manual `detect` (use `detect --no-config` for a raw run).
- `severity` overrides per rule: `error`, `warn`, `info` or `off`.
- `errorHandler: true|false` forces the `error-envelope` rule's assumption that the backend registers its own exception handlers (auto-detected otherwise).
- Env override: `DEV_TOOLKIT_HOOKS=off` disables the hook for a session.
- Inline: `# dev-toolkit-ignore <rule>` / `// dev-toolkit-ignore <rule>` on the line or the line above; `dev-toolkit-ignore-file [rule]` anywhere in a file.

Rule list: `node <skill-dir>/scripts/dev-toolkit.mjs detect --list-rules`.
