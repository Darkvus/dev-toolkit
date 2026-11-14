---
title: Query parameters
section: Conventions
order: 5
slug: conventions/query-parameters
description: Framework-neutral filter, pagination and ordering parameter names.
---

# Query parameters

Filter names are universal, not Django ORM lookups. A frontend never sends `datetime__gte`; it sends `from_datetime`.

| Intent | Convention | ORM equivalent |
|---|---|---|
| From, inclusive | `from_<field>` | `__gte` |
| From, strict | `above_<field>` | `__gt` |
| To, inclusive | `to_<field>` | `__lte` |
| To, strict | `below_<field>` | `__lt` |
| Any of several values | plural field name, `statuses` | `__in` |
| Relation by identifier | the relation name, never `_id` | |
| Null check | `_empty` for lists, `_isnull` for single fields | `__isnull` |

## Pagination and ordering

Lists are paginated server-side with `limit` and `offset`, and sorted with `ordering`, where a `-` prefix means descending:

```text
GET /api/v1/vehicles?limit=20&offset=40&ordering=-plate&statuses=active,parked&from_created_at=2026-01-01T00:00:00Z
```

Table state lives in the page URL (`page`, `ordering`, filters) and is translated to these parameters. Confirm the ordering parameter against the backend plan if the service is FastAPI.

See [backend-url-query-params](skills/backend-url-query-params/) for filter classes and [frontend-data-tables](skills/frontend-data-tables/) for the table side.
