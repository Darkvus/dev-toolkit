# audit

Whole-project convention scan (use `review` for a diff).

1. `node <skill-dir>/scripts/dev-toolkit.mjs detect <root or app dirs> --json` (add `--severity warn` to skip info). Use `--list-rules` to show what is checked.
2. Group by rule, then by directory; count per severity. Errors first.
3. For each rule group give: what the convention says (one line + skill name), 2-3 representative `file:line`, and the fix. Do not paste skill content.
4. Separate real violations from likely false positives (generated code, intentional exceptions). Intentional ones get `dev-toolkit-ignore <rule>` comments or `ignoreFiles` entries in `.dev-toolkit/config.json` (`/dev-toolkit hooks` reference).
5. Finish with a prioritised plan: quick mechanical fixes, then structural ones (DDD layering, client bypass). Offer to launch `dev-toolkit-reviewer` on the highest-risk directory.
