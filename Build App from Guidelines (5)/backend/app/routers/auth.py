"""Authentication endpoints."""
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime

from ..schemas.auth import LoginRequest, RegisterRequest, RoleUpdate
from ..utils import auth as auth_utils
from ..database.connection import get_conn, log_event

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(body: LoginRequest):
    conn = get_conn()
    row  = conn.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    if not row or not auth_utils.verify_password(body.password, row["password_hash"]):
        conn.close()
        log_event("warning", "auth", f"Failed login: {body.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    now = datetime.utcnow().isoformat()
    conn.execute("UPDATE users SET last_login=? WHERE id=?", (now, row["id"]))
    conn.commit()
    conn.close()

    token = auth_utils.make_token(row["id"], row["username"])
    log_event("info", "auth", f"Login: {body.username}")
    return {
        "token":    token,
        "username": row["username"],
        "name":     row["name"] or row["username"],
        "email":    row["email"] or "",
        "role":     row["role"],
        "message":  "Login successful",
    }


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    role = body.role if body.role in ("admin", "operator", "viewer") else "operator"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users (name, email, username, password_hash, role) VALUES (?,?,?,?,?)",
            (body.name, body.email, body.username, auth_utils.hash_password(body.password), role),
        )
        conn.commit()
    except Exception:
        raise HTTPException(status_code=409, detail="Username already exists")
    finally:
        conn.close()
    log_event("info", "auth", f"Registered: {body.username} ({role})")
    return {"status": "registered", "username": body.username, "role": role}


@router.post("/verify")
def verify_token(authorization: str = Header("", alias="Authorization")):
    token   = authorization.removeprefix("Bearer ").strip()
    payload = auth_utils.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"valid": True, "username": payload["username"], "user_id": payload["user_id"]}


@router.post("/logout")
def logout():
    return {"status": "logged out"}


@router.get("/users")
def list_users():
    conn  = get_conn()
    rows  = conn.execute(
        "SELECT id, name, email, username, role, last_login, created_at FROM users ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.put("/users/{user_id}/role")
def change_role(user_id: int, body: RoleUpdate):
    if body.role not in ("admin", "operator", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    conn = get_conn()
    conn.execute("UPDATE users SET role=? WHERE id=?", (body.role, user_id))
    conn.commit()
    conn.close()
    return {"status": "updated", "role": body.role}
