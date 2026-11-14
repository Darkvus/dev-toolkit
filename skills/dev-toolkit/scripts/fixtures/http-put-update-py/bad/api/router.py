from fastapi import APIRouter

router = APIRouter()


@router.put("/vehicles/{vehicle_id}")
def replace_vehicle(vehicle_id: str):
    return {}


@router.post("/vehicles/{vehicle_id}/update")
def update_vehicle(vehicle_id: str):
    return {}
