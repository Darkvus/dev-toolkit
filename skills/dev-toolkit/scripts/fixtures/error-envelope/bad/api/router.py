from fastapi import HTTPException
from fastapi.responses import JSONResponse


def get(item):
    if not item:
        raise HTTPException(status_code=404, detail="nope")
    return JSONResponse({"error": "boom"}, status_code=400)
