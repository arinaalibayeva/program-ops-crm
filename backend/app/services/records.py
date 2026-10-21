"""Custom record types: definitions, records, calculations, rules and forms.

Mirrors frontend/lib/record-actions.ts, including what each delete cleans up.
Working out calculations and rules lives with the statuses, in requirements.py.
"""

import re
import secrets

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from .actions import EMAIL, bad_request, delete_requirement, new_id, not_found
from .actions import given_id as _id

BUILT_IN_TARGETS = ("participant", "team", "event")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _clean(text: str, what: str) -> str:
    text = text.strip()
    if not text:
        raise bad_request(f"Enter {what}.")
    return text


# ---- Lookups, scoped to the current cohort and its program ----


def _type(session: Session, cohort: m.Cohort, type_id: str) -> m.RecordType:
    t = session.get(m.RecordType, type_id)
    if t is None or t.program_id != cohort.program_id:
        raise not_found("Record type")
    return t


def _field(session: Session, cohort: m.Cohort, field_id: str) -> m.RecordField:
    f = session.get(m.RecordField, field_id)
    if f is None:
        raise not_found("Field")
    _type(session, cohort, f.type_id)
    return f


def _record(session: Session, cohort: m.Cohort, record_id: str) -> m.CustomRecord:
    r = session.get(m.CustomRecord, record_id)
    if r is None or r.cohort_id != cohort.id:
        raise not_found("Record")
    return r


def _calculation(session: Session, cohort: m.Cohort, calc_id: str) -> m.Calculation:
    c = session.get(m.Calculation, calc_id)
    if c is None or c.program_id != cohort.program_id:
        raise not_found("Calculation")
    return c


def _form(session: Session, cohort: m.Cohort, form_id: str) -> m.RecordForm:
    f = session.get(m.RecordForm, form_id)
    if f is None:
        raise not_found("Form")
    _type(session, cohort, f.type_id)
    return f


def fields_of(session: Session, type_id: str) -> list[m.RecordField]:
    return list(
        session.scalars(
            select(m.RecordField).where(m.RecordField.type_id == type_id).order_by(m.RecordField.position)
        )
    )


def _valid_target(session: Session, cohort: m.Cohort, target: str) -> bool:
    if target in BUILT_IN_TARGETS:
        return True
    t = session.get(m.RecordType, target)
    return t is not None and t.program_id == cohort.program_id


def _link_exists(session: Session, cohort: m.Cohort, target: str, record_id: str) -> bool:
    if target == "participant":
        e = session.get(m.Enrollment, record_id)
        return e is not None and e.cohort_id == cohort.id
    if target == "team":
        t = session.get(m.Team, record_id)
        return t is not None and t.cohort_id == cohort.id
    if target == "event":
        e = session.get(m.Event, record_id)
        return e is not None and e.cohort_id == cohort.id
    r = session.get(m.CustomRecord, record_id)
    return r is not None and r.cohort_id == cohort.id and r.type_id == target


# ---- Record types and fields ----


def _record_requirements(session: Session, cohort: m.Cohort) -> list[m.Requirement]:
    return list(
        session.scalars(select(m.Requirement).where(m.Requirement.cohort_id == cohort.id, m.Requirement.type == "record_by"))
    )


def add_type(session: Session, cohort: m.Cohort, body: s.RecordTypeCreate) -> None:
    position = session.scalar(
        select(func.coalesce(func.max(m.RecordType.position), -1)).where(m.RecordType.program_id == cohort.program_id)
    )
    session.add(
        m.RecordType(
            id=_id(session, m.RecordType, body.id, "rt"), program_id=cohort.program_id,
            name=_clean(body.name, "a name"), singular=_clean(body.singular, "a name for one record"),
            position=position + 1,
        )
    )


def update_type(session: Session, cohort: m.Cohort, type_id: str, patch: s.RecordTypePatch) -> None:
    t = _type(session, cohort, type_id)
    if patch.name is not None:
        t.name = _clean(patch.name, "a name")
    if patch.singular is not None:
        t.singular = _clean(patch.singular, "a name for one record")


