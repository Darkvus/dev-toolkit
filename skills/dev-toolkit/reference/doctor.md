# doctor

```bash
node <skill-dir>/scripts/dev-toolkit.mjs doctor
```

Checks: Node version, `plugin.json` / `marketplace.json` consistency, SKILL.md version, routed reference files, hooks wiring, skill folder/name match, agent and command frontmatter, and project drift (`.dev-toolkit/config.json` validity, `context.json` stacks vs code). Print the output as is; exit code 1 means errors. For each ERROR or WARN give the one-line fix (e.g. rerun `/dev-toolkit document` for drift, `/plugin marketplace update dev-toolkit` for stale plugin files).
