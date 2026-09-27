# Permission Management: Full Implementation Walkthrough

Step-by-step code for implementing the pattern described in `SKILL.md`. Read this file only when you are actually writing the permission code for a module (not just checking the architecture or checklist).

---

## Step 1: Configure Environment Variables

**File: `config/env_vars.py`**

```python
from company_fastapi_chassis.settings import BaseSettings

class CustomEnvVars(BaseSettings):
    # User Management Service URL
    users_ms_user_daas_url: str
```

**File: `.env`**

```bash
USERS_MS_USER_DAAS_URL=/users/daas/user/
```

---

## Step 2: Define Permissions Enum (Domain Layer)

**File: `apps/{module}/domain/value_objects.py`**

```python
from enum import Enum

class OperatorPermissions(str, Enum):
    """Module-specific permissions."""

    LIST_RESOURCES = "LIST_RESOURCES"
    RETRIEVE_RESOURCE = "RETRIEVE_RESOURCE"
    CREATE_RESOURCE = "CREATE_RESOURCE"
    UPDATE_RESOURCE = "UPDATE_RESOURCE"
    DELETE_RESOURCE = "DELETE_RESOURCE"
```

---

## Step 3: Create Permission Classes (Domain Layer)

**File: `apps/{module}/domain/permissions.py`**

```python
from company_security_sdk.permissions.operators import OperatorBasePermission

from apps.{module}.domain.value_objects import OperatorPermissions


class ListResourcesPermission(OperatorBasePermission):
    """Permission to list resources."""

    log_message: str = "Checking list resources permission"
    permission: str = OperatorPermissions.LIST_RESOURCES.value


class RetrieveResourcePermission(OperatorBasePermission):
    """Permission to retrieve resource details."""

    log_message: str = "Checking retrieve resource permission"
    permission: str = OperatorPermissions.RETRIEVE_RESOURCE.value


class CreateResourcePermission(OperatorBasePermission):
    """Permission to create resources."""

    log_message: str = "Checking create resource permission"
    permission: str = OperatorPermissions.CREATE_RESOURCE.value
```

---

## Step 4: Define Domain Exceptions

**File: `apps/{module}/domain/exceptions.py`**

```python
from company_dominus.shared.domain.exceptions import (
    DomainBaseException,
    TypeException,
    LogLevel
)


class UserPermissionDeniedException(DomainBaseException):
    """Exception when user lacks permissions."""

    code: str = "401"
    type: TypeException = TypeException.PERMISSION
    log_level: LogLevel = LogLevel.WARNING


class UserNotFoundException(DomainBaseException):
    """Exception when user does not exist."""

    code: str = "404"
    type: TypeException = TypeException.PERMISSION
    log_level: LogLevel = LogLevel.WARNING
```

---

## Step 5: Configure Authentication Dependencies (Infrastructure Layer)

**File: `apps/{module}/infrastructure/dependencies.py`**

```python
from typing import Annotated

from fastapi import Depends

from company_requests import IHttpClient
from company_security_sdk.auth.generic.operator import GenericOperatorAuthentication
from company_security_sdk.models import Operator

from config.settings import settings


def get_http_client() -> IHttpClient:
    """HTTP client factory."""
    from company_requests import HttpClient
    return HttpClient()


def get_user_authentication(
    http_client: Annotated[IHttpClient, Depends(get_http_client)]
) -> GenericOperatorAuthentication:
    """
    Authentication service factory.

    Configures GenericOperatorAuthentication to retrieve
    user information from the User Management Service.
    """
    auth = GenericOperatorAuthentication(
        http_client=http_client,
        users_ms_url=settings.USERS_MS_USER_DAAS_URL,
    )
    auth.header_name = "User-Id"
    auth.model = Operator

    return auth
```

---

## Step 6: Define Use Case Interfaces (Application Layer)

**File: `apps/{module}/application/uses_cases/interfaces.py`**

```python
from abc import ABC, abstractmethod
from typing import List
from uuid import UUID

from apps.{module}.domain.aggregates import Resource


class IListResourcesUseCase(ABC):
    """Interface for listing resources."""

    @abstractmethod
    def execute(self, user_id: UUID, filters: dict) -> List[Resource]:
        """
        Execute the use case.

        Args:
            user_id: Authenticated user's UUID.
            filters: Search filters.

        Returns:
            List of resources.

        Raises:
            UserNotFoundException: User does not exist.
            UserPermissionDeniedException: User lacks permissions.
        """
        raise NotImplementedError
```

---

## Step 7: Implement Use Cases with Permissions (Application Layer)

**File: `apps/{module}/application/uses_cases/list_resources.py`**

```python
from typing import Annotated, List
from uuid import UUID

from fastapi import Depends

from company_security_sdk.auth.generic.operator import GenericOperatorAuthentication
from company_security_sdk.models import User
from company_security_sdk.permissions import PermissionCheckMixin, PermissionDenied

from apps.{module}.application.uses_cases.interfaces import IListResourcesUseCase
from apps.{module}.domain.aggregates import Resource
from apps.{module}.domain.exceptions import (
    UserNotFoundException,
    UserPermissionDeniedException,
)
from apps.{module}.domain.permissions import ListResourcesPermission
from apps.{module}.domain.repositories.resource import IResourceRepository
from apps.{module}.infrastructure.dependencies import (
    get_resource_repository,
    get_user_authentication,
)


class ListResourcesUseCase(IListResourcesUseCase, PermissionCheckMixin):
    """Use case for listing resources."""

    permission_classes = [ListResourcesPermission]

    def __init__(
        self,
        resource_repository: Annotated[IResourceRepository, Depends(get_resource_repository)],
        user_authentication: Annotated[GenericOperatorAuthentication, Depends(get_user_authentication)]
    ) -> None:
        self._resource_repository = resource_repository
        self._user_authentication = user_authentication

    def _get_user(self, user_id: UUID) -> User:
        try:
            user = self._user_authentication.get_user(str(user_id))
        except ValueError as exc:
            raise UserNotFoundException(code="USER_NOT_FOUND") from exc

    def _check_permissions(self, operator: Operator) -> None:
        """
        Check if the Operator has permission to list sent notifications.

        Args:
            operator: The authenticated operator
        """

        try:
            self.check_permissions(obj=operator)
        except PermissionDenied as exc:
            raise UserPermissionDeniedException() from exc

    def execute(self, user_id: UUID, filters: dict) -> List[Resource]:
        """Execute the use case."""
        # 1. Authenticate user
        user = self._get_user(user_id=user_id)

        # 2. Verify permissions
        self._check_permissions(operator=user)

        # 3. Execute business logic
        resources = self._resource_repository.list(filters)

        # 4. Return result
        return resources
```