def delete_type(session: Session, cohort: m.Cohort, type_id: str) -> None:
    t = _type(session, cohort, type_id)
    linking = session.scalars(
        select(m.RecordType.name)
        .join(m.RecordField, m.RecordField.type_id == m.RecordType.id)
        .where(m.RecordField.link_to == t.id, m.RecordType.id != t.id)
    ).all()
    if linking:
        raise bad_request(f"Remove the links to {t.name} in {', '.join(sorted(set(linking)))} first.")
    _drop_calculations(
        session,
        select(m.Calculation.id).where(
            m.Calculation.program_id == cohort.program_id,
            (m.Calculation.source_type_id == t.id) | (m.Calculation.on == t.id),
        ),
    )
    for req in _record_requirements(session, cohort):
        if req.params.get("typeId") == t.id:
            delete_requirement(session, cohort, req.id)
    session.execute(delete(m.RecordForm).where(m.RecordForm.type_id == t.id))
    session.execute(delete(m.CustomRecord).where(m.CustomRecord.type_id == t.id))
    session.execute(delete(m.RecordField).where(m.RecordField.type_id == t.id))
    session.delete(t)


def add_field(session: Session, cohort: m.Cohort, type_id: str, body: s.RecordFieldCreate) -> None:
    t = _type(session, cohort, type_id)
    options = [o.strip() for o in body.options or [] if o.strip()]
    if body.type in ("select", "multi_select") and not options:
        raise bad_request("Add at least one choice.")
    if body.type == "link" and not (body.link_to and _valid_target(session, cohort, body.link_to)):
        raise bad_request("Choose what this field links to.")
    session.add(
        m.RecordField(
            id=_id(session, m.RecordField, body.id, "rf"), type_id=t.id, label=_clean(body.label, "a label"),
            type=body.type, options=options or None, required=body.required,
            link_to=body.link_to if body.type == "link" else None,
            multiple=bool(body.multiple) and body.type == "link", position=len(fields_of(session, t.id)),
        )
    )


def update_field(session: Session, cohort: m.Cohort, field_id: str, patch: s.RecordFieldPatch) -> None:
    """The type and link target are fixed once records may depend on them."""
    f = _field(session, cohort, field_id)
    if patch.label is not None:
        f.label = _clean(patch.label, "a label")
    if patch.options is not None:
        options = [o.strip() for o in patch.options if o.strip()]
        if f.type in ("select", "multi_select") and not options:
            raise bad_request("Add at least one choice.")
        f.options = options or None
    if patch.required is not None:
        f.required = patch.required
    if patch.multiple is not None and f.type == "link":
        f.multiple = patch.multiple


def move_field(session: Session, cohort: m.Cohort, field_id: str, to_index: int) -> None:
    f = _field(session, cohort, field_id)
    fields = [x for x in fields_of(session, f.type_id) if x.id != f.id]
    fields.insert(max(0, min(to_index, len(fields))), f)
    for i, x in enumerate(fields):
        x.position = i


def delete_field(session: Session, cohort: m.Cohort, field_id: str) -> None:
    f = _field(session, cohort, field_id)
    calcs = select(m.Calculation.id).where(
        m.Calculation.source_type_id == f.type_id,
        (m.Calculation.via_field_id == f.id) | (m.Calculation.date_field_id == f.id),
    )
    _drop_calculations(session, calcs)
    for c in session.scalars(select(m.Calculation).where(m.Calculation.source_type_id == f.type_id)):
        if c.filter and c.filter.get("fieldId") == f.id:
            _drop_calculations(session, select(m.Calculation.id).where(m.Calculation.id == c.id))
    for req in _record_requirements(session, cohort):
        if req.params.get("viaFieldId") == f.id:
            delete_requirement(session, cohort, req.id)
        elif req.params.get("dateFieldId") == f.id:
            req.params = {k: v for k, v in req.params.items() if k != "dateFieldId"}
    for r in session.scalars(select(m.CustomRecord).where(m.CustomRecord.type_id == f.type_id)):
        if f.id in r.values:
            r.values = {k: v for k, v in r.values.items() if k != f.id}
    for form in session.scalars(select(m.RecordForm).where(m.RecordForm.type_id == f.type_id)):
        form.field_ids = [x for x in form.field_ids if x != f.id]
    session.delete(f)


# ---- Records ----


def clean_values(session: Session, cohort: m.Cohort, type_id: str, values: dict) -> dict:
    """Checks each value against its field; unknown fields are dropped."""
    out: dict = {}
    missing = []
    for f in fields_of(session, type_id):
        value = values.get(f.id)
        if isinstance(value, str):
            value = value.strip()
        empty = value is None or value == "" or value == [] or (f.type == "checkbox" and value is False)
        if empty:
            if f.required and f.type != "checkbox":
                missing.append(f.label)
            continue
        out[f.id] = _check_value(session, cohort, f, value)
    if missing:
        raise bad_request(f"Fill in {', '.join(missing)}.")
    return out


