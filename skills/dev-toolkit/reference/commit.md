# commit

1. Load `backend-commits`. Format: `[gitmoji ]type(scope): description`, body optional, footer `Refs: <Task>` mandatory.
2. Draft the message from `git diff --staged` (stage nothing yourself unless asked).
3. Check it before committing:
   ```bash
   node <skill-dir>/scripts/dev-toolkit.mjs commit-msg -m "<message>"
   ```
   Exit 1 means a format error; fix and recheck. Warnings (unknown type, missing `Refs:`) should be resolved or mentioned.
4. Optional git hook for the team: a `commit-msg` hook that runs `node <path>/dev-toolkit.mjs commit-msg "$1"`.
5. Respect project rules about attribution lines; add none unless the project asks.
