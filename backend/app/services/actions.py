"""Everything the app can change. Each function mirrors an action in
frontend/lib/store.tsx and leaves committing to the caller."""

import datetime as dt
import re
import secrets

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4)}"


def bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=message)


def not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found.")


def _enrollment(session: Session, cohort: m.Cohort, enrollment_id: str) -> m.Enrollment:
    e = session.get(m.Enrollment, enrollment_id)
    if e is None or e.cohort_id != cohort.id:
        raise not_found("Participant")
    return e


def _event(session: Session, cohort: m.Cohort, event_id: str) -> m.Event:
    e = session.get(m.Event, event_id)
    if e is None or e.cohort_id != cohort.id:
        raise not_found("Event")
    return e


def _requirement(session: Session, cohort: m.Cohort, requirement_id: str) -> m.Requirement:
    r = session.get(m.Requirement, requirement_id)
    if r is None or r.cohort_id != cohort.id:
        raise not_found("Requirement")
    return r


def _field(session: Session, cohort: m.Cohort, field_id: str) -> m.FieldDefinition:
    f = session.get(m.FieldDefinition, field_id)
    if f is None or f.program_id != cohort.program_id:
        raise not_found("Field")
    return f


def _is_empty(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


# ---- Attendance ----


def toggle_attendance(session: Session, cohort: m.Cohort, event_id: str, enrollment_id: str) -> None:
    _event(session, cohort, event_id)
    _enrollment(session, cohort, enrollment_id)
    record = session.get(m.Attendance, (event_id, enrollment_id))
    if record:
        session.delete(record)
    else:
        session.add(m.Attendance(event_id=event_id, enrollment_id=enrollment_id, source="manual"))


def checkin_event(session: Session, token: str) -> m.Event:
    event = session.scalars(select(m.Event).where(m.Event.checkin_token == token)).first()
    if event is None:
        raise not_found("Check-in link")
    return event


def check_in(session: Session, event: m.Event, email: str, today: dt.date) -> s.CheckinResult:
    """Self check-in from the event link. Open only on the event's day(s)."""
    if today < event.date:
        return s.CheckinResult(status="not_open")
    if today > (event.end_date or event.date):
        return s.CheckinResult(status="closed")

    person = session.scalars(
        select(m.Person).where(func.lower(m.Person.email) == email.strip().lower())
    ).first()
    enrollment = (
        session.scalars(
            select(m.Enrollment).where(
                m.Enrollment.person_id == person.id,
                m.Enrollment.cohort_id == event.cohort_id,
                m.Enrollment.status == "active",
            )
        ).first()
        if person
        else None
    )
    if person is None or enrollment is None:
        return s.CheckinResult(status="not_found")

    first_name = person.name.split(" ")[0]
    if session.get(m.Attendance, (event.id, enrollment.id)):
        return s.CheckinResult(status="already_checked_in", first_name=first_name)
    session.add(m.Attendance(event_id=event.id, enrollment_id=enrollment.id, source="link"))
    return s.CheckinResult(status="checked_in", first_name=first_name)


# ---- Requirements ----


def toggle_completion(
    session: Session, cohort: m.Cohort, requirement_id: str, subject_id: str, today: dt.date
) -> None:
    _requirement(session, cohort, requirement_id)
    record = session.get(m.Completion, (requirement_id, subject_id))
    if record:
        session.delete(record)
    else:
        session.add(m.Completion(requirement_id=requirement_id, subject_id=subject_id, completed_at=today))


def _validate_requirement(req: s.RequirementIn) -> None:
    p = req.params
    if req.type == "attendance_min":
        if req.scope != "participant":
            raise bad_request("Attendance requirements apply to participants.")
        if not isinstance(p.get("category"), str) or not isinstance(p.get("minCount"), int) or p["minCount"] < 1:
            raise bad_request("Attendance requirements need a category and a minimum of at least 1.")
    elif req.type == "complete_by":
        try:
            dt.date.fromisoformat(p.get("dueDate", ""))
        except (TypeError, ValueError):
            raise bad_request("Deadline requirements need a due date.") from None
    elif req.type == "team_min_size":
        if req.scope != "team":
            raise bad_request("Team size requirements apply to teams.")
        if not isinstance(p.get("minActive"), int) or p["minActive"] < 1:
            raise bad_request("Team size requirements need a minimum of at least 1.")


def add_requirement(session: Session, cohort: m.Cohort, req: s.RequirementIn) -> None:
    if not req.name.strip():
        raise bad_request("Enter a name.")
    _validate_requirement(req)
    position = session.scalar(
        select(func.coalesce(func.max(m.Requirement.position), -1)).where(m.Requirement.cohort_id == cohort.id)
    )
    session.add(
        m.Requirement(
            id=new_id("req"), cohort_id=cohort.id, name=req.name.strip(), scope=req.scope,
            type=req.type, params=req.params, position=position + 1,
        )
    )


def delete_requirement(session: Session, cohort: m.Cohort, requirement_id: str) -> None:
    req = _requirement(session, cohort, requirement_id)
    session.execute(delete(m.Completion).where(m.Completion.requirement_id == req.id))
    session.execute(delete(m.Exemption).where(m.Exemption.requirement_id == req.id))
    session.delete(req)


# ---- Participants ----

EMAIL = re.compile(r"^\S+@\S+\.\S+$")


def _validate_fields(session: Session, cohort: m.Cohort, values: dict) -> None:
    missing = [
        f.label
        for f in session.scalars(
            select(m.FieldDefinition)
            .where(m.FieldDefinition.program_id == cohort.program_id, m.FieldDefinition.archived.is_(False))
            .order_by(m.FieldDefinition.position)
        )
        if f.required and f.type != "checkbox" and _is_empty(values.get(f.id))
    ]
    if missing:
        raise bad_request(f"Fill in {', '.join(missing)}.")


def update_participant(
    session: Session, cohort: m.Cohort, enrollment_id: str, draft: s.ParticipantDraft, today: dt.date
) -> None:
    """Saves edit mode in one step: profile, team, attendance and requirements."""
    enrollment = _enrollment(session, cohort, enrollment_id)
    person = session.get(m.Person, enrollment.person_id)

    name = draft.name.strip()
    email = draft.email.strip()
    if not name:
        raise bad_request("Enter a name.")
    if not EMAIL.match(email):
        raise bad_request("Enter a valid email.")
    taken = session.scalars(
        select(m.Person).where(func.lower(m.Person.email) == email.lower(), m.Person.id != person.id)
    ).first()
    if taken:
        raise bad_request("Another person already uses this email.")
    _validate_fields(session, cohort, draft.fields)

    person.name = name
    person.email = email
    enrollment.fields = {k: v for k, v in draft.fields.items() if not _is_empty(v)}

    # Team: close the current membership and open a new one, keeping history.
    current = session.scalars(
        select(m.TeamMembership).where(
            m.TeamMembership.enrollment_id == enrollment.id, m.TeamMembership.end_date.is_(None)
        )
    ).first()
    current_team = current.team_id if current else None
    if current_team != draft.team_id:
        if current:
            current.end_date = today
        if draft.team_id:
            team = session.get(m.Team, draft.team_id)
            if team is None or team.cohort_id != cohort.id:
                raise not_found("Team")
            session.add(m.TeamMembership(enrollment_id=enrollment.id, team_id=team.id, start_date=today))

    # Attendance: keep existing records (and how they were recorded), add new ones.
    wanted = set(draft.attended_event_ids)
    existing = session.scalars(select(m.Attendance).where(m.Attendance.enrollment_id == enrollment.id)).all()
    for record in existing:
        if record.event_id not in wanted:
            session.delete(record)
    have = {r.event_id for r in existing}
    for event_id in draft.attended_event_ids:
        if event_id not in have:
            _event(session, cohort, event_id)
            session.add(m.Attendance(event_id=event_id, enrollment_id=enrollment.id, source="manual"))

    # Completions and excuses are replaced wholesale for this participant.
    session.execute(delete(m.Completion).where(m.Completion.subject_id == enrollment.id))
    session.execute(delete(m.Exemption).where(m.Exemption.subject_id == enrollment.id))
    session.flush()
    for requirement_id, completed_at in draft.completions.items():
        _requirement(session, cohort, requirement_id)
        session.add(m.Completion(requirement_id=requirement_id, subject_id=enrollment.id, completed_at=completed_at))
    for requirement_id, reason in draft.exemptions.items():
        _requirement(session, cohort, requirement_id)
        session.add(m.Exemption(requirement_id=requirement_id, subject_id=enrollment.id, reason=reason.strip() or None))


def add_participants(session: Session, cohort: m.Cohort, rows: list[s.NewParticipant], today: dt.date) -> int:
    """Adds people to the cohort, reusing a person record when the email exists
    (a returning participant). Returns how many enrollments were created."""
    added = 0
    for row in rows:
        name, email = row.name.strip(), row.email.strip()
        if not name or not EMAIL.match(email):
            raise bad_request(f"Each person needs a name and a valid email ({email or 'missing email'}).")
        person = session.scalars(select(m.Person).where(func.lower(m.Person.email) == email.lower())).first()
        if person is None:
            person = m.Person(id=new_id("person"), name=name, email=email)
            session.add(person)
            session.flush()
        already = session.scalars(
            select(m.Enrollment).where(m.Enrollment.person_id == person.id, m.Enrollment.cohort_id == cohort.id)
        ).first()
        if already:
            continue
        enrollment = m.Enrollment(
            id=new_id("enr"), person_id=person.id, cohort_id=cohort.id, status="active",
            joined_at=today, fields={k: v for k, v in (row.fields or {}).items() if not _is_empty(v)},
        )
        session.add(enrollment)
        session.flush()
        added += 1

        team_name = (row.team or "").strip()
        if team_name:
            team = session.scalars(
                select(m.Team).where(m.Team.cohort_id == cohort.id, func.lower(m.Team.name) == team_name.lower())
            ).first()
            if team is None:
                team = m.Team(id=new_id("team"), cohort_id=cohort.id, name=team_name)
                session.add(team)
                session.flush()
            session.add(m.TeamMembership(enrollment_id=enrollment.id, team_id=team.id, start_date=today))
    return added


# ---- Events ----

TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _validate_event(e: m.Event) -> None:
    if not e.title.strip():
        raise bad_request("Enter a title.")
    for t in (e.start_time, e.end_time):
        if t is not None and not TIME.match(t):
            raise bad_request("Times must look like 18:30.")
    if e.end_date is not None and e.end_date <= e.date:
        raise bad_request("The end date must be after the start date.")
    if e.end_time and not e.start_time:
        raise bad_request("Pick a start time before an end time.")
    if e.end_date is None and e.start_time and e.end_time and e.end_time <= e.start_time:
        raise bad_request("The end time must be after the start time.")


def add_event(session: Session, cohort: m.Cohort, event: s.EventIn) -> m.Event:
    values = event.model_dump()
    values["links"] = [link.model_dump() for link in event.links] if event.links else None
    record = m.Event(id=new_id("ev"), cohort_id=cohort.id, checkin_token=f"chk-{secrets.token_urlsafe(9)}", **values)
    record.title = record.title.strip()
    _validate_event(record)
    session.add(record)
    return record


def update_event(session: Session, cohort: m.Cohort, event_id: str, patch: s.EventPatch) -> None:
    """Changes only the fields sent; a field sent as null is cleared."""
    record = _event(session, cohort, event_id)
    for name in patch.model_fields_set:
        value = getattr(patch, name)
        if name in ("title", "category", "date", "is_required") and value is None:
            raise bad_request(f"{name} can't be empty.")
        if name == "links":
            value = [link.model_dump() for link in value] if value else None
        setattr(record, name, value)
    _validate_event(record)


# ---- Custom fields ----


def _ordered_fields(session: Session, cohort: m.Cohort) -> list[m.FieldDefinition]:
    return list(
        session.scalars(
            select(m.FieldDefinition)
            .where(m.FieldDefinition.program_id == cohort.program_id)
            .order_by(m.FieldDefinition.position, m.FieldDefinition.id)
        )
    )


def add_field(session: Session, cohort: m.Cohort, field: s.FieldDefinitionIn) -> None:
    if not field.label.strip():
        raise bad_request("Enter a label.")
    values = field.model_dump()
    values["label"] = field.label.strip()
    values["archived"] = bool(field.archived)
    session.add(
        m.FieldDefinition(
            id=new_id("field"), program_id=cohort.program_id, position=len(_ordered_fields(session, cohort)), **values
        )
    )


def update_field(session: Session, cohort: m.Cohort, field_id: str, patch: s.FieldPatch) -> None:
    record = _field(session, cohort, field_id)
    for name in patch.model_fields_set:
        value = getattr(patch, name)
        if name == "archived":
            value = bool(value)
        elif value is None and name not in ("options", "placeholder"):
            raise bad_request(f"{name} can't be empty.")
        setattr(record, name, value)


def move_field(session: Session, cohort: m.Cohort, field_id: str, to_index: int) -> None:
    fields = _ordered_fields(session, cohort)
    moving = next((f for f in fields if f.id == field_id), None)
    if moving is None:
        raise not_found("Field")
    fields.remove(moving)
    fields.insert(max(0, min(to_index, len(fields))), moving)
    for i, f in enumerate(fields):
        f.position = i


def delete_field(session: Session, cohort: m.Cohort, field_id: str) -> None:
    """Permanent: also removes every participant's value for the field."""
    record = _field(session, cohort, field_id)
    for e in session.scalars(select(m.Enrollment).where(m.Enrollment.cohort_id == cohort.id)):
        if e.fields and field_id in e.fields:
            e.fields = {k: v for k, v in e.fields.items() if k != field_id}
    session.delete(record)


# ---- Profile ----


def update_profile(session: Session, user: m.User, profile: s.ProfileIn) -> None:
    name, email = profile.name.strip(), profile.email.strip()
    if not name:
        raise bad_request("Enter your name.")
    if not EMAIL.match(email):
        raise bad_request("Enter a valid email.")
    taken = session.scalars(
        select(m.User).where(func.lower(m.User.email) == email.lower(), m.User.id != user.id)
    ).first()
    if taken:
        raise bad_request("Another account already uses this email.")
    user.name, user.email = name, email
    user.job_title = (profile.job_title or "").strip() or None
    user.pronouns = (profile.pronouns or "").strip() or None
    user.phone = (profile.phone or "").strip() or None