---

## Step 8: Register Use Case Factory Functions

**File: `apps/{module}/infrastructure/dependencies.py`** (add)

```python
from apps.{module}.application.uses_cases.interfaces import IListResourcesUseCase
from apps.{module}.application.uses_cases.list_resources import ListResourcesUseCase


def get_list_resources_use_case(
    resource_repository: Annotated[IResourceRepository, Depends(get_resource_repository)],
    user_authentication: Annotated[GenericOperatorAuthentication, Depends(get_user_authentication)]
) -> IListResourcesUseCase:
    """ListResourcesUseCase factory."""
    return ListResourcesUseCase(
        resource_repository=resource_repository,
        user_authentication=user_authentication
    )
```

---

## Step 9: Use in Endpoints (API Layer)

**File: `apps/{module}/api/versioning/v1/views.py`**

```python
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header

from company_fastapi_chassis.exceptions import GenericException
from company_dominus.shared.domain.exceptions import DomainBaseException

from apps.{module}.application.uses_cases.interfaces import IListResourcesUseCase
from apps.{module}.infrastructure.dependencies import get_list_resources_use_case

router = APIRouter()


@router.get("/resources/")
def list_resources(
    user_id: Annotated[UUID, Header(alias="User-Id", description="Auth User Id")],
    list_use_case: Annotated[IListResourcesUseCase, Depends(get_list_resources_use_case)],
):
    """Endpoint to list resources."""
    try:
        resources = list_use_case.execute(user_id=user_id, filters={})
    except DomainBaseException as e:
        raise GenericException(
            code=e.code,
            type_exception=e.type,
            log_level=e.log_level,
        ) from e

    return {"data": resources}
```

---

## Step 10: Write Tests

**File: `tests/{module}/domain/test_permissions.py`**

```python
import pytest

from apps.{module}.domain.permissions import ListResourcesPermission
from apps.{module}.domain.value_objects import OperatorPermissions


class TestListResourcesPermission:
    def test_permission_log_message(self):
        assert ListResourcesPermission.log_message == "Checking list resources permission"

    def test_permission_value(self):
        assert ListResourcesPermission.permission == OperatorPermissions.LIST_RESOURCES.value

    def test_permission_equals_string(self):
        assert ListResourcesPermission.permission == "LIST_RESOURCES"
```

**File: `tests/{module}/application/test_list_resources_use_case.py`**

```python
import pytest
from unittest.mock import Mock, patch
from uuid import uuid4

from company_security_sdk.permissions import PermissionDenied

from apps.{module}.application.uses_cases.list_resources import ListResourcesUseCase
from apps.{module}.domain.exceptions import (
    UserNotFoundException,
    UserPermissionDeniedException,
)


class TestListResourcesUseCase:
    @pytest.fixture
    def mock_repository(self):
        return Mock()

    @pytest.fixture
    def mock_auth(self):
        return Mock()

    @pytest.fixture
    def use_case(self, mock_repository, mock_auth):
        return ListResourcesUseCase(
            resource_repository=mock_repository,
            user_authentication=mock_auth
        )

    def test_user_not_found_raises_exception(self, use_case, mock_auth):
        mock_auth.get_user.side_effect = ValueError("User not found")

        with pytest.raises(UserNotFoundException):
            use_case.execute(user_id=uuid4(), filters={})

    def test_permission_denied_raises_exception(self, use_case, mock_auth):
        mock_auth.get_user.return_value = Mock(permissions=[], scope="TENANT")

        with patch.object(use_case, 'check_permissions', side_effect=PermissionDenied()):
            with pytest.raises(UserPermissionDeniedException):
                use_case.execute(user_id=uuid4(), filters={})
```

---

## Verification

1. **Unit tests**: `tox -e py312`
2. **Manual test with curl**:
   ```bash
   # Without User-Id header (should fail)
   curl -X GET http://localhost:8000/api/v1/resources/

   # With valid User-Id
   curl -X GET http://localhost:8000/api/v1/resources/ \
     -H "User-Id: 123e4567-e89b-12d3-a456-426614174000"
   ```
3. **Check logs**: The permission class `log_message` should appear

---

## Reference Files in managers-ms-alarm-baas-api-server as an example

| File | Purpose |
|------|---------|
| `apps/operations/alarm/domain/value_objects.py` | Permissions enum |
| `apps/operations/alarm/domain/permissions.py` | Permission classes |
| `apps/operations/alarm/domain/exceptions.py` | Domain exceptions |
| `apps/operations/alarm/infrastructure/dependencies.py` | Authentication configuration |
| `apps/operations/alarm/application/uses_cases/list_alarm.py` | Use case example |
| `apps/operations/alarm/api/versioning/v1/views.py` | Endpoint usage |
