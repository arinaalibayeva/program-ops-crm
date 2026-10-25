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


# Ids the browser picks so it can link to new things before the server answers.
CLIENT_ID = re.compile(r"^[a-z]+-[a-z0-9]{6,32}$")


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4)}"


def given_id(session: Session, model: type, wanted: str | None, prefix: str) -> str:
    """The browser's id when it's well formed and unused, else a new one."""
    if wanted and CLIENT_ID.match(wanted) and session.get(model, wanted) is None:
        return wanted
    return new_id(prefix)


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


def _validate_record_requirement(session: Session, cohort: m.Cohort, req: s.RequirementIn) -> None:
    p = req.params
    type_ = session.get(m.RecordType, p.get("typeId") or "")
    if type_ is None or type_.program_id != cohort.program_id:
        raise bad_request("Choose which records count.")
    via = session.get(m.RecordField, p.get("viaFieldId") or "")
    if via is None or via.type_id != type_.id or via.type != "link" or via.link_to != req.scope:
        raise bad_request(f"Choose the field that links these records to each {req.scope}.")
    date_field = p.get("dateFieldId")
    if date_field is not None:
        f = session.get(m.RecordField, date_field)
        if f is None or f.type_id != type_.id or f.type != "date":
            raise bad_request("The date to check must be a date field on these records.")
    if not isinstance(p.get("minCount"), int) or p["minCount"] < 1:
        raise bad_request("Record requirements need a minimum of at least 1.")
    condition = p.get("filter")
    if condition is not None:
        try:
            c = s.Condition.model_validate(condition)
        except ValueError:
            raise bad_request("That filter isn't valid.") from None
        f = session.get(m.RecordField, c.field_id)
        if f is None or f.type_id != type_.id:
            raise bad_request("Filter on a field of these records.")


def _validate_requirement(session: Session, cohort: m.Cohort, req: s.RequirementIn) -> None:
    p = req.params
    if req.type == "attendance_min":
        if req.scope != "participant":
            raise bad_request("Attendance requirements apply to participants.")
        if not isinstance(p.get("category"), str) or not isinstance(p.get("minCount"), int) or p["minCount"] < 1:
            raise bad_request("Attendance requirements need a category and a minimum of at least 1.")
    elif req.type in ("complete_by", "record_by"):
        try:
            dt.date.fromisoformat(p.get("dueDate", ""))
        except (TypeError, ValueError):
            raise bad_request("Deadline requirements need a due date.") from None
        if req.type == "record_by":
            _validate_record_requirement(session, cohort, req)
    elif req.type == "team_min_size":
        if req.scope != "team":
            raise bad_request("Team size requirements apply to teams.")
        if not isinstance(p.get("minActive"), int) or p["minActive"] < 1:
            raise bad_request("Team size requirements need a minimum of at least 1.")


def add_requirement(session: Session, cohort: m.Cohort, req: s.RequirementIn) -> None:
    if not req.name.strip():
        raise bad_request("Enter a name.")
    _validate_requirement(session, cohort, req)
    position = session.scalar(
        select(func.coalesce(func.max(m.Requirement.position), -1)).where(m.Requirement.cohort_id == cohort.id)
    )
    session.add(
        m.Requirement(
            id=new_id("req"), cohort_id=cohort.id, name=req.name.strip(), scope=req.scope,
            type=req.type, params=req.params, position=position + 1,
        )
    )


def update_requirement(session: Session, cohort: m.Cohort, requirement_id: str, req: s.RequirementIn) -> None:
    """Changes a requirement's name and settings. What it applies to and how it's checked stay fixed,
    so completions and excuses keep their meaning."""
    existing = _requirement(session, cohort, requirement_id)
    if req.type != existing.type or req.scope != existing.scope:
        raise bad_request("A requirement's kind can't change. Make a new one instead.")
    if not req.name.strip():
        raise bad_request("Enter a name.")
    _validate_requirement(session, cohort, req)
    existing.name = req.name.strip()
    existing.params = req.params


def delete_requirement(session: Session, cohort: m.Cohort, requirement_id: str) -> None:
    req = _requirement(session, cohort, requirement_id)
    session.execute(delete(m.Completion).where(m.Completion.requirement_id == req.id))
    session.execute(delete(m.Exemption).where(m.Exemption.requirement_id == req.id))
    session.delete(req)


# ---- Notes ----


def _note_body(body: str) -> str:
    body = body.strip()
    if not body:
        raise bad_request("Write something first.")
    if len(body) > 10_000:
        raise bad_request("Keep notes under 10,000 characters.")
    return body


def _subject_exists(session: Session, cohort: m.Cohort, subject_type: str, subject_id: str) -> bool:
    if subject_type == "participant":
        e = session.get(m.Enrollment, subject_id)
        return e is not None and e.cohort_id == cohort.id
    if subject_type == "team":
        t = session.get(m.Team, subject_id)
        return t is not None and t.cohort_id == cohort.id
    p = session.get(m.Partner, subject_id)
    return p is not None and p.program_id == cohort.program_id


def _note(session: Session, cohort: m.Cohort, note_id: str) -> m.Note:
    note = session.get(m.Note, note_id)
    if note is None or not _subject_exists(session, cohort, note.subject_type, note.subject_id):
        raise not_found("Note")
    return note


def add_note(session: Session, cohort: m.Cohort, body: s.NoteCreate, author: str) -> None:
    if not _subject_exists(session, cohort, body.subject_type, body.subject_id):
        raise not_found(body.subject_type.capitalize())
    session.add(
        m.Note(
            id=given_id(session, m.Note, body.id, "note"), subject_type=body.subject_type,
            subject_id=body.subject_id, body=_note_body(body.body), author=author,
            follow_up_date=body.follow_up_date,
        )
    )


