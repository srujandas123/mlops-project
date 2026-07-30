"""Alerts management + system logs endpoints."""
from fastapi import APIRouter, Query

from ..schemas.flight import AlertCreate
from ..services.alert_service import AlertService

router = APIRouter(tags=["Alerts"])


@router.get("/alerts")
def list_alerts(
    severity: str = Query("", description="Filter by severity"),
    limit: int = Query(100, ge=1, le=500),
):
    return AlertService.list_alerts(severity or None, limit)


@router.post("/alerts", status_code=201)
def create_alert(body: AlertCreate):
    return AlertService.create_alert(body.model_dump())


@router.put("/alerts/acknowledge-all")
def acknowledge_all():
    return AlertService.acknowledge_all()


@router.put("/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: int):
    return AlertService.acknowledge(alert_id)


@router.put("/alerts/{alert_id}/dismiss")
def dismiss(alert_id: int):
    return AlertService.dismiss(alert_id)


@router.delete("/alerts/{alert_id}")
def delete_alert(alert_id: int):
    return AlertService.delete(alert_id)


@router.get("/logs")
def list_logs(
    level: str = Query("", description="Filter by log level"),
    limit: int = Query(200, ge=1, le=1000),
):
    return AlertService.list_logs(level or None, limit)
