from sqlalchemy import Column, Float


class Trip:
    price: float
    distance_km: float = 0.0
    total_amount = Column(Float)
    duration = models.FloatField()
