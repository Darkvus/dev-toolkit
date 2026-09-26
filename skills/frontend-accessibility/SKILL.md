---
name: frontend-accessibility
description: "Accessibility rules for React + shadcn/ui frontends: semantic structure, labels, keyboard and focus, icon buttons, dialogs, contrast, live feedback. Use when building UI or reviewing components for accessibility."
---

# Accessibility

shadcn/ui primitives (Radix) already handle focus trapping, keyboard navigation and ARIA roles for menus, dialogs, selects and tabs. Most accessibility bugs come from **how we compose them**. Target: WCAG 2.2 AA.

## Checklist

### Structure

- One `<h1>` per page; headings do not skip levels.
- Use landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`. Page content goes inside `<main>`.
- Use the right element: `<button>` for actions, `<a>`/`<Link>` for navigation. Never `div onClick`.
- Tables of data use `Table` (real `<table>` markup), not grids of `div`s.

### Labels

- Every form control has a visible `FieldLabel` linked with `htmlFor`/`id` (see [[frontend-forms]]). Placeholders are not labels.
- Icon-only buttons have an accessible name:

```tsx
<Button variant="ghost" size="icon" aria-label="Delete vehicle">
  <Trash2 />
</Button>
```

- Decorative icons next to text need nothing extra; lucide icons render with `aria-hidden` by default.
- Images have `alt`; decorative images use `alt=""`.

### Keyboard and focus

- Everything clickable is reachable and operable with the keyboard (Tab, Enter, Space, Escape).
- Never remove the focus ring (`outline-none` without a replacement); the theme's `ring` token is the focus style.
- Dialogs, sheets and popovers: use the shadcn components so focus is trapped and returned to the trigger on close. Every `Dialog`/`AlertDialog` has a `Title` (use `className="sr-only"` if it must be hidden) and a `Description` or `aria-describedby={undefined}`.
- After deleting a row or closing a dialog, focus goes somewhere meaningful (the next row, the list heading), not to `<body>`.

### Feedback

- Errors are announced: `aria-invalid` on the control, the message in `FieldError`, and form-level errors with `role="alert"`.
- Toasts (`sonner`) are announced by the library, but critical information must also stay on screen: do not use a toast as the only place a validation error appears.
- Loading states: `Skeleton` for content; buttons show a text change ("Saving…") and are disabled while pending.

### Color and motion

- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI boundaries) in light **and** dark themes (see [[frontend-theming]]).
- Never convey meaning with color alone: status badges include text; errors include an icon or message.
- Respect reduced motion: wrap non-essential animations with `motion-safe:`.

### Responsive

- Layouts work at 320 px width without horizontal scrolling (tables may scroll inside their container).
- Touch targets are at least 24×24 px; prefer the default button sizes.

## Testing

Query elements the way users find them, which also tests accessibility (see [[frontend-testing]]):

```ts
screen.getByRole("button", { name: "Create vehicle" })
screen.getByLabelText("Plate")
```

If a test can only find an element with `getByTestId` or a CSS selector, that element is probably missing a role or a label.
