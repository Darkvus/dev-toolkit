from fastapi import APIRouter

router = APIRouter()


@router.patch("/vehicles/{vehicle_id}")
def update_vehicle(vehicle_id: str):
    return {}