def update_note(session: Session, cohort: m.Cohort, note_id: str, patch: s.NotePatch) -> None:
    note = _note(session, cohort, note_id)
    if patch.body is not None:
        note.body = _note_body(patch.body)
        note.updated_at = m.now()
    if "follow_up_date" in patch.model_fields_set:
        note.follow_up_date = patch.follow_up_date
    if patch.follow_up_done is not None:
        note.follow_up_done = patch.follow_up_done


def delete_note(session: Session, cohort: m.Cohort, note_id: str) -> None:
    session.delete(_note(session, cohort, note_id))


# ---- Partners ----


def _partner(session: Session, cohort: m.Cohort, partner_id: str) -> m.Partner:
    p = session.get(m.Partner, partner_id)
    if p is None or p.program_id != cohort.program_id:
        raise not_found("Partner")
    return p


def _staff_id(session: Session, owner_id: str | None) -> str | None:
    """Only people who can sign in to the CRM can look after something."""
    if owner_id is None:
        return None
    user = session.get(m.User, owner_id)
    if user is None or user.role == "participant":
        raise not_found("Staff member")
    return user.id


def _website(url: str | None) -> str | None:
    url = (url or "").strip()
    # It's shown as a link, so a pasted "javascript:" value must not get through.
    if url and not re.match(r"^https?://\S+$", url, re.IGNORECASE):
        raise bad_request("Websites must start with http:// or https://.")
    return url or None


def add_partner(session: Session, cohort: m.Cohort, body: s.PartnerCreate) -> None:
    name = body.name.strip()
    if not name:
        raise bad_request("Enter a name.")
    taken = session.scalars(
        select(m.Partner).where(m.Partner.program_id == cohort.program_id, func.lower(m.Partner.name) == name.lower())
    ).first()
    if taken:
        raise bad_request("There's already a partner with this name.")
    session.add(
        m.Partner(
            id=given_id(session, m.Partner, body.id, "partner"), program_id=cohort.program_id, name=name,
            website=_website(body.website), description=(body.description or "").strip() or None,
            owner_id=_staff_id(session, body.owner_id),
        )
    )


def update_partner(session: Session, cohort: m.Cohort, partner_id: str, patch: s.PartnerPatch) -> None:
    p = _partner(session, cohort, partner_id)
    fields = patch.model_fields_set
    if "name" in fields:
        name = (patch.name or "").strip()
        if not name:
            raise bad_request("Enter a name.")
        p.name = name
    if "website" in fields:
        p.website = _website(patch.website)
    if "description" in fields:
        p.description = (patch.description or "").strip() or None
    if "owner_id" in fields:
        p.owner_id = _staff_id(session, patch.owner_id)


def add_contact(session: Session, cohort: m.Cohort, partner_id: str, body: s.PartnerContactCreate) -> None:
    p = _partner(session, cohort, partner_id)
    name = body.name.strip()
    email = (body.email or "").strip()
    if not name:
        raise bad_request("Enter their name.")
    if email and not EMAIL.match(email):
        raise bad_request("Enter a valid email.")
    session.add(
        m.PartnerContact(
            id=given_id(session, m.PartnerContact, body.id, "contact"), partner_id=p.id, name=name,
            title=(body.title or "").strip() or None, email=email or None, phone=(body.phone or "").strip() or None,
        )
    )


def delete_contact(session: Session, cohort: m.Cohort, contact_id: str) -> None:
    c = session.get(m.PartnerContact, contact_id)
    if c is None:
        raise not_found("Contact")
    _partner(session, cohort, c.partner_id)
    session.delete(c)


def set_project_partner(session: Session, cohort: m.Cohort, project_id: str, partner_id: str | None) -> None:
    project = session.get(m.Project, project_id)
    if project is None or project.cohort_id != cohort.id:
        raise not_found("Project")
    project.partner_id = _partner(session, cohort, partner_id).id if partner_id else None


def set_team_owner(session: Session, cohort: m.Cohort, team_id: str, owner_id: str | None) -> None:
    team = session.get(m.Team, team_id)
    if team is None or team.cohort_id != cohort.id:
        raise not_found("Team")
    team.owner_id = _staff_id(session, owner_id)


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
    if record.partner_id:
        _partner(session, cohort, record.partner_id)
    _validate_event(record)
    session.add(record)
    return record


def update_event(session: Session, cohort: m.Cohort, event_id: str, patch: s.EventPatch) -> None:
    """Changes only the fields sent; a field sent as null is cleared."""
    record = _event(session, cohort, event_id)
    for name in patch.model_fields_set:
        value = getattr(patch, name)
        if name in ("title", "category", "date", "is_required", "completed") and value is None:
            raise bad_request(f"{name} can't be empty.")
        if name == "links":
            value = [link.model_dump() for link in value] if value else None
        if name == "partner_id" and value:
            _partner(session, cohort, value)
        setattr(record, name, value)
    _validate_event(record)


def delete_event(session: Session, cohort: m.Cohort, event_id: str) -> None:
    """Also removes its attendance, and unlinks records that point at it."""
    record = _event(session, cohort, event_id)
    session.execute(delete(m.Attendance).where(m.Attendance.event_id == record.id))
    links = set(
        session.scalars(select(m.RecordField.id).where(m.RecordField.type == "link", m.RecordField.link_to == "event"))
    )
    if links:
        for other in session.scalars(select(m.CustomRecord).where(m.CustomRecord.cohort_id == cohort.id)):
            values = dict(other.values)
            for key in links & values.keys():
                value = values[key]
                if isinstance(value, list) and record.id in value:
                    values[key] = [x for x in value if x != record.id]
                elif value == record.id:
                    del values[key]
            if values != other.values:
                other.values = values
    session.delete(record)


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
