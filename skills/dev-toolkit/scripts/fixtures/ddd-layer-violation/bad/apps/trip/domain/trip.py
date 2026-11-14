from sqlalchemy.orm import Session
from apps.trip.infrastructure.repositories import SqlTripRepository
from ..api.v1 import serializers
import fastapi
