---
name: frontend-shadcn-ui
description: "shadcn/ui conventions for React + Vite apps: project init, adding and updating components with the CLI, ownership of components/ui, composition and variants. Use when creating UI, adding shadcn components, or reviewing component code."
---

# shadcn/ui

shadcn/ui is not a dependency you import from `node_modules`: the CLI copies component source into our repository (`src/components/ui/`). We own that code, so these rules exist to keep it upgradeable.

This skill covers **our conventions**. For the component catalog, CLI reference and registry authoring, use the official tooling (it explicitly does not cover team conventions):

```bash
npx skills add shadcn/ui                      # official shadcn skill for coding agents
npx shadcn@latest mcp init --client claude    # MCP server: search, view and install components
```

## Project setup

New projects are created with the CLI, never by hand (see `/scaffold-frontend`):

```bash
npx shadcn@latest init -t vite -n <app-name> -b radix -p nova -y --no-monorepo
```

| Flag | Our choice | Why |
| --- | --- | --- |
| `-t vite` | Vite template | SPA against our FastAPI/DRF backends; no SSR needed. |
| `-b radix` | Radix primitives | Most mature accessibility primitives. Only switch to `base` (Base UI) or `aria` project-wide, never mix. |
| `-p nova` | Nova preset (Lucide + Geist) | Consistent look across projects. A project-specific preset is fine if agreed with the team. |
| `--no-monorepo` | Single app | Frontends live in their own repository, like each microservice. |

`components.json` is the source of truth for aliases, style, base library and icon library. Do not edit the aliases by hand after init. Run `npx shadcn@latest info` to see the current configuration before generating code.

## Adding components

Always use the CLI, so the component matches the project's style and base library:

```bash
npx shadcn@latest add field input dialog table
npx shadcn@latest add dialog --dry-run   # inspect what would be written
npx shadcn@latest docs dialog            # usage docs and examples from the CLI
```

Never copy component code from the website, another project, or an AI answer into `src/components/ui/`. The copy may target a different base library (Radix vs Base UI APIs differ, e.g. `asChild` vs `render`).

## Ownership of `src/components/ui/`

Treat `src/components/ui/` as **vendored code**:

1. Do not add business logic, API calls or app-specific copy there.
2. Keep edits minimal and deliberate (for example, a new `variant`). Document every edit with a short comment, because updates will overwrite it.
3. Before updating a component, review the upstream changes:

```bash
npx shadcn@latest add button --diff      # compare local vs registry
npx shadcn@latest add button --overwrite # only after reviewing the diff and re-applying our documented edits
```

App-specific components go in `src/components/` (shared) or inside a feature (see [[frontend-directory-structure]]) and **compose** the primitives.

Correct example:

```tsx
// src/components/confirm-dialog.tsx — composes primitives, lives outside ui/
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", onConfirm }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Incorrect example:

```tsx
// src/components/ui/button.tsx — business logic inside a vendored primitive
function Button(props) {
  const { user } = useAuth()          // app state in a primitive
  if (!user.canEdit) return null      // permission logic hidden in the design system
  ...
}
```

## Choosing components

Prefer the dedicated component over rebuilding it with `div`s:

| Need | Use |
| --- | --- |
| Form fields, labels, help text, errors | `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup` (see [[frontend-forms]]) |
| Input with icon, prefix, suffix or button | `InputGroup` |
| Destructive confirmation | `AlertDialog` (not `Dialog`) |
| Toasts | `sonner` (`toast.success`, `toast.error`) |
| Loading placeholders | `Skeleton`; `Spinner` only for inline actions |
| Empty lists and zero states | `Empty` |
| Tabular data | `Table` + TanStack Table (see [[frontend-data-tables]]) |
| Side navigation | `Sidebar` |

## Styling rules

1. Merge classes with `cn()` from `@/lib/utils`; never concatenate class strings by hand.
2. Components accept `className` and pass it through `cn()` last, so callers can extend them.
3. Variants are declared with `cva` (class-variance-authority), not with conditional class strings scattered in JSX.
4. Use theme tokens (`bg-primary`, `text-muted-foreground`), never raw palette colors (see [[frontend-theming]]).
5. Icons come from the library in `components.json` (`lucide-react`). Icon-only buttons need an accessible name (see [[frontend-accessibility]]).

```tsx
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", {
  variants: {
    status: {
      active: "bg-success/15 text-success",
      disabled: "bg-muted text-muted-foreground",
      banned: "bg-destructive/15 text-destructive",
    },
  },
})

type StatusBadgeProps = React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ status }), className)} {...props} />
}
```

## Lint

shadcn primitives export their `cva` variants next to the component, which trips `react-refresh/only-export-components`. Disable that rule **only** for `src/components/ui/**`:

```js
// eslint.config.js
{
  files: ["src/components/ui/**/*.tsx"],
  rules: { "react-refresh/only-export-components": "off" },
},
```
