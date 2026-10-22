"""Someone's own to-dos and quick notes. Always scoped to the signed-in person."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..auth import as_utc
from .actions import bad_request, given_id


def items(session: Session, user: m.User) -> list[s.PersonalItem]:
    rows = session.scalars(
        select(m.PersonalItem)
        .where(m.PersonalItem.user_id == user.id)
        .order_by(m.PersonalItem.created_at.desc(), m.PersonalItem.id)
    )
    return [
        s.PersonalItem(
            id=r.id, kind=r.kind, body=r.body, description=r.description, done=r.done,
            created_at=as_utc(r.created_at),
        )
        for r in rows
    ]


def _body(body: str) -> str:
    body = body.strip()
    if not body:
        raise bad_request("Write something first.")
    if len(body) > 2000:
        raise bad_request("Keep it under 2,000 characters.")
    return body


def _description(description: str | None) -> str | None:
    description = (description or "").strip()
    if len(description) > 2000:
        raise bad_request("Keep the description under 2,000 characters.")
    return description or None


def _item(session: Session, user: m.User, item_id: str) -> m.PersonalItem:
    item = session.get(m.PersonalItem, item_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


def add(session: Session, user: m.User, body: s.PersonalItemIn) -> None:
    session.add(
        m.PersonalItem(
            id=given_id(session, m.PersonalItem, body.id, "item"), user_id=user.id, kind=body.kind,
            body=_body(body.body), description=_description(body.description),
        )
    )


def update(session: Session, user: m.User, item_id: str, patch: s.PersonalItemPatch) -> None:
    item = _item(session, user, item_id)
    if patch.body is not None:
        item.body = _body(patch.body)
    if "description" in patch.model_fields_set:
        item.description = _description(patch.description)
    if patch.done is not None:
        item.done = patch.done


def remove(session: Session, user: m.User, item_id: str) -> None:
    session.delete(_item(session, user, item_id))
