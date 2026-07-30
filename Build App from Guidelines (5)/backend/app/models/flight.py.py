"""Domain model for a Flight record (plain Python dataclass — not SQLAlchemy)."""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FlightModel:
    """Mirrors the `flights` table structure."""
    id:                   Optional[int]   = None
    flight_id:            str             = ""
    airline:              str             = ""
    aircraft_type:        str             = ""
    departure_airport:    str             = ""
    arrival_airport:      str             = ""
    scheduled_departure:  str             = ""
    actual_departure:     str             = ""
    scheduled_arrival:    str             = ""
    actual_arrival:       str             = ""
    temperature:          float           = 20.0
    visibility:           float           = 8000.0
    wind_speed:           float           = 10.0
    rainfall:             float           = 0.0
    storm:                int             = 0
    airport_congestion:   float           = 40.0
    runway_status:        str             = "Operational"
    technical_issue:      int             = 0
    fuel_load:            float           = 70.0
    distance:             float           = 1000.0
    altitude:             float           = 35000.0
    delay_minutes:        int             = 0
    deviation:            int             = 0
    created_at:           str             = ""

    @classmethod
    def from_row(cls, row: dict) -> "FlightModel":
        return cls(**{k: v for k, v in row.items() if k in cls.__dataclass_fields__})
