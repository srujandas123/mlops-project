"""Application settings — loaded from environment / .env file."""
import os
from pathlib import Path

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    _PYDANTIC_SETTINGS = True
except ImportError:
    _PYDANTIC_SETTINGS = False

_BASE = Path(__file__).resolve().parents[3]  # /workspaces/default/code/backend

if _PYDANTIC_SETTINGS:
    class Settings(BaseSettings):
        model_config = SettingsConfigDict(
            env_file=str(_BASE / ".env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )

        # Server
        host: str = "0.0.0.0"
        port: int = 5000
        debug: bool = True

        # Security
        airways_secret: str = "airways-dev-secret-2024"

        # Database
        db_path: str = str(_BASE / "airways.db")

        # Logging
        log_dir: str = str(_BASE / "logs")

        # CORS
        cors_origins: str = "*"

    settings = Settings()

else:
    # Fallback when pydantic-settings not installed
    class _S:  # type: ignore
        host         = os.getenv("HOST", "0.0.0.0")
        port         = int(os.getenv("PORT", "5000"))
        debug        = os.getenv("DEBUG", "true").lower() == "true"
        airways_secret = os.getenv("AIRWAYS_SECRET", "airways-dev-secret-2024")
        db_path      = os.getenv("DB_PATH", str(_BASE / "airways.db"))
        log_dir      = str(_BASE / "logs")
        cors_origins = os.getenv("CORS_ORIGINS", "*")

    settings = _S()
