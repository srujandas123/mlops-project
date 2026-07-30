from .flights     import router as flights_router
from .predictions import router as predictions_router
from .analytics   import router as analytics_router
from .weather     import router as weather_router
from .alerts      import router as alerts_router
from .auth        import router as auth_router

__all__ = [
    "flights_router", "predictions_router", "analytics_router",
    "weather_router", "alerts_router", "auth_router",
]
