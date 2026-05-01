"""
FastAPI dependencies for authentication and authorization.
"""

from typing import Iterable

import jwt as pyjwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.security import decode_token
from app.db.database import get_db
from app.models.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Authentication required")

    try:
        payload = decode_token(credentials.credentials)
    except pyjwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except pyjwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    if payload.get("type") != "access":
        raise _unauthorized("Wrong token type")

    user_id = payload.get("sub")
    if not user_id or not user_id.isdigit():
        raise _unauthorized("Invalid token subject")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise _unauthorized("User not found or inactive")

    request.state.user = user
    return user


def require_roles(*allowed: UserRole | str):
    allowed_values = {r.value if isinstance(r, UserRole) else r for r in allowed}

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role.value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges",
            )
        return user

    return _check


def require_any_authenticated() -> callable:
    return get_current_user
