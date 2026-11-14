---
title: Error envelope
section: Conventions
order: 4
slug: conventions/error-envelope
description: One JSON error structure for every failing response.
---

# Error envelope

Every error response has the same shape: a `messages` list and a `trace_id`. Each message names the `field` it concerns (when there is one) and carries `details` with a machine-readable `code` and a human `description`.

```json
{
  "messages": [
    {
      "type": "INFO",
      "field": "name",
      "details": [{ "code": "required", "description": "This Field Is Required." }]
    }
  ],
  "trace_id": 189523488292774445242427953427527174528
}
```

Severity levels are `INFO`, `WARNING`, `ERROR` and `FATAL`. External APIs may return a numeric `code` and `description` per message instead of per-field details, to reveal less about what failed.

## Consequences

- The frontend has one parser. [frontend-data-fetching](skills/frontend-data-fetching/) turns the envelope into a typed error, and [frontend-forms](skills/frontend-forms/) maps a `400` onto the matching form fields by `field`.
- `trace_id` is kept on the typed error (as a string), so it can be logged or shown to support.

The full definition, including status code usage, is in [backend-api-design](skills/backend-api-design/).
