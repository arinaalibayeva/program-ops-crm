"""Loads the sample cohort into the database.

    python -m app.seed          # only if the database is empty
    python -m app.seed --reset  # wipe everything and reload
"""

import datetime as dt
import json
import sys
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import models as m
from .db import SessionLocal
from .schemas import CohortData

SAMPLE = Path(__file__).parent / "sample" / "cohort.json"

# Children before parents, so foreign keys allow the deletes. Accounts and
# sessions aren't sample data, so resetting leaves them alone.
TABLES = [
    m.Rule, m.Calculation, m.RecordForm, m.CustomRecord, m.RecordField, m.RecordType,
    m.Note, m.Attendance, m.Completion, m.Exemption, m.TeamMembership, m.Event, m.Requirement,
    m.Enrollment, m.Team, m.Project, m.PartnerContact, m.Partner, m.Person, m.FieldDefinition,
    m.Cohort, m.Program,
]


def load_sample() -> CohortData:
    return CohortData.model_validate(json.loads(SAMPLE.read_text()))


def clear(session: Session) -> None:
    for table in TABLES:
        session.execute(delete(table))


def add_sample_staff(session: Session, data: CohortData) -> None:
    """The interns who look after the sample teams. Accounts outlast a reset, so
    they're only added once. With no password, nobody can sign in as them until
    a manager sends them a link from Team access."""
    for person in data.staff:
        if person.role != "manager" and session.get(m.User, person.id) is None:
            session.add(
                m.User(id=person.id, name=person.name, email=person.email, role=person.role, job_title=person.job_title)
            )
    session.flush()


def seed(session: Session, data: CohortData) -> None:
    # Increasing timestamps keep the sample's order when lists are sorted by creation time.
    base = dt.datetime(2026, 9, 1, tzinfo=dt.timezone.utc)

    def at(i: int) -> dt.datetime:
        return base + dt.timedelta(seconds=i)

    session.add(m.Program(id=data.program.id, name=data.program.name))
    c = data.cohort
    session.add(m.Cohort(id=c.id, program_id=c.program_id, name=c.name, start_date=c.start_date, end_date=c.end_date))
    session.add_all(m.Person(id=p.id, name=p.name, email=p.email, created_at=at(i)) for i, p in enumerate(data.people))
    session.add_all(
        m.Enrollment(
            id=e.id, person_id=e.person_id, cohort_id=e.cohort_id, status=e.status,
            joined_at=e.joined_at, left_at=e.left_at, fields=e.fields or {}, created_at=at(i),
        )
        for i, e in enumerate(data.enrollments)
    )
    session.add_all(
        m.FieldDefinition(
            id=f.id, program_id=data.program.id, label=f.label, type=f.type, options=f.options,
            placeholder=f.placeholder, required=f.required, show_in_list=f.show_in_list,
            visible_to_participant=f.visible_to_participant, archived=bool(f.archived), position=i,
        )
        for i, f in enumerate(data.fields)
    )
    add_sample_staff(session, data)
    session.add_all(
        m.Partner(
            id=p.id, program_id=p.program_id, name=p.name, website=p.website, description=p.description,
            owner_id=p.owner_id, created_at=at(i),
        )
        for i, p in enumerate(data.partners)
    )
    session.flush()
    session.add_all(
        m.PartnerContact(
            id=c.id, partner_id=p.id, name=c.name, title=c.title, email=c.email, phone=c.phone, created_at=at(i),
        )
        for p in data.partners
        for i, c in enumerate(p.contacts)
    )
    session.add_all(
        m.Project(id=p.id, cohort_id=p.cohort_id, title=p.title, partner_id=p.partner_id, created_at=at(i))
        for i, p in enumerate(data.projects)
    )
    session.flush()
    session.add_all(
        m.Team(
            id=t.id, cohort_id=t.cohort_id, name=t.name, project_id=t.project_id, owner_id=t.owner_id,
            created_at=at(i),
        )
        for i, t in enumerate(data.teams)
    )
    session.flush()
    session.add_all(
        m.TeamMembership(enrollment_id=x.enrollment_id, team_id=x.team_id, start_date=x.start_date, end_date=x.end_date)
        for x in data.memberships
    )
    session.add_all(
        m.Event(
            id=e.id, cohort_id=e.cohort_id, title=e.title, category=e.category, date=e.date,
            end_date=e.end_date, start_time=e.start_time, end_time=e.end_time, location=e.location,
            host=e.host, description=e.description,
            links=[link.model_dump() for link in e.links] if e.links else None,
            is_required=e.is_required, partner_id=e.partner_id, checkin_token=e.checkin_token,
        )
        for e in data.events
    )
    session.add_all(
        m.Requirement(id=r.id, cohort_id=c.id, name=r.name, scope=r.scope, type=r.type, params=r.params, position=i)
        for i, r in enumerate(data.requirements)
    )
    session.flush()
    session.add_all(
        m.Attendance(event_id=a.event_id, enrollment_id=a.enrollment_id, source=a.source, recorded_at=at(i))
        for i, a in enumerate(data.attendance)
    )
    session.add_all(
        m.Completion(requirement_id=x.requirement_id, subject_id=x.subject_id, completed_at=x.completed_at)
        for x in data.completions
    )
    session.add_all(
        m.Exemption(requirement_id=x.requirement_id, subject_id=x.subject_id, reason=x.reason)
        for x in data.exemptions
    )
    session.add_all(
        m.Note(
            id=n.id, subject_type=n.subject_type, subject_id=n.subject_id, body=n.body, author=n.author,
            follow_up_date=n.follow_up_date, follow_up_done=n.follow_up_done, created_at=n.created_at,
        )
        for n in data.notes
    )
    session.flush()
    seed_records(session, data)


