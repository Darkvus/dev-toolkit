from app.errors import NotFound


def get(item):
    if not item:
        raise NotFound("item")
    return item
