# context

```bash
node <skill-dir>/scripts/dev-toolkit.mjs context          # JSON + directives
node <skill-dir>/scripts/dev-toolkit.mjs context --json   # JSON only
```

Fields: `stacks` (`fastapi`, `drf`, `django`, `django-daas`, `react-vite`, `react`), `projects[]` (path, stacks, features such as shadcn/zod/tanstack, layout, DDD layers found), `skills` (convention skills that apply), `git`, `files`, `hooks`, `directives`. Summarise in 3-5 lines and follow the directives. It is read-only.
