"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database.connection import init_db
from .middleware import register_middleware
from .routers import (
    flights_router,
    predictions_router,
    analytics_router,
    weather_router,
    alerts_router,
    auth_router,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

_BASE = Path(__file__).parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Airways ATC API",
    version="2.0.0",
    description="Professional FastAPI backend for the Airways ATC management system.",
    lifespan=lifespan,
)

register_middleware(app)

API = "/api"
app.include_router(auth_router,        prefix=API)
app.include_router(flights_router,     prefix=API)
app.include_router(predictions_router, prefix=API)
app.include_router(analytics_router,   prefix=API)
app.include_router(weather_router,     prefix=API)
app.include_router(alerts_router,      prefix=API)

_static = _BASE / "static"
_static.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static)), name="static")


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
