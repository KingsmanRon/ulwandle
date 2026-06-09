"""
Auth endpoints: login, refresh, logout, me, register, register-key.
"""

import base64
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_roles
from app.auth.schemas import (
    LoginRequest, RefreshRequest, RegisterPublicKey, RegisterRequest,
    TokenResponse, UserPublic,
)
from app.auth.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_ip, hash_password, password_needs_rehash, verify_password,
)
from app.core.config import settings
from app.core.net import get_client_ip
from app.db.database import get_db
from app.models.models import AuditLog, RefreshToken, User, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)

# Pre-computed real Argon2id hash used as a constant-time fallback when the
# email is not found, so login latency does not leak user existence.
_DUMMY_HASH = hash_password("constant-time-fallback-do-not-reuse")


def _user_public(u: User) -> UserPublic:
    return UserPublic(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=u.role.value,
        has_signing_key=bool(u.ed25519_public_key),
        is_active=u.is_active,
        last_login_at=u.last_login_at,
    )


def _safe_payload(payload: dict | None) -> dict | None:
    """Coerce payload values to JSON-safe primitives. Pydantic types like
    EmailStr are str subclasses but some JSON encoders trip on them."""
    if not payload:
        return payload
    out: dict = {}
    for k, v in payload.items():
        if isinstance(v, (str, int, float, bool)) or v is None:
            out[k] = str(v) if isinstance(v, str) else v
        else:
            out[k] = str(v)
    return out


def _record_audit(db: Session, *, actor: User | None, action: str,
                  resource_type: str | None = None, resource_id: str | None = None,
                  payload: dict | None = None, request: Request | None = None) -> None:
    try:
        ip = get_client_ip(request) if request else None
        db.add(AuditLog(
            actor_id=actor.id if actor else None,
            actor_email=actor.email if actor else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            payload=_safe_payload(payload),
            ip_hash=hash_ip(ip) if ip else None,
        ))
    except Exception:
        # Audit must never mask the real response. Roll back the staged audit
        # row and continue so the caller still gets a meaningful status code.
        logger.exception("Failed to stage audit log entry (action=%s)", action)
        db.rollback()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()

    # Constant-time work whether user exists or not, to discourage user enumeration.
    valid = verify_password(user.hashed_password if user else _DUMMY_HASH, body.password)

    if not user or not valid or not user.is_active:
        try:
            if user:
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                if user.failed_login_attempts >= 10:
                    user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                db.commit()
            _record_audit(db, actor=user, action="login.failure",
                          payload={"email": str(body.email)}, request=request)
            db.commit()
        except Exception:
            logger.exception("login.failure bookkeeping failed; returning 401 anyway")
            db.rollback()
        raise HTTPException(401, "Invalid credentials")

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(429, "Account temporarily locked. Try again later.")

    if password_needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(body.password)

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)

    access, ttl = create_access_token(user.id, user.role.value)
    jti = secrets.token_hex(16)
    refresh, refresh_exp = create_refresh_token(user.id, jti)

    ua = (request.headers.get("user-agent") or "")[:255]
    ip_h = hash_ip(get_client_ip(request))
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=refresh_exp,
                        user_agent=ua, ip_hash=ip_h))
    _record_audit(db, actor=user, action="login.success", request=request)
    db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=ttl,
        user=_user_public(user),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Refresh token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Wrong token type")

    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id or not user_id.isdigit():
        raise HTTPException(401, "Invalid refresh token")

    rt = db.query(RefreshToken).filter(RefreshToken.jti == jti).first()
    if not rt or rt.revoked or rt.user_id != int(user_id):
        raise HTTPException(401, "Refresh token revoked")
    if rt.expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Refresh token expired")

    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(401, "User not found")

    # Rotate the refresh token
    rt.revoked = True
    new_jti = secrets.token_hex(16)
    new_refresh, new_exp = create_refresh_token(user.id, new_jti)
    ua = (request.headers.get("user-agent") or "")[:255]
    ip_h = hash_ip(get_client_ip(request))
    db.add(RefreshToken(jti=new_jti, user_id=user.id, expires_at=new_exp,
                        user_agent=ua, ip_hash=ip_h))

    access, ttl = create_access_token(user.id, user.role.value)
    _record_audit(db, actor=user, action="token.refresh", request=request)
    db.commit()

    return TokenResponse(
        access_token=access,
        refresh_token=new_refresh,
        expires_in=ttl,
        user=_user_public(user),
    )


@router.post("/logout", status_code=204)
def logout(body: RefreshRequest, db: Session = Depends(get_db),
           current: User = Depends(get_current_user)):
    try:
        payload = decode_token(body.refresh_token)
    except pyjwt.InvalidTokenError:
        return
    jti = payload.get("jti")
    if jti:
        rt = db.query(RefreshToken).filter(RefreshToken.jti == jti,
                                           RefreshToken.user_id == current.id).first()
        if rt:
            rt.revoked = True
            db.commit()


@router.get("/me", response_model=UserPublic)
def me(current: User = Depends(get_current_user)):
    return _user_public(current)


@router.put("/me/signing-key", response_model=UserPublic)
def register_signing_key(
    body: RegisterPublicKey,
    request: Request,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate the key is well-formed Ed25519 (32 raw bytes -> 44 chars padded base64)
    try:
        raw = base64.b64decode(body.ed25519_public_key, validate=True)
    except Exception:
        raise HTTPException(400, "Public key is not valid base64")
    if len(raw) != 32:
        raise HTTPException(400, "Ed25519 public key must be 32 bytes")

    current.ed25519_public_key = body.ed25519_public_key
    _record_audit(db, actor=current, action="auth.signing_key.registered", request=request)
    db.commit()
    db.refresh(current)
    return _user_public(current)


# Admin-only user provisioning. First user must be created out-of-band via a CLI bootstrap.
@router.post("/users", response_model=UserPublic, status_code=201)
def create_user(
    body: RegisterRequest,
    request: Request,
    current: User = Depends(require_roles(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(409, "Email already registered")
    user = User(
        email=body.email.lower(),
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=UserRole(body.role),
    )
    db.add(user)
    db.flush()
    _record_audit(db, actor=current, action="user.created",
                  resource_type="user", resource_id=str(user.id),
                  payload={"email": user.email, "role": user.role.value},
                  request=request)
    db.commit()
    db.refresh(user)
    return _user_public(user)
