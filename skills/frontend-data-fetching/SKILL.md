---
name: frontend-data-fetching
description: "Data fetching conventions for React frontends: single typed HTTP client, backend error envelope, Zod-validated responses, TanStack Query keys, queries and mutations, PATCH partial updates, limit/offset pagination. Use when calling the backend API or reviewing queries and mutations."
---

# Data Fetching

Server state lives in **TanStack Query**. Components never call `fetch` directly: they use the hooks in `features/<feature>/api/`, which use the single client in `lib/api/`.

## The HTTP client

One client for the whole app (`src/lib/api/client.ts`). It:

1. Prefixes `VITE_API_URL`.
2. Serializes query params following [[backend-url-query-params]].
3. Converts non-2xx responses into an `ApiError` that understands our error envelope ([[backend-api-design]]).
4. Validates every response body with a Zod schema, so the UI never works with unvalidated data.

```ts
// src/lib/api/errors.ts
import { z } from "zod"

const apiMessageSchema = z.object({
  type: z.enum(["INFO", "WARNING", "ERROR", "FATAL"]),
  field: z.string().optional(),
  code: z.string().optional(),
  description: z.string().optional(),
  details: z.array(z.object({ code: z.string(), description: z.string() })).optional(),
})

export const apiErrorBodySchema = z.object({
  messages: z.array(apiMessageSchema),
  // Large integers lose precision in JSON.parse: only log/display it, never compare it.
  trace_id: z.union([z.string(), z.number()]).optional(),
})

export type ApiMessage = z.infer<typeof apiMessageSchema>

export class ApiError extends Error {
  readonly status: number
  readonly messages: ApiMessage[]
  readonly traceId: string | undefined

  constructor(status: number, messages: ApiMessage[], traceId?: string) {
    super(messages[0]?.description ?? messages[0]?.details?.[0]?.description ?? `HTTP ${status}`)
    this.name = "ApiError"
    this.status = status
    this.messages = messages
    this.traceId = traceId
  }

  /** Field-level messages keyed by backend field name. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const message of this.messages) {
      if (message.field && message.details?.length) {
        result[message.field] = message.details.map((d) => d.description).join(" ")
      }
    }
    return result
  }

  /** Messages not tied to a field (shown as a root form error or a toast). */
  get generalErrors(): string[] {
    return this.messages.filter((m) => !m.field).map((m) => m.description ?? m.code ?? "Unexpected error")
  }
}
```

> Note: the Vite template enables `erasableSyntaxOnly`, so constructor parameter properties (`constructor(public status: number)`) do not compile. Declare fields explicitly as above.

```ts
// src/lib/api/client.ts
import { z } from "zod"

import { ApiError, apiErrorBodySchema } from "@/lib/api/errors"

const API_URL = import.meta.env.VITE_API_URL ?? ""

/**
 * How list filters are serialized. DRF `BaseInFilter` expects `ids=a,b`;
 * FastAPI `list[str] = Query()` expects `ids=a&ids=b`. Set it once per backend.
 */
const ARRAY_FORMAT: "comma" | "repeat" = "comma"

export type QueryValue = string | number | boolean | Date | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

function serialize(value: Exclude<QueryValue, null | undefined>): string {
  return value instanceof Date ? value.toISOString().replace(/\.\d{3}Z$/, "Z") : String(value)
}

export function buildQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, raw] of Object.entries(params)) {
    if (raw === null || raw === undefined || raw === "") continue
    if (Array.isArray(raw)) {
      const values = raw.filter((v): v is Exclude<QueryValue, null | undefined> => v !== null && v !== undefined)
      if (values.length === 0) continue
      if (ARRAY_FORMAT === "comma") search.set(key, values.map(serialize).join(","))
      else values.forEach((v) => search.append(key, serialize(v)))
    } else {
      search.set(key, serialize(raw))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ""
}

type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  query?: QueryParams
  body?: unknown
  schema: z.ZodType<T>
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = "GET", query, body, schema, signal } = options
  const response = await fetch(`${API_URL}${path}${buildQuery(query)}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null)
    const parsed = apiErrorBodySchema.safeParse(payload)
    if (parsed.success) {
      const traceId = parsed.data.trace_id === undefined ? undefined : String(parsed.data.trace_id)
      throw new ApiError(response.status, parsed.data.messages, traceId)
    }
    throw new ApiError(response.status, [{ type: "ERROR", description: response.statusText }])
  }

  if (response.status === 204) return schema.parse(undefined)
  return schema.parse(await response.json())
}

