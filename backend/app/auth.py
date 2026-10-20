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
MIN_PASSWORD = 10
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15

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


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def as_utc(value: dt.datetime) -> dt.datetime:
    """SQLite drops the timezone; everything is stored in UTC."""
    return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)


def is_locked(user: m.User) -> bool:
    return user.locked_until is not None and as_utc(user.locked_until) > dt.datetime.now(dt.timezone.utc)


def record_login(user: m.User, success: bool) -> None:
    """Counts wrong passwords; too many in a row locks the account for a while."""
    if success:
        user.failed_logins, user.locked_until = 0, None
        return
    user.failed_logins = (user.failed_logins or 0) + 1
    if user.failed_logins >= MAX_FAILED_LOGINS:
        user.failed_logins = 0
        user.locked_until = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=LOCK_MINUTES)


def start_session(session: Session, user: m.User) -> str:
    """Creates a session and returns the token to put in the cookie."""
    token = secrets.token_urlsafe(32)
    session.add(
        m.UserSession(
            id=token_hash(token),
            user_id=user.id,
            expires_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=SESSION_DAYS),
        )
    )
    return token


def end_session(session: Session, token: str | None) -> None:
    if token:
        record = session.get(m.UserSession, token_hash(token))
        if record:
            session.delete(record)


def signed_in_user(request: Request, session: Session = Depends(get_session)) -> m.User:
    token = request.cookies.get(COOKIE)
    record = session.get(m.UserSession, token_hash(token)) if token else None
    if record is None or as_utc(record.expires_at) < dt.datetime.now(dt.timezone.utc):
        raise HTTPException(status_code=401, detail="Please sign in.")
    user = session.get(m.User, record.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return user


def require_admin(user: m.User = Depends(signed_in_user)) -> m.User:
    if user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="This page is for program admins.")
    return user


def require_manager(user: m.User = Depends(signed_in_user)) -> m.User:
    if user.role != "manager":
        raise HTTPException(status_code=403, detail="Only a manager can do this.")
    return user


def find_user(session: Session, email: str) -> m.User | None:
    return session.scalars(select(m.User).where(func.lower(m.User.email) == email.strip().lower())).first()
