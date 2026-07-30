"""Pydantic v2 schemas for authentication."""
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    name:     str = Field(min_length=1)
    email:    str = Field(min_length=3)
    username: str = Field(min_length=3)
    password: str = Field(min_length=6)
    role:     Literal["admin", "operator", "viewer"] = "operator"


class TokenResponse(BaseModel):
    token:    str
    username: str
    name:     str
    email:    str
    role:     str
    message:  str


class UserResponse(BaseModel):
    id:         int
    username:   str
    name:       Optional[str] = None
    email:      Optional[str] = None
    role:       str
    last_login: Optional[str] = None
    created_at: Optional[str] = None


class RoleUpdate(BaseModel):
    role: Literal["admin", "operator", "viewer"]
