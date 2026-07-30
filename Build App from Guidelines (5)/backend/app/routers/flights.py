"""Flight CRUD + CSV upload/export router."""
import io
import csv
from typing import Optional
from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from ..schemas.flight import FlightCreate, FlightUpdate
from ..services.flight_service import FlightService

router = APIRouter(prefix="/flights", tags=["Flights"])


@router.get("")
def list_flights(
    q:      str = Query("", description="Search query"),
    limit:  int = Query(200, ge=1, le=1000),
    offset: int = Query(0,   ge=0),
):
    return FlightService.list_flights(q, limit, offset)


@router.get("/export/csv")
def export_csv():
    return FlightService.export_csv()


@router.get("/{flight_id}")
def get_flight(flight_id: str):
    return FlightService.get_flight(flight_id)


@router.post("", status_code=201)
def create_flight(body: FlightCreate):
    return FlightService.create_flight(body.model_dump())


@router.put("/{flight_id}")
def update_flight(flight_id: str, body: FlightUpdate):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    return FlightService.update_flight(flight_id, data)


@router.delete("/{flight_id}")
def delete_flight(flight_id: str):
    return FlightService.delete_flight(flight_id)


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    content = await file.read()
    return FlightService.upload_csv(content)
