---
name: frontend-data-tables
description: "Data table conventions with shadcn/ui Table + TanStack Table v9: server-side pagination, sorting and filtering mapped to backend query params, URL as state, loading and empty rows. Use when building or reviewing lists and tables of backend resources."
---

# Data Tables

Lists of backend resources are **server-side** tables: the backend paginates, sorts and filters; the table only renders one page. We use the shadcn `Table` markup with **TanStack Table v9** as the headless engine.

Client-side row models (`createPaginatedRowModel`, `createSortedRowModel`, `createFilteredRowModel`) are only allowed for small, fully-loaded static lists (settings, enums). Never download a whole collection to paginate it in the browser.

## Mapping table state to query params

Table state is translated to the query params defined in [[backend-url-query-params]]:

| Table state | Query param | Example |
| --- | --- | --- |
| `pagination.pageIndex`, `pageSize` | `limit`, `offset` | page 3 of 20 → `limit=20&offset=40` |
| `sorting` | `ordering` (`-` prefix = descending) | `[{ id: "plate", desc: true }]` → `ordering=-plate` |
| text filter | field name | `plate=12AB` |
| multi-select filter | plural field name | `partners=acme,globex` |
| date range | `from_` / `to_` prefixes | `from_created_at=2026-09-01T00:00:00Z` |

`ordering` with a `-` prefix is DRF's `OrderingFilter` convention; confirm the parameter with the backend plan if the service is FastAPI.

## The URL is the source of truth

Page, sorting and filters live in the URL search params, not in `useState`: links are shareable, reloads keep the view and the back button works.

```tsx
// src/features/vehicles/pages/vehicles-page.tsx
import type { PaginationState, SortingState } from "@tanstack/react-table"
import { useSearchParams } from "react-router"

import { useVehicles } from "@/features/vehicles/api/vehicles"
import { VehiclesTable } from "@/features/vehicles/components/vehicles-table"

const PAGE_SIZE = 20

function readState(params: URLSearchParams): { pagination: PaginationState; sorting: SortingState } {
  const page = Math.max(Number(params.get("page") ?? "1"), 1)
  const ordering = params.get("ordering")
  return {
    pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE },
    sorting: ordering ? [{ id: ordering.replace(/^-/, ""), desc: ordering.startsWith("-") }] : [],
  }
}

export function VehiclesPage() {
  const [params, setParams] = useSearchParams()
  const { pagination, sorting } = readState(params)
  const ordering = sorting[0] ? `${sorting[0].desc ? "-" : ""}${sorting[0].id}` : undefined

  const vehicles = useVehicles({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    ordering,
  })

  function update(next: { pagination?: PaginationState; sorting?: SortingState }) {
    const nextPagination = next.pagination ?? pagination
    const nextSorting = next.sorting ?? sorting
    const nextParams = new URLSearchParams(params)
    nextParams.set("page", String(nextPagination.pageIndex + 1))
    if (nextSorting[0]) nextParams.set("ordering", `${nextSorting[0].desc ? "-" : ""}${nextSorting[0].id}`)
    else nextParams.delete("ordering")
    setParams(nextParams)
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="font-heading text-2xl font-semibold">Vehicles</h1>
      <VehiclesTable
        data={vehicles.data?.results ?? []}
        rowCount={vehicles.data?.count ?? 0}
        isLoading={vehicles.isPending}
        pagination={pagination}
        onPaginationChange={(updater) =>
          update({ pagination: typeof updater === "function" ? updater(pagination) : updater })
        }
        sorting={sorting}
        onSortingChange={(updater) =>
          // A new sort order starts again from the first page.
          update({
            sorting: typeof updater === "function" ? updater(sorting) : updater,
            pagination: { ...pagination, pageIndex: 0 },
          })
        }
      />
    </main>
  )
}
```

The page shows `page` as 1-based in the URL; TanStack's `pageIndex` is 0-based. Changing sorting or filters always resets to the first page.

## The table component

TanStack Table v9 asks you to register the features you use (everything else is tree-shaken). For server-side tables register only `rowPaginationFeature` and `rowSortingFeature`, and set `manualPagination` / `manualSorting`:

```tsx
// src/features/vehicles/components/vehicles-table.tsx
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Vehicle } from "@/features/vehicles/schemas/vehicle"
import { formatDateTime, formatMoney } from "@/lib/format"

const features = tableFeatures({ rowPaginationFeature, rowSortingFeature })
const columnHelper = createColumnHelper<typeof features, Vehicle>()

const columns = columnHelper.columns([
  columnHelper.accessor("plate", {
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting()}>
        Plate <ArrowUpDown />
      </Button>
    ),
  }),
  columnHelper.accessor("partner", { header: "Partner", enableSorting: false }),
  columnHelper.accessor("daily_price", {
    header: () => <div className="text-right">Daily price</div>,
    cell: ({ getValue }) => <div className="text-right tabular-nums">{formatMoney(getValue(), "EUR")}</div>,
  }),
  columnHelper.accessor("created_at", {
    header: "Created",
    cell: ({ getValue }) => formatDateTime(getValue()),
  }),
])

type VehiclesTableProps = {
  data: Vehicle[]
  rowCount: number
  isLoading: boolean
  pagination: PaginationState
  onPaginationChange: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => void
  sorting: SortingState
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void
}

export function VehiclesTable(props: VehiclesTableProps) {
  const table = useTable({
    features,
    columns,
    data: props.data,
    rowCount: props.rowCount,
    manualPagination: true,
    manualSorting: true,
    state: { pagination: props.pagination, sorting: props.sorting },
    onPaginationChange: props.onPaginationChange,
    onSortingChange: props.onSortingChange,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {props.isLoading ? (
              Array.from({ length: props.pagination.pageSize }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No vehicles found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">
          Page {table.state.pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </span>
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </Button>
      </div>
    </div>
  )
}
```

v9 notes:

- `row.getVisibleCells()` only exists when `columnVisibilityFeature` is registered; without it use `row.getAllCells()`.
- Render headers and cells with `<table.FlexRender header={...} />` / `<table.FlexRender cell={...} />`.
- Pass the features type as the first generic everywhere (`createColumnHelper<typeof features, Vehicle>()`).

## Rules

1. Columns are declared **outside** the component (or memoized), never recreated on every render.
2. Numeric and money columns are right-aligned with `tabular-nums`; values are formatted with [[frontend-units-and-formatting]], never shown raw (cents, meters, UTC).
3. Loading shows skeleton rows with the page size; empty shows a single row (or the `Empty` component for a first-use empty state with a create action).
4. Keep the previous page on screen while the next one loads (`placeholderData: keepPreviousData`, see [[frontend-data-fetching]]).
5. Text filters are debounced (300 ms) before updating the URL.
6. Row actions go in a trailing `DropdownMenu` column; destructive actions open an `AlertDialog` (see [[frontend-shadcn-ui]]).
7. Row selection and bulk actions add `rowSelectionFeature`; the selection is cleared when the page, sorting or filters change.
