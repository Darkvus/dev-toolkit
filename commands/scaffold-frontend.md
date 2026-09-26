---
argument-hint: <app-name>
description: Create a new React + Vite + shadcn/ui frontend with the team's structure, data layer, theming and test setup
---

# Scaffold Frontend

## Input

App name: `$ARGUMENTS` (kebab-case, e.g. `backoffice-web`). If empty, ask for it before doing anything.

This command creates a production-ready frontend that follows the `frontend-*` skills. Load `frontend-directory-structure`, `frontend-shadcn-ui`, `frontend-data-fetching` and `frontend-testing` before starting: file contents below must match them.

---

## Phase 1: Checks

```bash
node --version   # Node 20.19+ or 22.12+ (required by Vite 8)
ls "$ARGUMENTS" 2>/dev/null && echo "EXISTS"
```

If the folder exists, stop and ask whether to use another name. Never overwrite an existing project.

## Phase 2: Create the project with the shadcn CLI

```bash
npx shadcn@latest init -t vite -n "$ARGUMENTS" -b radix -p nova -y --no-monorepo
cd "$ARGUMENTS"
```

This creates Vite + React + TypeScript + Tailwind CSS v4, `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx` and `src/components/theme-provider.tsx`.

## Phase 3: Dependencies and components

```bash
npm i react-router @tanstack/react-query @tanstack/react-table react-hook-form zod @hookform/resolvers
npm i -D @types/node@^24 vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw
npx shadcn@latest add field input card table dropdown-menu select dialog alert-dialog sonner skeleton badge checkbox empty -y
```

`@types/node@^24` is required: the template pins `^20`, which conflicts with Vitest's peer dependency.

## Phase 4: Structure and base files

Create the layout from `frontend-directory-structure`:

```bash
mkdir -p src/app src/lib/api src/features src/test
rm -f src/App.tsx src/assets/react.svg
```

Create these files with the exact contents from the skills:

| File | Content from |
| --- | --- |
| `src/lib/api/errors.ts` | `frontend-data-fetching` → The HTTP client (`ApiError`) |
| `src/lib/api/client.ts` | `frontend-data-fetching` → The HTTP client (`apiRequest`, `buildQuery`, `paginated`). Ask which backend the app talks to and set `ARRAY_FORMAT` (`"comma"` for DRF, `"repeat"` for FastAPI) |
| `src/lib/forms.ts` | `frontend-forms` → Mapping backend errors |
| `src/lib/format.ts` | `frontend-units-and-formatting` → Helpers |
| `src/app/providers.tsx` | `ThemeProvider` + `QueryClientProvider` (query client defaults from `frontend-data-fetching`) + `<Toaster richColors />` |
| `src/app/router.tsx` | `createBrowserRouter` with a placeholder home route; features are added lazily (see `frontend-directory-structure` → Routing) |
| `src/main.tsx` | `<StrictMode><AppProviders><RouterProvider router={router} /></AppProviders></StrictMode>` |
| `src/vite-env.d.ts` | `/// <reference types="vite/client" />` plus the typed `ImportMetaEnv` with `VITE_API_URL` |
| `.env.example` | `VITE_API_URL=http://localhost:8000` |
| `src/test/server.ts`, `src/test/setup.ts`, `src/test/render.tsx` | `frontend-testing` → Setup |
| `vitest.config.ts` | `frontend-testing` → Setup |
| `src/lib/format.test.ts` | `frontend-units-and-formatting` → Tests |

Then apply these config changes:

1. `vite.config.ts`: replace `__dirname` with `import.meta.dirname`.
2. `tsconfig.node.json`: `"include": ["vite.config.ts", "vitest.config.ts"]`.
3. `eslint.config.js`: add the `src/components/ui/**` override from `frontend-shadcn-ui` → Lint.
4. `package.json` scripts: add `"test": "vitest run"` and `"test:watch": "vitest"`.
5. `index.html`: set the `<title>` to the app name and add the theme flash-prevention script from `frontend-theming` → Dark mode.
6. `.gitignore`: make sure `.env` and `.env.local` are ignored.

## Phase 5: Optional AI tooling

Ask the user whether to install the official shadcn tooling for coding agents (it complements, not replaces, our skills):

```bash
npx skills add shadcn/ui
npx shadcn@latest mcp init --client claude
```

## Phase 6: Verify

All four must pass with no errors or warnings. Fix anything that fails before finishing:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Phase 7: Git

```bash
git init
git add .
git commit -m "feat(scaffold): create frontend with Vite, shadcn/ui and dev-toolkit conventions" -m "Refs: <task>"
```

Use the commit format from `backend-commits` (`feat(scope): description` plus the mandatory `Refs:` footer); ask the user for the task reference. Do not push or create a remote unless the user asks.

## Phase 8: Report

```markdown
## Frontend scaffolded: {app-name}

- Stack: Vite {version}, React {version}, Tailwind CSS v4, shadcn/ui (radix, nova)
- Data: TanStack Query + typed client (ARRAY_FORMAT = {comma|repeat})
- Checks: typecheck ✅ lint ✅ tests ✅ build ✅

### Next steps
- `cp .env.example .env` and set `VITE_API_URL`
- `npm run dev`
- Add the first screen with `/add-crud-page <resource> <endpoint>`
```

## Rules

- **NEVER** copy shadcn components by hand; always use the CLI.
- **NEVER** overwrite an existing folder.
- **ALWAYS** finish with all checks passing, or report exactly what failed.
