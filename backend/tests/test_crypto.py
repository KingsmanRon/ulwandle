"""
Unit tests for the cryptographic primitives that gate every safety-critical
path: password hashing, JWT issuance/verification, Ed25519 signature
verification, and HMAC computation.
"""

from __future__ import annotations

import base64
import time

import jwt as pyjwt
import pytest
from nacl.signing import SigningKey

from app.auth.security import (
    canonical_op_message, compute_ingest_hmac, constant_time_eq,
    create_access_token, create_refresh_token, decode_token, hash_ip,
    hash_password, password_needs_rehash, verify_ed25519, verify_password,
)


# ---------- Passwords ----------

def test_hash_password_then_verify_round_trip():
    h = hash_password("Correct-Horse-Battery-Staple-9")
    assert verify_password(h, "Correct-Horse-Battery-Staple-9") is True


def test_verify_password_wrong_password_is_false():
    h = hash_password("right-password-123!")
    assert verify_password(h, "wrong-password-123!") is False


def test_verify_password_on_garbage_hash_is_false_not_500():
    # Must never raise — the login route relies on always-False fallback.
    assert verify_password("not-a-valid-argon2-hash", "anything") is False
    assert verify_password("", "anything") is False


def test_password_needs_rehash_smoke():
    h = hash_password("12345678901234")
    # Fresh hash should not need rehash with the same parameters.
    assert password_needs_rehash(h) is False
    # An invalid hash signals "needs rehash" — the route treats it as
    # "store a new hash on next successful login".
    assert password_needs_rehash("$argon2id$v=19$m=garbage") is True


# ---------- JWT ----------

def test_access_token_roundtrip_carries_role_and_sub():
    token, ttl = create_access_token(user_id=7, role="operator")
    assert ttl > 0
    decoded = decode_token(token)
    assert decoded["sub"] == "7"
    assert decoded["role"] == "operator"
    assert decoded["type"] == "access"
    assert decoded["jti"]
    assert decoded["exp"] > decoded["iat"]


def test_refresh_token_marks_type_refresh():
    token, exp = create_refresh_token(user_id=7, jti="abc123")
    decoded = decode_token(token)
    assert decoded["type"] == "refresh"
    assert decoded["jti"] == "abc123"
    assert exp.tzinfo is not None  # must be aware


def test_decode_rejects_tampered_signature():
    token, _ = create_access_token(user_id=42, role="admin")
    head, payload, sig = token.split(".")
    tampered = ".".join([head, payload, sig[:-2] + "AA"])
    with pytest.raises(pyjwt.InvalidTokenError):
        decode_token(tampered)


def test_decode_rejects_expired_token():
    """Hand-craft a token with `exp` already in the past, signed with the
    correct secret. pyjwt must report ExpiredSignatureError."""
    from app.auth.security import _secret
    from app.core.config import settings
    expired = pyjwt.encode(
        {"sub": "1", "role": "viewer", "type": "access",
         "iat": 0, "exp": 1, "jti": "abc"},
        _secret(), algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(pyjwt.ExpiredSignatureError):
        decode_token(expired)


# ---------- Ed25519 ----------

def _signing_pair():
    sk = SigningKey.generate()
    vk = sk.verify_key
    return sk, base64.b64encode(vk.encode()).decode()


def test_verify_ed25519_accepts_good_signature():
    sk, vk_b64 = _signing_pair()
    msg = b"v1|propose|valve-1|close|nonce-x|2026-05-20T12:00:00+00:00"
    sig = base64.b64encode(sk.sign(msg).signature).decode()
    assert verify_ed25519(vk_b64, sig, msg) is True


def test_verify_ed25519_rejects_signature_for_different_message():
    sk, vk_b64 = _signing_pair()
    sig = base64.b64encode(sk.sign(b"original-message").signature).decode()
    assert verify_ed25519(vk_b64, sig, b"tampered-message") is False


def test_verify_ed25519_rejects_signature_from_different_key():
    sk1, _ = _signing_pair()
    _, vk2_b64 = _signing_pair()
    msg = b"hello"
    sig = base64.b64encode(sk1.sign(msg).signature).decode()
    assert verify_ed25519(vk2_b64, sig, msg) is False


def test_verify_ed25519_handles_garbage_inputs_safely():
    assert verify_ed25519("not-base64-!@#", "also-not", b"x") is False
    assert verify_ed25519("", "", b"x") is False


# ---------- Canonical message ----------

def test_canonical_op_message_binds_role_and_proposer():
    """An approver signature MUST commit to the proposer_id so a
    proposer's own signature can't be reused as approval."""
    propose = canonical_op_message(
        "valve-1", "close", "nonce-1", "2026-05-20T12:00:00+00:00",
        role="propose",
    )
    approve = canonical_op_message(
        "valve-1", "close", "nonce-1", "2026-05-20T12:00:00+00:00",
        role="approve", proposer_id=42,
    )
    assert propose != approve
    assert b"propose" in propose
    assert b"approve" in approve
    assert b"42" in approve


def test_canonical_op_message_changes_with_any_field():
    base = canonical_op_message("v", "close", "n", "t", role="propose")
    assert base != canonical_op_message("v2", "close", "n", "t", role="propose")
    assert base != canonical_op_message("v", "open", "n", "t", role="propose")
    assert base != canonical_op_message("v", "close", "n2", "t", role="propose")
    assert base != canonical_op_message("v", "close", "n", "t2", role="propose")


# ---------- HMAC for sensor ingestion ----------

def test_compute_ingest_hmac_is_deterministic():
    secret = "sensor-secret-abc"
    body = b'{"flow_rate": 12.3}'
    ts = "2026-05-20T12:00:00+00:00"
    a = compute_ingest_hmac(secret, body, ts)
    b = compute_ingest_hmac(secret, body, ts)
    assert a == b
    assert len(a) == 64  # hex sha256


def test_compute_ingest_hmac_differs_with_any_input_change():
    base = compute_ingest_hmac("k", b"body", "ts")
    assert base != compute_ingest_hmac("k2", b"body", "ts")
    assert base != compute_ingest_hmac("k", b"body2", "ts")
    assert base != compute_ingest_hmac("k", b"body", "ts2")


def test_constant_time_eq_is_correct_for_matches_and_mismatches():
    assert constant_time_eq("aaa", "aaa") is True
    assert constant_time_eq("aaa", "aab") is False
    assert constant_time_eq("", "") is True


# ---------- IP hashing ----------

def test_hash_ip_is_deterministic_and_not_reversible():
    a = hash_ip("203.0.113.7")
    b = hash_ip("203.0.113.7")
    c = hash_ip("203.0.113.8")
    assert a == b
    assert a != c
    assert "203.0.113" not in a  # never store the raw IP
