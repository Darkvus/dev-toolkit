from fastapi import HTTPException


def get(item):
    raise HTTPException(status_code=404)
