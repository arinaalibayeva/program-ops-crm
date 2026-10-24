"""Who can sign in: invitations, one-time password links and removing access.

A manager invites someone, which creates an account with no password and a
one-time link. Opening the link sets the password. The same links reset a
forgotten password. Only a hash of each token is stored.
"""

import datetime as dt
import secrets

from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..auth import MIN_PASSWORD, as_utc, find_user, hash_password, token_hash
from .actions import EMAIL, bad_request, new_id, not_found

INVITE_DAYS = 7


def _expired(invite: m.Invite) -> bool:
    return as_utc(invite.expires_at) < m.now()


def _new_link(session: Session, user: m.User, created_by: str) -> str:
    """Replaces any earlier link for this person and returns the new token."""
    session.execute(delete(m.Invite).where(m.Invite.user_id == user.id))
    token = secrets.token_urlsafe(32)
    session.add(
        m.Invite(
            id=token_hash(token), user_id=user.id, created_by=created_by,
            expires_at=m.now() + dt.timedelta(days=INVITE_DAYS),
        )
    )
    return token


def member_schema(session: Session, user: m.User) -> s.TeamMember:
    invite = session.scalars(select(m.Invite).where(m.Invite.user_id == user.id)).first()
    if user.password_hash:
        status = "active"
    else:
        status = "expired" if invite is None or _expired(invite) else "invited"
    return s.TeamMember(id=user.id, name=user.name, email=user.email, role=user.role, status=status)


def members(session: Session) -> list[s.TeamMember]:
    users = session.scalars(select(m.User).where(m.User.role != "participant").order_by(m.User.created_at))
    return [member_schema(session, u) for u in users]


def invite(session: Session, inviter: m.User, body: s.InviteCreate) -> s.InviteLink:
    name, email = body.name.strip(), body.email.strip()
    if not name:
        raise bad_request("Enter their name.")
    if not EMAIL.match(email):
        raise bad_request("Enter a valid email.")
    if find_user(session, email):
        raise bad_request("Someone with this email already has an account.")
    user = m.User(id=new_id("user"), name=name, email=email, role=body.role)
    session.add(user)
    session.flush()
    token = _new_link(session, user, inviter.name)
    session.flush()
    return s.InviteLink(member=member_schema(session, user), token=token)


def _member(session: Session, user_id: str) -> m.User:
    user = session.get(m.User, user_id)
    if user is None or user.role == "participant":
        raise not_found("Person")
    return user


def new_link(session: Session, manager: m.User, user_id: str) -> s.InviteLink:
    """A fresh link: to resend an invite, or to reset a forgotten password."""
    user = _member(session, user_id)
    token = _new_link(session, user, manager.name)
    session.flush()
    return s.InviteLink(member=member_schema(session, user), token=token)


def _other_managers(session: Session, user: m.User) -> bool:
    return (
        session.scalars(
            select(m.User.id).where(
                m.User.role == "manager", m.User.id != user.id, m.User.password_hash.is_not(None)
            )
        ).first()
        is not None
    )


def change_role(session: Session, manager: m.User, user_id: str, role: str) -> None:
    user = _member(session, user_id)
    if user.role == "manager" and role != "manager" and not _other_managers(session, user):
        raise bad_request("The program needs at least one manager.")
    user.role = role


def remove(session: Session, manager: m.User, user_id: str) -> None:
    user = _member(session, user_id)
    if user.id == manager.id:
        raise bad_request("You can't remove yourself.")
    session.execute(delete(m.Invite).where(m.Invite.user_id == user.id))
    session.execute(delete(m.UserSession).where(m.UserSession.user_id == user.id))
    session.execute(delete(m.PersonalItem).where(m.PersonalItem.user_id == user.id))
    session.execute(update(m.Team).where(m.Team.owner_id == user.id).values(owner_id=None))
    session.execute(update(m.Partner).where(m.Partner.owner_id == user.id).values(owner_id=None))
    session.delete(user)


def _open_invite(session: Session, token: str) -> m.Invite:
    invite_ = session.get(m.Invite, token_hash(token))
    if invite_ is None:
        raise HTTPException(status_code=404, detail="This link isn't valid or has already been used.")
    if _expired(invite_):
        raise HTTPException(status_code=410, detail="This link has expired. Ask your manager for a new one.")
    return invite_


def invite_info(session: Session, token: str, program_name: str | None) -> s.InviteInfo:
    invite_ = _open_invite(session, token)
    user = session.get(m.User, invite_.user_id)
    return s.InviteInfo(
        name=user.name, email=user.email, program_name=program_name, is_reset=bool(user.password_hash),
        invited_by=invite_.created_by,
    )


def accept(session: Session, token: str, password: str) -> m.User:
    """Sets the password, uses up the link and signs out any old sessions."""
    invite_ = _open_invite(session, token)
    if len(password) < MIN_PASSWORD:
        raise bad_request(f"Use at least {MIN_PASSWORD} characters.")
    user = session.get(m.User, invite_.user_id)
    user.password_hash = hash_password(password)
    user.failed_logins = 0
    user.locked_until = None
    session.delete(invite_)
    session.execute(delete(m.UserSession).where(m.UserSession.user_id == user.id))
    return user
