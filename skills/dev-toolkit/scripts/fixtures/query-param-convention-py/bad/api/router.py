from fastapi import Query


def list_items(
    page_size: int = Query(20),
    sort_by: str | None = Query(None),
    min_price: int | None = None,
    start_date: str | None = None,
):
    return []


class ItemFilters:
    created__gte: str = Query(None, alias="created_at__gte")
