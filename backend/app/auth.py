"""Passwords and sign-in sessions.

Passwords are stored as scrypt hashes, never as text. A session is a random
token kept in an HttpOnly cookie; the database stores only its hash, so a
leaked database can't be used to sign in.
"""

import datetime as dt
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m
from .db import get_session

COOKIE = "session"
SESSION_DAYS = 30

# scrypt cost settings (OWASP's recommended minimum).
N, R, P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P)
    return f"scrypt${N}${R}${P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, n, r, p, salt, digest = stored.split("$")
        check = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(check.hex(), digest)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(session: Session, user: m.User) -> str:
    """Creates a session and returns the token to put in the cookie."""
    token = secrets.token_urlsafe(32)
    session.add(
        m.UserSession(
            id=_token_hash(token),
            user_id=user.id,
            expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=SESSION_DAYS),
        )
    )
    return token


def end_session(session: Session, token: str | None) -> None:
    if token:
        record = session.get(m.UserSession, _token_hash(token))
        if record:
            session.delete(record)


def signed_in_user(request: Request, session: Session = Depends(get_session)) -> m.User:
    token = request.cookies.get(COOKIE)
    record = session.get(m.UserSession, _token_hash(token)) if token else None
    expires = record.expires_at if record else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=dt.timezone.utc)  # SQLite drops the timezone
    if record is None or expires < dt.datetime.now(dt.timezone.utc):
        raise HTTPException(status_code=401, detail="Please sign in.")
    user = session.get(m.User, record.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user


def require_admin(user: m.User = Depends(signed_in_user)) -> m.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="This page is for program admins.")
    return user


def find_user(session: Session, email: str) -> m.User | None:
    return session.scalars(select(m.User).where(func.lower(m.User.email) == email.strip().lower())).first()
