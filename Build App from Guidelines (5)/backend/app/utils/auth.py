"""PBKDF2-SHA256 password hashing + HMAC token helpers."""
import base64
import hashlib
import hmac
import json
import time

from ..config.settings import settings

_SECRET = settings.airways_secret


def hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), _SECRET.encode(), 200_000).hex()


def verify_password(password: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), stored_hash)


def make_token(user_id: int, username: str) -> str:
    payload = json.dumps({"user_id": user_id, "username": username, "exp": time.time() + 86400})
    sig     = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.b64encode(f"{payload}.{sig}".encode()).decode()


def verify_token(token: str) -> dict | None:
    try:
        decoded = base64.b64decode(token.encode()).decode()
        raw, sig = decoded.rsplit(".", 1)
        expected = hmac.new(_SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(raw)
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None
