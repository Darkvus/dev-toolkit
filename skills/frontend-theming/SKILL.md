---
name: frontend-theming
description: "Theming conventions for shadcn/ui + Tailwind CSS v4: semantic CSS variable tokens, adding custom tokens, dark mode in Vite, radius and fonts. Use when choosing colors, adding design tokens, or implementing dark mode."
---

# Theming

All visual decisions go through **semantic tokens** defined as CSS variables in `src/index.css`. Components never know the actual color, only its role.

## Semantic tokens only

Use the token utilities that shadcn defines: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar-*`.

Correct example:

```tsx
<p className="text-muted-foreground">Last sync 5 min ago</p>
<div className="rounded-lg border bg-card text-card-foreground" />
<Button variant="destructive">Delete</Button>
```

Incorrect example:

```tsx
<p className="text-gray-500">Last sync 5 min ago</p>        // breaks in dark mode
<div className="border-[#e5e5e5] bg-white" />                // hardcoded color
<button className="bg-red-600 text-white">Delete</button>    // bypasses the design system
```

Raw palette classes (`bg-blue-500`, `text-zinc-400`, hex values) are only allowed inside `src/index.css` token definitions.

## Adding a token

When a role is missing (status colors are the usual case), add a token instead of hardcoding. Define it for light and dark, then expose it to Tailwind with `@theme inline`:

```css
/* src/index.css */
:root {
  --success: oklch(0.63 0.17 149);
  --success-foreground: oklch(0.98 0.02 149);
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

.dark {
  --success: oklch(0.7 0.15 150);
  --success-foreground: oklch(0.2 0.04 150);
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

Now `bg-success`, `text-warning-foreground`, `bg-success/15` work everywhere.

Rules:

1. Colors are written in `oklch()`, like the tokens shadcn generates.
2. Every token has a `-foreground` pair when text can sit on top of it, and both pairs must meet WCAG AA contrast (4.5:1 for text) in light **and** dark.
3. Name tokens by role (`success`, `warning`, `info`), never by hue (`green`, `orange`).
4. New tokens are added to every project through the shared preset or a registry item, not copied ad hoc.

## Dark mode (Vite)

The Vite template generates `src/components/theme-provider.tsx`: it toggles the `.dark` class on `<html>`, persists the choice in `localStorage`, and supports `"light" | "dark" | "system"`. Keep it; do not add `next-themes` (it targets Next.js).

- Wrap the app once in `ThemeProvider` (see `src/app/providers.tsx` in [[frontend-directory-structure]]).
- Offer a mode toggle with `light`, `dark` and `system` options (a `DropdownMenu` with a Sun/Moon icon button).
- Style dark-specific tweaks with the `dark:` variant only when a token cannot express it.

Avoid a flash of the wrong theme on load by applying the stored class before React renders:

```html
<!-- index.html, inside <head> -->
<script>
  ;(function () {
    const stored = localStorage.getItem("theme")
    const dark = stored === "dark" || ((!stored || stored === "system") && matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("dark", dark)
  })()
</script>
```

The `localStorage` key must match the provider's `storageKey` (`"theme"` in the generated provider).

## Radius, spacing and typography

- Radius comes from `--radius`; use `rounded-sm` … `rounded-4xl`, never arbitrary values like `rounded-[7px]`.
- Fonts are declared once in `@theme inline` (`--font-sans`, `--font-heading`). Use `font-heading` for page titles.
- Numbers in tables and totals use `tabular-nums` so columns align.
- Use Tailwind's spacing scale (`gap-4`, `p-6`); arbitrary values (`p-[13px]`) need a written reason.

## Charts

Chart colors come from `--chart-1` … `--chart-5`, so charts follow the theme in light and dark. Do not pass hex colors to chart libraries.
