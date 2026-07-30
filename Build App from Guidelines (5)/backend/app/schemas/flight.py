"""Pydantic v2 schemas for Flight request / response validation."""
from typing import Optional, List
from pydantic import BaseModel, Field


class FlightCreate(BaseModel):
    flight_id:            str
    airline:              Optional[str]   = None
    aircraft_type:        Optional[str]   = None
    departure_airport:    Optional[str]   = None
    arrival_airport:      Optional[str]   = None
    scheduled_departure:  Optional[str]   = None
    actual_departure:     Optional[str]   = None
    scheduled_arrival:    Optional[str]   = None
    actual_arrival:       Optional[str]   = None
    temperature:          Optional[float] = 20.0
    visibility:           Optional[float] = 8000.0
    wind_speed:           Optional[float] = 10.0
    rainfall:             Optional[float] = 0.0
    storm:                Optional[int]   = 0
    airport_congestion:   Optional[float] = 40.0
    runway_status:        Optional[str]   = "Operational"
    technical_issue:      Optional[int]   = 0
    fuel_load:            Optional[float] = 70.0
    distance:             Optional[float] = 1000.0
    altitude:             Optional[float] = 35000.0
    delay_minutes:        Optional[int]   = 0
    deviation:            Optional[int]   = 0


class FlightUpdate(BaseModel):
    airline:              Optional[str]   = None
    aircraft_type:        Optional[str]   = None
    departure_airport:    Optional[str]   = None
    arrival_airport:      Optional[str]   = None
    temperature:          Optional[float] = None
    visibility:           Optional[float] = None
    wind_speed:           Optional[float] = None
    rainfall:             Optional[float] = None
    storm:                Optional[int]   = None
    airport_congestion:   Optional[float] = None
    runway_status:        Optional[str]   = None
    technical_issue:      Optional[int]   = None
    fuel_load:            Optional[float] = None
    distance:             Optional[float] = None
    altitude:             Optional[float] = None
    delay_minutes:        Optional[int]   = None
    deviation:            Optional[int]   = None


class FlightResponse(BaseModel):
    id:                   Optional[int]   = None
    flight_id:            str             = ""
    airline:              Optional[str]   = None
    aircraft_type:        Optional[str]   = None
    departure_airport:    Optional[str]   = None
    arrival_airport:      Optional[str]   = None
    scheduled_departure:  Optional[str]   = None
    actual_departure:     Optional[str]   = None
    scheduled_arrival:    Optional[str]   = None
    actual_arrival:       Optional[str]   = None
    temperature:          Optional[float] = None
    visibility:           Optional[float] = None
    wind_speed:           Optional[float] = None
    rainfall:             Optional[float] = None
    storm:                Optional[int]   = None
    airport_congestion:   Optional[float] = None
    runway_status:        Optional[str]   = None
    technical_issue:      Optional[int]   = None
    fuel_load:            Optional[float] = None
    distance:             Optional[float] = None
    altitude:             Optional[float] = None
    delay_minutes:        Optional[int]   = None
    deviation:            Optional[int]   = None
    created_at:           Optional[str]   = None

    model_config = {"from_attributes": True}


class FlightListResponse(BaseModel):
    flights: List[FlightResponse]
    total:   int


class PredictRequest(BaseModel):
    flight_id:          Optional[str]   = "MANUAL"
    temperature:        Optional[float] = 20.0
    visibility:         Optional[float] = 8000.0
    wind_speed:         Optional[float] = 10.0
    rainfall:           Optional[float] = 0.0
    storm:              Optional[int]   = 0
    airport_congestion: Optional[float] = 40.0
    technical_issue:    Optional[int]   = 0
    fuel_load:          Optional[float] = 70.0
    distance:           Optional[float] = 1000.0
    altitude:           Optional[float] = 35000.0
    delay_minutes:      Optional[int]   = 0


class PredictResponse(BaseModel):
    deviation_prob: float
    label:          int
    risk_level:     str
    confidence:     float
    model_used:     str


class AlertCreate(BaseModel):
    flight_id:  Optional[str] = ""
    alert_type: Optional[str] = "info"
    severity:   Optional[str] = "info"
    message:    str
