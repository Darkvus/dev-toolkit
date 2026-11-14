from fastapi import Query


def list_items(
    limit: int = Query(20),
    offset: int = Query(0),
    ordering: str | None = None,
    from_price: int | None = None,
    to_price: int | None = None,
    statuses: list[str] | None = None,
):
    return []
