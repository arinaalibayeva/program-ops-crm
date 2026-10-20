"""Builds the CohortData the frontend works with from the database."""

import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as m
from . import schemas as s
from .config import settings


def current_cohort(session: Session) -> m.Cohort | None:
    """The cohort the app shows: the most recently started one."""
    return session.scalars(select(m.Cohort).order_by(m.Cohort.start_date.desc())).first()


def build_snapshot(session: Session, cohort: m.Cohort) -> s.CohortData:
    program = session.get(m.Program, cohort.program_id)
    enrollments = session.scalars(
        select(m.Enrollment)
        .where(m.Enrollment.cohort_id == cohort.id)
        .order_by(m.Enrollment.created_at, m.Enrollment.id)
    ).all()
    enrollment_ids = [e.id for e in enrollments]
    people = session.scalars(
        select(m.Person)
        .where(m.Person.id.in_([e.person_id for e in enrollments]))
        .order_by(m.Person.created_at, m.Person.id)
    ).all()
    teams = session.scalars(
        select(m.Team).where(m.Team.cohort_id == cohort.id).order_by(m.Team.created_at, m.Team.id)
    ).all()
    events = session.scalars(
        select(m.Event).where(m.Event.cohort_id == cohort.id).order_by(m.Event.date, m.Event.id)
    ).all()
    requirements = session.scalars(
        select(m.Requirement)
        .where(m.Requirement.cohort_id == cohort.id)
        .order_by(m.Requirement.position, m.Requirement.id)
    ).all()
    requirement_ids = [r.id for r in requirements]

    return s.CohortData(
        program=s.Program(id=program.id, name=program.name),
        cohort=s.Cohort(
            id=cohort.id,
            program_id=cohort.program_id,
            name=cohort.name,
            start_date=cohort.start_date,
            end_date=cohort.end_date,
        ),
        today=settings.today(),
        people=[s.Person(id=p.id, name=p.name, email=p.email) for p in people],
        enrollments=[
            s.Enrollment(
                id=e.id,
                person_id=e.person_id,
                cohort_id=e.cohort_id,
                status=e.status,
                joined_at=e.joined_at,
                left_at=e.left_at,
                fields=e.fields or None,
            )
            for e in enrollments
        ],
        projects=[
            s.Project(id=p.id, cohort_id=p.cohort_id, title=p.title, partner=p.partner)
            for p in session.scalars(
                select(m.Project)
                .where(m.Project.cohort_id == cohort.id)
                .order_by(m.Project.created_at, m.Project.id)
            )
        ],
        teams=[s.Team(id=t.id, cohort_id=t.cohort_id, name=t.name, project_id=t.project_id) for t in teams],
        memberships=[
            s.TeamMembership(
                enrollment_id=x.enrollment_id, team_id=x.team_id, start_date=x.start_date, end_date=x.end_date
            )
            for x in session.scalars(
                select(m.TeamMembership)
                .where(m.TeamMembership.enrollment_id.in_(enrollment_ids))
                .order_by(m.TeamMembership.id)
            )
        ],
        events=[event_schema(e) for e in events],
        attendance=[
            s.Attendance(event_id=a.event_id, enrollment_id=a.enrollment_id, source=a.source)
            for a in session.scalars(
                select(m.Attendance)
                .where(m.Attendance.event_id.in_([e.id for e in events]))
                .order_by(m.Attendance.recorded_at)
            )
        ],
        requirements=[
            s.Requirement(id=r.id, name=r.name, scope=r.scope, type=r.type, params=r.params) for r in requirements
        ],
        completions=[
            s.Completion(requirement_id=c.requirement_id, subject_id=c.subject_id, completed_at=c.completed_at)
            for c in session.scalars(select(m.Completion).where(m.Completion.requirement_id.in_(requirement_ids)))
        ],
        exemptions=[
            s.Exemption(requirement_id=x.requirement_id, subject_id=x.subject_id, reason=x.reason)
            for x in session.scalars(select(m.Exemption).where(m.Exemption.requirement_id.in_(requirement_ids)))
        ],
        team_notes=[
            s.TeamNote(
                id=n.id, team_id=n.team_id, body=n.body, author=n.author,
                created_at=as_utc(n.created_at), updated_at=as_utc(n.updated_at) if n.updated_at else None,
            )
            for n in session.scalars(
                select(m.TeamNote)
                .where(m.TeamNote.team_id.in_([t.id for t in teams]))
                .order_by(m.TeamNote.created_at.desc(), m.TeamNote.id)
            )
        ],
        **record_snapshot(session, cohort),
        fields=[
            s.FieldDefinition(
                id=f.id,
                label=f.label,
                type=f.type,
                options=f.options,
                placeholder=f.placeholder,
                required=f.required,
                show_in_list=f.show_in_list,
                visible_to_participant=f.visible_to_participant,
                archived=f.archived or None,
            )
            for f in session.scalars(
                select(m.FieldDefinition)
                .where(m.FieldDefinition.program_id == cohort.program_id)
                .order_by(m.FieldDefinition.position, m.FieldDefinition.id)
            )
        ],
    )


