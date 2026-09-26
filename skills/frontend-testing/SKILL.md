---
name: frontend-testing
description: "Frontend testing conventions with Vitest, Testing Library and MSW for React + Vite apps: setup, what to test, API mocking with the backend error envelope, render helpers. Use when writing or reviewing frontend tests."
---

# Frontend Testing

Tests describe behavior as the user sees it, against a mocked HTTP API. Stack: **Vitest** (runner, Vite-native), **Testing Library** (render and queries), **user-event** (interactions) and **MSW** (network mocking).

```bash
npm i -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw @types/node@^24
```

The Vite template pins `@types/node@^20`, but Vitest 5 requires `^22 || >=24`, so upgrade it in the same install.

## Setup

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.ts"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  })
)
```

Add `vitest.config.ts` to the `include` of `tsconfig.node.json` so it is type-checked, and use `import.meta.dirname` instead of `__dirname` in `vite.config.ts`.

```ts
// src/test/server.ts
import { setupServer } from "msw/node"

// Handlers are declared per test with server.use(...) so each test states the API it depends on.
export const server = setupServer()
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll } from "vitest"

import { server } from "@/test/server"

beforeAll(() => server.listen({ onUnhandledRequest: "error" }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
```

```tsx
// src/test/render.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options)
}
```

`onUnhandledRequest: "error"` makes any request without a handler fail the test, so tests can never hit a real backend.

## What to test

| Layer | Test | Tool |
| --- | --- | --- |
| `lib/` helpers (format, query building, error parsing) | Unit tests, fixed locale/timezone | Vitest |
| Forms | Client validation, payload sent (units converted), backend 400 shown on the right field | Testing Library + MSW |
| Pages with data | Loading, empty, error and success states; URL params sent to the API | Testing Library + MSW |
| `components/ui/` | Not tested: vendored shadcn code | — |

Do not snapshot-test components, and do not test TanStack Query or React Hook Form internals.

## Example: form against the API

```tsx
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it } from "vitest"

import { VehicleCreateForm } from "@/features/vehicles/components/vehicle-form"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Plate"), "1234ABC")
  await user.type(screen.getByLabelText("Partner"), "acme")
  await user.type(screen.getByLabelText("Daily price (€)"), "45,50")
  await user.click(screen.getByRole("button", { name: "Create vehicle" }))
}

describe("VehicleCreateForm", () => {
  it("sends the price in cents", async () => {
    let body: unknown
    server.use(
      http.post("*/api/v1/vehicles", async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          { id: "v1", plate: "1234ABC", partner: "acme", daily_price: 4550, created_at: "2026-09-26T10:00:00Z" },
          { status: 201 }
        )
      })
    )
    renderWithProviders(<VehicleCreateForm />)
    await fillAndSubmit()
    await screen.findByRole("button", { name: "Create vehicle" })
    expect(body).toEqual({ plate: "1234ABC", partner: "acme", daily_price: 4550 })
  })

  it("shows backend validation errors under the matching field", async () => {
    server.use(
      http.post("*/api/v1/vehicles", () =>
        HttpResponse.json(
          { messages: [{ type: "INFO", field: "plate", details: [{ code: "unique", description: "Plate already registered." }] }] },
          { status: 400 }
        )
      )
    )
    renderWithProviders(<VehicleCreateForm />)
    await fillAndSubmit()
    expect(await screen.findByText("Plate already registered.")).toBeInTheDocument()
    expect(screen.getByLabelText("Plate")).toHaveAttribute("aria-invalid", "true")
  })
})
```

## Rules

1. Query by role and label first (`getByRole`, `getByLabelText`), then by text; `getByTestId` is a last resort (see [[frontend-accessibility]]).
2. Use `findBy*` / `waitFor` for anything async; never `setTimeout` in tests.
3. Mock responses use the **real** backend shapes, including the error envelope from [[backend-api-design]] and the pagination envelope from [[frontend-data-fetching]].
4. MSW handlers match with `*/path` so they work with any `VITE_API_URL`.
5. Each test declares its own handlers with `server.use`; shared default handlers only for app-wide calls (current user, feature flags).
6. Test files sit next to the code: `vehicle-form.tsx` → `vehicle-form.test.tsx`.
7. `npm run typecheck`, `npm run lint` and `npx vitest run` must pass before opening a PR.
