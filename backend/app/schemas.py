"""API shapes. Field names are camelCase on the wire to match frontend/lib/types.ts."""

import datetime as dt
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

EventCategory = Literal[
    "workshop", "talk", "panel", "meeting", "all-hands", "office-hours", "mentoring",
    "orientation", "showcase", "partner", "networking", "social", "other",
]
FieldType = Literal["text", "long_text", "number", "date", "select", "multi_select", "checkbox", "url"]
FieldValue = str | int | float | bool | list[str]
Status = Literal["met", "on_track", "at_risk", "missing"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---- Cohort data, as the frontend uses it ----


class Program(CamelModel):
    id: str
    name: str


class Cohort(CamelModel):
    id: str
    program_id: str
    name: str
    start_date: dt.date
    end_date: dt.date


class Person(CamelModel):
    id: str
    name: str
    email: str


class Enrollment(CamelModel):
    id: str
    person_id: str
    cohort_id: str
    status: Literal["active", "withdrawn"]
    joined_at: dt.date
    left_at: dt.date | None = None
    fields: dict[str, FieldValue] | None = None


class FieldDefinitionIn(CamelModel):
    label: str
    type: FieldType
    options: list[str] | None = None
    placeholder: str | None = None
    required: bool = False
    show_in_list: bool = False
    visible_to_participant: bool = False
    archived: bool | None = None


class FieldDefinition(FieldDefinitionIn):
    id: str


class Project(CamelModel):
    id: str
    cohort_id: str
    title: str
    partner: str | None = None


class Team(CamelModel):
    id: str
    cohort_id: str
    name: str
    project_id: str | None = None


class TeamMembership(CamelModel):
    enrollment_id: str
    team_id: str
    start_date: dt.date
    end_date: dt.date | None = None


class EventLink(CamelModel):
    label: str
    url: str


class EventIn(CamelModel):
    title: str
    category: EventCategory
    date: dt.date
    end_date: dt.date | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    host: str | None = None
    description: str | None = None
    links: list[EventLink] | None = None
    is_required: bool = True


class EventPatch(CamelModel):
    """Only the fields sent are changed; send null to clear one."""

    title: str | None = None
    category: EventCategory | None = None
    date: dt.date | None = None
    end_date: dt.date | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    host: str | None = None
    description: str | None = None
    links: list[EventLink] | None = None
    is_required: bool | None = None


class ProgramEvent(EventIn):
    id: str
    cohort_id: str
    checkin_token: str


class Attendance(CamelModel):
    event_id: str
    enrollment_id: str
    source: Literal["link", "manual"]


class RequirementIn(CamelModel):
    name: str
    scope: Literal["participant", "team"]
    type: Literal["attendance_min", "complete_by", "team_min_size"]
    params: dict[str, Any]


class Requirement(RequirementIn):
    id: str


class Completion(CamelModel):
    requirement_id: str
    subject_id: str
    completed_at: dt.date


class Exemption(CamelModel):
    requirement_id: str
    subject_id: str
    reason: str | None = None


class TeamNote(CamelModel):
    id: str
    team_id: str
    body: str
    author: str | None = None
    created_at: dt.datetime
    updated_at: dt.datetime | None = None


class TeamNoteIn(CamelModel):
    body: str


class CohortData(CamelModel):
    program: Program
    cohort: Cohort
    today: dt.date
    people: list[Person]
    enrollments: list[Enrollment]
    projects: list[Project]
    teams: list[Team]
    memberships: list[TeamMembership]
    events: list[ProgramEvent]
    attendance: list[Attendance]
    requirements: list[Requirement]
    completions: list[Completion]
    exemptions: list[Exemption]
    fields: list[FieldDefinition]
    team_notes: list[TeamNote] = []


# ---- Computed status ----


class RequirementResult(CamelModel):
    requirement_id: str
    status: Status
    reason: str
    excused: bool | None = None


class SubjectStatus(CamelModel):
    status: Status
    results: list[RequirementResult]
    flags: list[str]


class Statuses(CamelModel):
    participants: dict[str, SubjectStatus]
    teams: dict[str, SubjectStatus]


# ---- Requests ----


class AttendanceToggle(CamelModel):
    event_id: str
    enrollment_id: str


class CompletionToggle(CamelModel):
    requirement_id: str
    subject_id: str


class ParticipantDraft(CamelModel):
    """Everything edited at once in the participant page's edit mode."""

    name: str
    email: str
    fields: dict[str, FieldValue]
    team_id: str | None = None
    attended_event_ids: list[str]
    completions: dict[str, dt.date]
    exemptions: dict[str, str]


class NewParticipant(CamelModel):
    name: str
    email: str
    team: str | None = None
    fields: dict[str, FieldValue] | None = None


class AddParticipants(CamelModel):
    rows: list[NewParticipant]


class AddParticipantsResult(CamelModel):
    added: int
    data: CohortData


class MoveField(CamelModel):
    to_index: int


class FieldPatch(CamelModel):
    label: str | None = None
    type: FieldType | None = None
    options: list[str] | None = None
    placeholder: str | None = None
    required: bool | None = None
    show_in_list: bool | None = None
    visible_to_participant: bool | None = None
    archived: bool | None = None


# ---- Public check-in ----


class CheckinInfo(CamelModel):
    """What the public check-in page shows. Contains nothing about participants."""

    program_name: str
    cohort_name: str
    today: dt.date
    event: ProgramEvent


class CheckinRequest(CamelModel):
    email: str


class CheckinResult(CamelModel):
    status: Literal["checked_in", "already_checked_in", "not_found", "not_open", "closed"]
    first_name: str | None = None


# ---- Signed-in user ----


class ProfileIn(CamelModel):
    name: str
    email: str
    job_title: str | None = None
    pronouns: str | None = None
    phone: str | None = None


class Profile(ProfileIn):
    id: str
    role: str


class LoginRequest(CamelModel):
    email: str
    password: str