def as_utc(value: dt.datetime) -> dt.datetime:
    """SQLite gives back naive datetimes; they were stored in UTC."""
    return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)


def event_schema(e: m.Event) -> s.ProgramEvent:
    return s.ProgramEvent(
        id=e.id,
        cohort_id=e.cohort_id,
        title=e.title,
        category=e.category,
        date=e.date,
        end_date=e.end_date,
        start_time=e.start_time,
        end_time=e.end_time,
        location=e.location,
        host=e.host,
        description=e.description,
        links=e.links,
        is_required=e.is_required,
        checkin_token=e.checkin_token,
    )


def record_snapshot(session: Session, cohort: m.Cohort) -> dict:
    types = session.scalars(
        select(m.RecordType).where(m.RecordType.program_id == cohort.program_id).order_by(m.RecordType.position)
    ).all()
    type_ids = [t.id for t in types]
    fields: dict[str, list[s.RecordField]] = {t.id: [] for t in types}
    for f in session.scalars(
        select(m.RecordField).where(m.RecordField.type_id.in_(type_ids)).order_by(m.RecordField.position)
    ):
        fields[f.type_id].append(
            s.RecordField(
                id=f.id, label=f.label, type=f.type, options=f.options, required=f.required,
                link_to=f.link_to, multiple=f.multiple or None,
            )
        )
    calcs = session.scalars(
        select(m.Calculation)
        .where(m.Calculation.program_id == cohort.program_id)
        .order_by(m.Calculation.position)
    ).all()
    return dict(
        record_types=[
            s.RecordType(id=t.id, program_id=t.program_id, name=t.name, singular=t.singular, fields=fields[t.id])
            for t in types
        ],
        records=[
            s.CustomRecord(
                id=r.id, type_id=r.type_id, cohort_id=r.cohort_id, values=r.values,
                created_at=as_utc(r.created_at), updated_at=as_utc(r.updated_at) if r.updated_at else None,
            )
            for r in session.scalars(
                select(m.CustomRecord)
                .where(m.CustomRecord.cohort_id == cohort.id)
                .order_by(m.CustomRecord.created_at, m.CustomRecord.id)
            )
        ],
        calculations=[
            s.Calculation(
                id=c.id, program_id=c.program_id, label=c.label, on=c.on, kind=c.kind,
                source_type_id=c.source_type_id, via_field_id=c.via_field_id, date_field_id=c.date_field_id,
                filter=s.Condition.model_validate(c.filter) if c.filter else None,
            )
            for c in calcs
        ],
        rules=[
            s.Rule(
                id=r.id, calculation_id=r.calculation_id, op=r.op, value=r.value,
                when_empty=r.when_empty, status=r.status, message=r.message,
            )
            for r in session.scalars(
                select(m.Rule)
                .where(m.Rule.calculation_id.in_([c.id for c in calcs]))
                .order_by(m.Rule.position, m.Rule.id)
            )
        ],
        forms=[
            s.RecordForm(
                id=f.id, type_id=f.type_id, title=f.title, description=f.description, field_ids=f.field_ids,
                token=f.token, roster=f.roster, is_open=f.is_open,
            )
            for f in session.scalars(
                select(m.RecordForm).where(m.RecordForm.type_id.in_(type_ids)).order_by(m.RecordForm.position)
            )
        ],
    )