/** Limit/offset envelope (DRF LimitOffsetPagination shape). */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    count: z.number().int(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(item),
  })
}
```

Rules:

1. `method` only allows `GET`, `POST`, `PATCH` and `DELETE`. Updates are **always** `PATCH` with the changed fields; `PUT` is not used.
2. Authentication (bearer token, cookies with `credentials: "include"`) is added **in this client only**, never in feature code.
3. Pagination is limit/offset (`limit`, `offset` params) with the `{count, next, previous, results}` envelope. If a service answers with another shape, adapt it in that feature's `api/` file, not in components.

## API contracts are Zod schemas

Each feature declares the response contract in `schemas/`, and the TypeScript type is inferred from it:

```ts
// src/features/vehicles/schemas/vehicle.ts
export const vehicleSchema = z.object({
  id: z.string(),
  plate: z.string(),
  partner: z.string(),
  daily_price: z.number().int(), // cents
  created_at: z.string(), // UTC "%Y-%m-%dT%H:%M:%SZ"
})
export type Vehicle = z.infer<typeof vehicleSchema>
```

- Field names keep the backend's `snake_case`: no renaming layer to keep in sync.
- Units stay as the backend sends them (cents, meters, seconds, UTC strings). Convert only when displaying (see [[frontend-units-and-formatting]]).
- If the backend exposes OpenAPI (FastAPI `/openapi.json`, DRF + drf-spectacular), the schemas must match it; generating them is allowed, hand-editing generated files is not.

## Queries and mutations

Each feature exposes a **query key factory** plus one hook per operation:

```ts
// src/features/vehicles/api/vehicles.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { apiRequest, paginated } from "@/lib/api/client"
import { vehicleSchema, type Vehicle, type VehicleFilters } from "@/features/vehicles/schemas/vehicle"

const vehiclePageSchema = paginated(vehicleSchema)

export const vehicleKeys = {
  all: ["vehicles"] as const,
  lists: () => [...vehicleKeys.all, "list"] as const,
  list: (filters: VehicleFilters) => [...vehicleKeys.lists(), filters] as const,
  details: () => [...vehicleKeys.all, "detail"] as const,
  detail: (id: string) => [...vehicleKeys.details(), id] as const,
}

export function useVehicles(filters: VehicleFilters) {
  return useQuery({
    queryKey: vehicleKeys.list(filters),
    queryFn: ({ signal }) => apiRequest("/api/v1/vehicles", { query: filters, schema: vehiclePageSchema, signal }),
    placeholderData: keepPreviousData, // keep the current page visible while the next one loads
  })
}

export type VehicleWrite = Pick<Vehicle, "plate" | "partner" | "daily_price">

export function useUpdateVehicle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Partial update: PATCH with only the changed fields, never PUT with the whole object.
    mutationFn: (changes: Partial<VehicleWrite>) =>
      apiRequest(`/api/v1/vehicles/${id}`, { method: "PATCH", body: changes, schema: vehicleSchema }),
    onSuccess: (vehicle) => {
      queryClient.setQueryData(vehicleKeys.detail(id), vehicle)
      return queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() })
    },
  })
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/api/v1/vehicles/${id}`, { method: "DELETE", schema: z.undefined() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehicleKeys.lists() }),
  })
}
```

Rules:

1. Always pass `signal` so navigating away cancels the request.
2. Query keys always come from the factory; never write `["vehicles", ...]` inline.
3. After a mutation, invalidate the affected **lists** and update the **detail** cache with the response.
4. Why PATCH with only changed fields: it mirrors the backend's explicit field updates ([[backend-fastapi]]) and avoids overwriting fields another user changed in the meantime.
5. Optimistic updates only for instant, low-risk toggles (favorite, read/unread), always with rollback in `onError`.

## Query client defaults

```tsx
// src/app/providers.tsx
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Never retry client errors (4xx): they will fail again.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  })
}
```

## Loading, empty and error states

Every screen that fetches data handles the three states explicitly:

| State | UI |
| --- | --- |
| Loading (`isPending`) | `Skeleton` shaped like the final content (no full-page spinners) |
| Empty (`data.count === 0`) | `Empty` with a short explanation and the primary action |
| Error (`isError`) | Inline message with a retry button (`refetch`); show `traceId` in small text when present so users can report it |

Mutation errors that are not field errors (see [[frontend-forms]]) are shown with `toast.error(error.message)`.
