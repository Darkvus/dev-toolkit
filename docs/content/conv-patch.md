---
title: PATCH-only updates
section: Conventions
order: 2
slug: conventions/patch-only-updates
description: Every update is a PATCH carrying only the changed fields.
---

# PATCH-only updates

Updates use `PATCH` with the fields that changed. `PUT` is not used, and neither is `POST` for updates.

```http
PATCH /api/v1/vehicles/6f1c...
Content-Type: application/json

{ "plate": "1234-ABC" }
```

## Why

- It mirrors the backend's explicit field updates, so a request cannot null a field by omission.
- It avoids overwriting something another user changed in the meantime, because untouched fields are not sent.
- Forms can send only dirty fields, which keeps requests small and audit trails meaningful.

## What it means on each side

- **Backend:** update endpoints accept `PATCH` and change only the fields that were sent. See [backend-fastapi](skills/backend-fastapi/) and [backend-django-drf](skills/backend-django-drf/).
- **Frontend:** the HTTP client's `method` only allows `GET`, `POST`, `PATCH` and `DELETE`, and forms diff against default values before sending. See [frontend-data-fetching](skills/frontend-data-fetching/) and [frontend-forms](skills/frontend-forms/).
