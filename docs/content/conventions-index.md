---
title: Overview
section: Conventions
order: 1
slug: conventions
description: The backend-frontend contract every skill assumes.
---

# Conventions

The skills are not independent. Together they define one contract between a Python backend and a React frontend. Break one rule on one side and the other side's skills stop making sense, so it helps to know the contract itself.

| Rule | Backend skill | Frontend skill |
|---|---|---|
| Updates are `PATCH` with changed fields only | [backend-fastapi](skills/backend-fastapi/), [backend-django-drf](skills/backend-django-drf/) | [frontend-data-fetching](skills/frontend-data-fetching/), [frontend-forms](skills/frontend-forms/) |
| Money in integer cents, distance in integer meters, time in integer seconds | [backend-units-of-measurement](skills/backend-units-of-measurement/) | [frontend-units-and-formatting](skills/frontend-units-and-formatting/) |
| One error envelope with `messages` and `trace_id` | [backend-api-design](skills/backend-api-design/) | [frontend-data-fetching](skills/frontend-data-fetching/), [frontend-forms](skills/frontend-forms/) |
| Universal query parameter names | [backend-url-query-params](skills/backend-url-query-params/) | [frontend-data-tables](skills/frontend-data-tables/) |

The pages in this section state each rule briefly. The linked skills are the full source of truth.
