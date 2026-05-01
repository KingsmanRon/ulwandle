"""
Pydantic schemas for auth.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: "UserPublic"


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=4096)


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    has_signing_key: bool
    is_active: bool
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=12, max_length=256)
    role: str = Field(pattern="^(admin|supervisor|operator|viewer)$")


class RegisterPublicKey(BaseModel):
    ed25519_public_key: str = Field(min_length=43, max_length=64)


TokenResponse.model_rebuild()
