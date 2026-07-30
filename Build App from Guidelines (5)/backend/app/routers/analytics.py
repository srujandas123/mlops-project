"""Analytics endpoints router."""
from fastapi import APIRouter

from ..services.flight_service import FlightService

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/overview")
def overview():
    return FlightService.analytics_overview()


@router.get("/by-airline")
def by_airline():
    return FlightService.analytics_by_airline()


@router.get("/by-airport")
def by_airport():
    return FlightService.analytics_by_airport()


@router.get("/delay-distribution")
def delay_distribution():
    return FlightService.analytics_delay_distribution()


@router.get("/weather-impact")
def weather_impact():
    return FlightService.analytics_weather_impact()


@router.get("/top-routes")
def top_routes():
    return FlightService.analytics_top_routes()


@router.get("/stats")
def stats():
    return FlightService.analytics_stats()
