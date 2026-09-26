---
name: frontend-units-and-formatting
description: "Displaying and capturing backend units in the frontend: cents, meters, seconds and UTC datetimes with Intl formatting and conversion helpers. Use when showing money, distances, durations or dates, or when sending them back to the API."
---

# Units and Formatting

The backend stores and exchanges values in fixed units ([[backend-units-of-measurement]]): **cents**, **meters**, **seconds** and **UTC** datetimes. The frontend keeps those units in its data and converts **only at the edges**:

- **Displaying**: backend unit → localized string (`Intl`).
- **Capturing**: user input → backend unit, right before calling the API.

Never store "euros" or "kilometers" in state or send them to the API.

## Helpers

All conversions live in `src/lib/format.ts`; components never do `/ 100` or `new Date(...).toLocaleString()` inline.

```ts
// src/lib/format.ts
export function formatMoney(cents: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100)
}

/** User input "12,50" or "12.50" → 1250 cents. Returns null if not a number. */
export function parseMoneyToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".")
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null
  return Math.round(Number(normalized) * 100)
}

export function formatDistance(meters: number, locale?: string): string {
  if (Math.abs(meters) < 1000) {
    return new Intl.NumberFormat(locale, { style: "unit", unit: "meter", maximumFractionDigits: 0 }).format(meters)
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", maximumFractionDigits: 1 }).format(meters / 1000)
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`
}

/** "2026-09-26T14:05:11Z" → localized date-time in the user's timezone. */
export function formatDateTime(utcIso: string, locale?: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(utcIso))
}

/** Date → "%Y-%m-%dT%H:%M:%SZ" (no milliseconds), the backend datetime format. */
export function toUtcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}
```

## Rules

1. **Money**: integers in cents end to end. Parse user input with `parseMoneyToCents` (it rounds, avoiding `0.1 + 0.2` float errors) and format with `Intl.NumberFormat` and the resource's currency code ([[backend-encoding]]). Never hardcode the `€`/`$` symbol in the value.
2. **Datetimes**: the API sends and receives UTC strings (`...Z`). Display them in the user's timezone; when the business works in a fixed timezone (for example a station's local time), pass it explicitly as `timeZone` (IANA name, see [[backend-encoding]]).
3. **Dates without time** (`%Y-%m-%d`) are calendar dates: do not pass them through `new Date()` (it shifts the day across timezones). Treat them as strings or split the parts.
4. **Durations** are seconds; show `h/m` for long ones and `m/s` for short ones. Countdowns update from the seconds value, not by parsing the rendered string.
5. **Distances** are meters; show meters under 1 km and kilometers with one decimal above.
6. Locale comes from the user's settings or `navigator.language`, passed explicitly to the helpers in multi-language apps; do not rely on the machine locale in tests (pass `"en-US"` or similar).
7. Numbers in tables and totals use the `tabular-nums` class.

## Tests

Every helper has unit tests with a fixed locale and timezone:

```ts
import { describe, expect, it } from "vitest"

import { formatDuration, formatMoney, parseMoneyToCents, toUtcIso } from "@/lib/format"

describe("format", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(4550, "EUR", "en-US")).toBe("€45.50")
  })

  it("parses user money input to integer cents", () => {
    expect(parseMoneyToCents("45,5")).toBe(4550)
    expect(parseMoneyToCents("0.07")).toBe(7)
    expect(parseMoneyToCents("abc")).toBeNull()
  })

  it("formats seconds as a duration", () => {
    expect(formatDuration(3725)).toBe("1h 02m")
  })

  it("serializes dates in the backend UTC format without milliseconds", () => {
    expect(toUtcIso(new Date(Date.UTC(2026, 8, 26, 14, 5, 11, 999)))).toBe("2026-09-26T14:05:11Z")
  })
})
```
