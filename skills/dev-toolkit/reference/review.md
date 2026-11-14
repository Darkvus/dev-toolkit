# review

Arguments: paths, a diff range, or `--changed` (default: working tree changes).

1. Launch the `dev-toolkit-reviewer` agent with: the targets, the `context` output, and the request. It runs the CLI (`detect --json`), reads the relevant convention skills for each finding class, applies judgment, and returns an ordered fix list.
2. Present the list as returned; apply fixes only if the user asked (otherwise offer).
3. Without subagents: run `node <skill-dir>/scripts/dev-toolkit.mjs detect --changed --json`, read the skills named in each finding's `skill` field only for the rules that fired, and write the list yourself.
