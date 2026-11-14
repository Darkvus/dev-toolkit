# document

Generate project docs from the built code, never from intentions.

1. Launch the `dev-toolkit-documenter` agent with the project root and the `context` output. It writes `CONVENTIONS.md` (project-specific deviations and choices, linking to the plugin skills instead of copying them) and `.dev-toolkit/context.json` (stacks, layout, enabled conventions, error envelope, client path).
2. If both already exist and `doctor` reports no drift, report "no changes".
3. Docstrings for legacy modules: `/update-docstrings`. Permissions sync: `/update-permissions`.
