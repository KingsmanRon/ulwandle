"""
Cryptographic primitives: password hashing, JWT issuance/verification,
Ed25519 signature verification, and canonical operation messages.
"""

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher, profiles
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

from app.core.config import settings


# Argon2id with sensible defaults — tune for hardware via profiles.RFC_9106_LOW_MEMORY
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=2,
    hash_len=32,
    salt_len=16,
)


# ---------- Passwords ----------

def hash_password(plain: str) -> str:
    return _password_hasher.hash(plain)


def verify_password(hashed: str, plain: str) -> bool:
    try:
        return _password_hasher.verify(hashed, plain)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False
    except Exception:
        # Any other argon2/runtime error must be treated as "invalid", never
        # surface as a 500 — the route must only ever return 200 or 401.
        return False


def password_needs_rehash(hashed: str) -> bool:
    try:
        return _password_hasher.check_needs_rehash(hashed)
    except InvalidHashError:
        return True


# ---------- JWT ----------

def _secret() -> str:
    return settings.SECRET_KEY.get_secret_value()


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=settings.JWT_ACCESS_TTL_SECONDS)
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "type": "access",
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, _secret(), algorithm=settings.JWT_ALGORITHM), settings.JWT_ACCESS_TTL_SECONDS


def create_refresh_token(user_id: int, jti: str) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=settings.JWT_REFRESH_TTL_SECONDS)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, _secret(), algorithm=settings.JWT_ALGORITHM), exp


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _secret(), algorithms=[settings.JWT_ALGORITHM])


# ---------- Ed25519 ----------

def verify_ed25519(public_key_b64: str, signature_b64: str, message: bytes) -> bool:
    try:
        vk = VerifyKey(base64.b64decode(public_key_b64, validate=True))
        sig = base64.b64decode(signature_b64, validate=True)
    except (ValueError, TypeError):
        return False
    try:
        vk.verify(message, sig)
        return True
    except BadSignatureError:
        return False


def canonical_op_message(
    valve_id: str,
    action: str,
    nonce: str,
    issued_at_iso: str,
    role: str,                 # "propose" or "approve"
    proposer_id: int | None = None,
) -> bytes:
    """
    Canonical, version-tagged byte string the operator's key signs.
    Including the role and proposer_id binds an approver's signature
    to the specific proposal — preventing signature reuse.
    """
    parts = ["v1", role, valve_id, action, nonce, issued_at_iso]
    if proposer_id is not None:
        parts.append(str(proposer_id))
    return ("|".join(parts)).encode("utf-8")


# ---------- HMAC for sensor ingest ----------

def compute_ingest_hmac(secret: str, body: bytes, timestamp: str) -> str:
    mac = hmac.new(secret.encode("utf-8"), digestmod=hashlib.sha256)
    mac.update(timestamp.encode("utf-8"))
    mac.update(b".")
    mac.update(body)
    return mac.hexdigest()


def constant_time_eq(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def hash_ip(ip: str) -> str:
    return hashlib.sha256((settings.SECRET_KEY.get_secret_value() + "|" + ip).encode("utf-8")).hexdigest()
