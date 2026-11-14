---
title: Units of measurement
section: Conventions
order: 3
slug: conventions/units
description: Integer cents, meters and seconds; UTC date formats.
---

# Units of measurement

Quantities cross the wire in one canonical unit and one type. Conversion to something readable happens only at the edge, in the UI.

| Magnitude | Unit | Type / format |
|---|---|---|
| Distance | meters | integer |
| Currency | cents | integer |
| Duration | seconds | integer |
| Date and time | UTC | `%Y-%m-%dT%H:%M:%SZ` |
| Date | UTC | `%Y-%m-%d` |
| Time | UTC | `%H:%M:%SZ` |

```json
{ "price": 1999, "distance": 4200, "duration": 90, "created_at": "2026-05-02T10:30:00Z" }
```

Here `1999` is 19.99 in the account currency, `4200` is 4.2 km and `90` is a minute and a half. Never send floats for these values, and never send local times.

On the frontend, [frontend-units-and-formatting](skills/frontend-units-and-formatting/) provides `Intl`-based helpers for both directions. On the backend, see [backend-units-of-measurement](skills/backend-units-of-measurement/). A magnitude missing from the table is agreed with the team first, then added to the table.
