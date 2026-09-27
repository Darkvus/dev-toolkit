---
name: backend-permission-management
description: "Permission management implementation pattern: RBAC model, permission checking with company-security-sdk, PermissionCheckMixin, and integration with FastAPI/DRF. Use when implementing authorization or reviewing permissions."
---

# Plan: Permission Management Implementation with company-security-sdk

## Summary

This document describes the permission implementation pattern.

For the full step-by-step code (env vars, permission classes, use cases, endpoint wiring, tests), read `references/implementation-walkthrough.md` — load it only once you're actually writing the code, not just to check the architecture or checklist below.

---

## Permission System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API Layer                                  │
│  views.py → Extracts "User-Id" Header → Injects UseCase             │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      Application Layer                               │
│  UseCase + PermissionCheckMixin                                      │
│  ├── permission_classes = [PermissionClass]                         │
│  └── execute():                                                      │
│      1. Authenticate user                                           │
│      2. Verify permissions (check_permissions)                      │
│      3. Execute business logic                                      │
│      4. Return result                                               │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        Domain Layer                                  │
│  ├── value_objects.py → Permissions enum                            │
│  ├── permissions.py → Permission classes                            │
│  └── exceptions.py → Domain exceptions                              │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                             │
│  dependencies.py → Factory functions                                 │
│  ├── get_user_authentication() → GenericOperatorAuthentication      │
│  └── get_*_use_case() → Dependency injection                        │
└─────────────────────────────────────────────────────────────────────┘
```

The pattern always has 4 layers, wired in this order: define the permission enum + classes (domain) → configure authentication dependencies (infrastructure) → check permissions inside the use case via `PermissionCheckMixin` (application) → extract `User-Id` header and inject the use case (API). Full code for each step lives in `references/implementation-walkthrough.md`.

---

## Required company-security-sdk Imports

```python
# Authentication
from company_security_sdk.auth.generic.operator import GenericOperatorAuthentication

# Models
from company_security_sdk.models import Operator

# Permissions
from company_security_sdk.permissions import PermissionCheckMixin, PermissionDenied
from company_security_sdk.permissions.operators import OperatorBasePermission

# Constants
from company_security_sdk.constants import OperatorScopeType
```

---

## OperatorBasePermission Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `permission` | `str` | Permission name (from enum) |
| `log_message` | `str` | Logging message |
| `message` | `str` | Error message (default: "The operator does not have permissions") |
| `allowed_scopes` | `List[OperatorScopeType]` | Allowed scopes: TENANT, ENTITY, PARTNER |

---

## Operator Model Properties

| Property | Type | Description |
|----------|------|--------------|
| `id` | `UUID` | Operator ID |
| `permissions` | `List[str]` | List of assigned permissions |
| `scope` | `OperatorScopeType` | TENANT, ENTITY, or PARTNER |
| `entities` | `List[Entity]` | Associated entities (TENANT scope) |
| `entity` | `Entity` | Specific entity (ENTITY scope) |
| `partner` | `Partner` | Specific partner (PARTNER scope) |

---

## Implementation Checklist

- [ ] Add `company-security-sdk` to `pyproject.toml`
- [ ] Configure `USERS_MS_USER_DAAS_URL` variable in `.env`
- [ ] Create `OperatorPermissions` enum in `domain/value_objects.py`
- [ ] Create permission classes in `domain/permissions.py`
- [ ] Create exceptions in `domain/exceptions.py`
- [ ] Configure `get_user_authentication()` in `infrastructure/dependencies.py`
- [ ] Implement use case interfaces
- [ ] Implement use cases with `PermissionCheckMixin`
- [ ] Register factory functions in dependencies
- [ ] Use in endpoints with `User-Id` header
- [ ] Write permission and use case tests

(`references/implementation-walkthrough.md` has the full code + a curl-based verification recipe + a real-world file reference in `managers-ms-alarm-baas-api-server`.)
