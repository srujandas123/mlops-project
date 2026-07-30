"""ML training and deviation prediction router."""
from typing import List
from fastapi import APIRouter, Query

from ..schemas.flight import PredictRequest
from ..services.ml_service import MLService

router = APIRouter(tags=["ML Pipeline"])


@router.post("/ml/train")
def trigger_train():
    return MLService.trigger_train()


@router.get("/ml/status")
def ml_status():
    return MLService.get_status()


@router.get("/ml/models")
def list_model_runs():
    return MLService.list_model_runs()


@router.get("/ml/feature-importance")
def feature_importance():
    return MLService.feature_importance()


@router.post("/predict")
def predict(body: PredictRequest):
    return MLService.predict_single(body.model_dump())


@router.post("/predict/batch")
def predict_batch(body: List[PredictRequest]):
    return MLService.predict_batch([b.model_dump() for b in body])


@router.get("/predictions/history")
def prediction_history(limit: int = Query(50, ge=1, le=500)):
    return MLService.prediction_history(limit)
