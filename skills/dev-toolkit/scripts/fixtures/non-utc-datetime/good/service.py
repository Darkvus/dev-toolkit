from datetime import datetime, UTC, timezone

created = datetime.now(UTC)
other = datetime.now(tz=timezone.utc)
stamp = datetime.fromtimestamp(1700000000, tz=UTC)
TIME_ZONE = "UTC"
