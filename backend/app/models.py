"""Database tables. They mirror the frontend's types in frontend/lib/types.ts."""

import datetime as dt

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]


class Cohort(Base):
    __tablename__ = "cohorts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"))
    name: Mapped[str]
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date] = mapped_column(Date)


class Person(Base):
    """Long-lived CRM record for a human. Survives across cohorts."""

    __tablename__ = "people"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    # Lists keep the order records were added in.
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class Enrollment(Base):
    """A person's participation in one cohort."""

    __tablename__ = "enrollments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    person_id: Mapped[str] = mapped_column(ForeignKey("people.id"), index=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="active")  # active | withdrawn
    joined_at: Mapped[dt.date] = mapped_column(Date)
    left_at: Mapped[dt.date | None] = mapped_column(Date)
    # Custom field values keyed by field definition id.
    fields: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class FieldDefinition(Base):
    """An admin-defined participant field, such as Phone or Organization."""

    __tablename__ = "field_definitions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    program_id: Mapped[str] = mapped_column(ForeignKey("programs.id"), index=True)
    label: Mapped[str]
    type: Mapped[str]
    options: Mapped[list | None] = mapped_column(JSON)
    placeholder: Mapped[str | None]
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    show_in_list: Mapped[bool] = mapped_column(Boolean, default=False)
    visible_to_participant: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    # Display order in forms and profiles.
    position: Mapped[int] = mapped_column(Integer, default=0)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"), index=True)
    title: Mapped[str]
    partner: Mapped[str | None]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"), index=True)
    name: Mapped[str]
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class TeamMembership(Base):
    """Dated team membership, so team changes keep their history."""

    __tablename__ = "team_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    enrollment_id: Mapped[str] = mapped_column(ForeignKey("enrollments.id"), index=True)
    team_id: Mapped[str] = mapped_column(ForeignKey("teams.id"), index=True)
    start_date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"), index=True)
    title: Mapped[str]
    category: Mapped[str]
    date: Mapped[dt.date] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date)
    start_time: Mapped[str | None] = mapped_column(String(5))  # "HH:MM"
    end_time: Mapped[str | None] = mapped_column(String(5))
    location: Mapped[str | None]
    host: Mapped[str | None]
    description: Mapped[str | None] = mapped_column(Text)
    links: Mapped[list | None] = mapped_column(JSON)  # [{label, url}]
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    checkin_token: Mapped[str] = mapped_column(String, unique=True, index=True)


class Attendance(Base):
    __tablename__ = "attendance"

    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), primary_key=True)
    enrollment_id: Mapped[str] = mapped_column(ForeignKey("enrollments.id"), primary_key=True)
    source: Mapped[str]  # link | manual
    recorded_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class Requirement(Base):
    __tablename__ = "requirements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    cohort_id: Mapped[str] = mapped_column(ForeignKey("cohorts.id"), index=True)
    name: Mapped[str]
    scope: Mapped[str]  # participant | team
    type: Mapped[str]  # attendance_min | complete_by | team_min_size
    params: Mapped[dict] = mapped_column(JSON)
    position: Mapped[int] = mapped_column(Integer, default=0)


class Completion(Base):
    """Marks a complete_by requirement as done for a participant or team."""

    __tablename__ = "completions"

    requirement_id: Mapped[str] = mapped_column(ForeignKey("requirements.id"), primary_key=True)
    subject_id: Mapped[str] = mapped_column(String, primary_key=True)  # enrollment or team id
    completed_at: Mapped[dt.date] = mapped_column(Date)


class Exemption(Base):
    """Excuses a participant or team from one requirement."""

    __tablename__ = "exemptions"

    requirement_id: Mapped[str] = mapped_column(ForeignKey("requirements.id"), primary_key=True)
    subject_id: Mapped[str] = mapped_column(String, primary_key=True)
    reason: Mapped[str | None]


class User(Base):
    """Someone who runs programs and signs in to the admin side."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    job_title: Mapped[str | None]
    pronouns: Mapped[str | None]
    phone: Mapped[str | None]
    role: Mapped[str] = mapped_column(String, default="admin")  # admin | participant
    # scrypt hash; None means the account can't sign in yet.
    password_hash: Mapped[str | None]
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)


class UserSession(Base):
    """A signed-in browser. The id is a hash of the token in its cookie."""

    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