def _check_value(session: Session, cohort: m.Cohort, f: m.RecordField, value):
    wrong = bad_request(f"{f.label} has the wrong kind of value.")
    if f.type == "link":
        ids = value if isinstance(value, list) else [value]
        if not all(isinstance(i, str) for i in ids) or (len(ids) > 1 and not f.multiple):
            raise wrong
        if not all(_link_exists(session, cohort, f.link_to, i) for i in ids):
            raise bad_request(f"{f.label} links to something that doesn't exist.")
        return list(dict.fromkeys(ids)) if f.multiple else ids[0]
    if f.type == "checkbox":
        if not isinstance(value, bool):
            raise wrong
        return value
    if f.type == "number":
        if isinstance(value, bool) or not isinstance(value, int | float):
            raise wrong
        return value
    if f.type == "multi_select":
        if not isinstance(value, list) or not set(value) <= set(f.options or []):
            raise bad_request(f"Pick {f.label} from its choices.")
        return value
    if not isinstance(value, str):
        raise wrong
    if f.type == "select" and value not in (f.options or []):
        raise bad_request(f"Pick {f.label} from its choices.")
    if f.type == "date" and not DATE.match(value):
        raise bad_request(f"{f.label} must be a date.")
    return value


def add_record(session: Session, cohort: m.Cohort, body: s.RecordCreate) -> m.CustomRecord:
    t = _type(session, cohort, body.type_id)
    record = m.CustomRecord(
        id=_id(session, m.CustomRecord, body.id, "rec"), type_id=t.id, cohort_id=cohort.id,
        values=clean_values(session, cohort, t.id, body.values),
    )
    session.add(record)
    return record


def update_record(session: Session, cohort: m.Cohort, record_id: str, values: dict) -> None:
    r = _record(session, cohort, record_id)
    r.values = clean_values(session, cohort, r.type_id, values)
    r.updated_at = m.now()


def delete_record(session: Session, cohort: m.Cohort, record_id: str) -> None:
    r = _record(session, cohort, record_id)
    link_fields = set(
        session.scalars(
            select(m.RecordField.id).where(m.RecordField.type == "link", m.RecordField.link_to == r.type_id)
        )
    )
    if link_fields:
        for other in session.scalars(select(m.CustomRecord).where(m.CustomRecord.cohort_id == cohort.id)):
            values = dict(other.values)
            for key in link_fields & values.keys():
                v = values[key]
                if isinstance(v, list) and r.id in v:
                    values[key] = [x for x in v if x != r.id]
                elif v == r.id:
                    del values[key]
            if values != other.values:
                other.values = values
    session.delete(r)


# ---- Calculations and rules ----


def _drop_calculations(session: Session, ids) -> None:
    ids = list(session.scalars(ids))
    if ids:
        session.execute(delete(m.Rule).where(m.Rule.calculation_id.in_(ids)))
        session.execute(delete(m.Calculation).where(m.Calculation.id.in_(ids)))


def add_calculation(session: Session, cohort: m.Cohort, body: s.CalculationCreate) -> None:
    source = _type(session, cohort, body.source_type_id)
    fields = {f.id: f for f in fields_of(session, source.id)}
    via = fields.get(body.via_field_id)
    if via is None or via.type != "link" or via.link_to != body.on:
        raise bad_request("Choose how the records link here.")
    if body.kind in ("latest", "days_since"):
        date = fields.get(body.date_field_id or "")
        if date is None or date.type != "date":
            raise bad_request("Choose a date field.")
    if body.kind == "percent" and body.filter is None:
        raise bad_request("Choose which records count toward the percent.")
    if body.filter and body.filter.field_id not in fields:
        raise bad_request("Choose a field to filter on.")
    position = session.scalar(
        select(func.coalesce(func.max(m.Calculation.position), -1)).where(m.Calculation.program_id == cohort.program_id)
    )
    session.add(
        m.Calculation(
            id=_id(session, m.Calculation, body.id, "calc"), program_id=cohort.program_id,
            label=_clean(body.label, "a name"), on=body.on, kind=body.kind, source_type_id=source.id,
            via_field_id=via.id, date_field_id=body.date_field_id if body.kind in ("latest", "days_since") else None,
            filter=body.filter.model_dump(by_alias=True, exclude_none=True) if body.filter else None,
            position=position + 1,
        )
    )


def delete_calculation(session: Session, cohort: m.Cohort, calc_id: str) -> None:
    c = _calculation(session, cohort, calc_id)
    _drop_calculations(session, select(m.Calculation.id).where(m.Calculation.id == c.id))