def seed_records(session: Session, data: CohortData) -> None:
    for i, t in enumerate(data.record_types):
        session.add(m.RecordType(id=t.id, program_id=t.program_id, name=t.name, singular=t.singular, position=i))
        session.flush()
        session.add_all(
            m.RecordField(
                id=f.id, type_id=t.id, label=f.label, type=f.type, options=f.options, required=f.required,
                link_to=f.link_to, multiple=bool(f.multiple), position=j,
            )
            for j, f in enumerate(t.fields)
        )
    session.flush()
    session.add_all(
        m.CustomRecord(
            id=r.id, type_id=r.type_id, cohort_id=r.cohort_id, values=r.values,
            created_at=r.created_at, updated_at=r.updated_at,
        )
        for r in data.records
    )
    session.add_all(
        m.Calculation(
            id=c.id, program_id=c.program_id, label=c.label, on=c.on, kind=c.kind,
            source_type_id=c.source_type_id, via_field_id=c.via_field_id, date_field_id=c.date_field_id,
            filter=c.filter.model_dump(by_alias=True, exclude_none=True) if c.filter else None, position=i,
        )
        for i, c in enumerate(data.calculations)
    )
    session.flush()
    session.add_all(
        m.Rule(
            id=r.id, calculation_id=r.calculation_id, op=r.op, value=r.value, when_empty=r.when_empty,
            status=r.status, message=r.message, position=i,
        )
        for i, r in enumerate(data.rules)
    )
    session.add_all(
        m.RecordForm(
            id=f.id, type_id=f.type_id, title=f.title, description=f.description, field_ids=f.field_ids,
            token=f.token, roster=f.roster, is_open=f.is_open, position=i,
        )
        for i, f in enumerate(data.forms)
    )
    session.flush()


def reset(session: Session) -> None:
    clear(session)
    session.flush()
    seed(session, load_sample())


def main() -> None:
    with SessionLocal() as session:
        if "--reset" in sys.argv:
            reset(session)
        elif session.scalars(select(m.Program)).first() is None:
            seed(session, load_sample())
        else:
            print("Database already has data; use --reset to reload the sample.")
            return
        session.commit()
        print("Loaded the sample cohort.")


if __name__ == "__main__":
    main()