def add_rule(session: Session, cohort: m.Cohort, body: s.RuleCreate) -> None:
    calc = _calculation(session, cohort, body.calculation_id)
    if calc.kind == "latest":
        raise bad_request("Rules need a number. Use “days since” instead of “latest date”.")
    position = session.scalar(
        select(func.coalesce(func.max(m.Rule.position), -1)).where(m.Rule.calculation_id == calc.id)
    )
    session.add(
        m.Rule(
            id=_id(session, m.Rule, body.id, "rule"), calculation_id=calc.id, op=body.op, value=body.value,
            when_empty=body.when_empty, status=body.status, message=_clean(body.message, "a message"),
            position=position + 1,
        )
    )


def delete_rule(session: Session, cohort: m.Cohort, rule_id: str) -> None:
    rule = session.get(m.Rule, rule_id)
    if rule is None:
        raise not_found("Rule")
    _calculation(session, cohort, rule.calculation_id)
    session.delete(rule)


# ---- Forms ----


def _form_fields(session: Session, type_id: str, field_ids: list[str]) -> list[str]:
    askable = {f.id for f in fields_of(session, type_id) if f.type != "link"}
    chosen = [i for i in dict.fromkeys(field_ids) if i in askable]
    if not chosen:
        raise bad_request("Pick at least one field to ask for.")
    return chosen


def add_form(session: Session, cohort: m.Cohort, body: s.RecordFormCreate) -> None:
    t = _type(session, cohort, body.type_id)
    token = body.token if body.token and TOKEN.match(body.token) else None
    if token is None or session.scalars(select(m.RecordForm).where(m.RecordForm.token == token)).first():
        token = secrets.token_hex(12)
    session.add(
        m.RecordForm(
            id=_id(session, m.RecordForm, body.id, "form"), type_id=t.id, title=_clean(body.title, "a title"),
            description=(body.description or "").strip() or None,
            field_ids=_form_fields(session, t.id, body.field_ids), token=token, roster=body.roster,
            is_open=body.is_open,
        )
    )


def update_form(session: Session, cohort: m.Cohort, form_id: str, patch: s.RecordFormPatch) -> None:
    f = _form(session, cohort, form_id)
    if patch.title is not None:
        f.title = _clean(patch.title, "a title")
    if "description" in patch.model_fields_set:
        f.description = (patch.description or "").strip() or None
    if patch.field_ids is not None:
        f.field_ids = _form_fields(session, f.type_id, patch.field_ids)
    if patch.roster is not None:
        f.roster = patch.roster
    if patch.is_open is not None:
        f.is_open = patch.is_open


def delete_form(session: Session, cohort: m.Cohort, form_id: str) -> None:
    session.delete(_form(session, cohort, form_id))


def form_by_token(session: Session, token: str) -> m.RecordForm:
    form = session.scalars(select(m.RecordForm).where(m.RecordForm.token == token)).first()
    if form is None:
        raise HTTPException(status_code=404, detail="This form link isn't valid.")
    return form


def submit_form(session: Session, cohort: m.Cohort, form: m.RecordForm, body: s.FormSubmission) -> s.FormResult:
    """Saves a submission. With `roster`, the email must belong to an active
    participant, and links to participants and teams are filled in from them."""
    if not form.is_open:
        return s.FormResult(status="closed")
    asked = set(form.field_ids)
    values = {k: v for k, v in body.values.items() if k in asked}
    name = None
    if form.roster:
        email = (body.email or "").strip().lower()
        if not EMAIL.match(email):
            raise bad_request("Enter your email.")
        found = session.execute(
            select(m.Enrollment, m.Person)
            .join(m.Person, m.Person.id == m.Enrollment.person_id)
            .where(
                m.Enrollment.cohort_id == cohort.id,
                m.Enrollment.status == "active",
                func.lower(m.Person.email) == email,
            )
        ).first()
        if found is None:
            return s.FormResult(status="not_found")
        enrollment, person = found
        name = person.name
        # The membership without an end date, as on the frontend.
        team_id = session.scalars(
            select(m.TeamMembership.team_id).where(
                m.TeamMembership.enrollment_id == enrollment.id, m.TeamMembership.end_date.is_(None)
            )
        ).first()
        for f in fields_of(session, form.type_id):
            if f.type != "link":
                continue
            if f.link_to == "participant":
                values[f.id] = [enrollment.id] if f.multiple else enrollment.id
            elif f.link_to == "team" and team_id:
                values[f.id] = [team_id] if f.multiple else team_id
    session.add(
        m.CustomRecord(
            id=new_id("rec"), type_id=form.type_id, cohort_id=cohort.id,
            values=clean_values(session, cohort, form.type_id, values),
        )
    )
    return s.FormResult(status="saved", name=name)
