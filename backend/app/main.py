"""The Program Ops API.

Admin routes return the whole cohort after every change, in the same shape
the frontend already uses, so the frontend just swaps in the new data.
"""

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from sqlalchemy.orm import Session

from . import models as m
from . import schemas as s
from .auth import COOKIE, SESSION_DAYS, end_session, find_user, require_admin, start_session, verify_password
from .config import settings
from .db import get_session
from .seed import reset
from .services import actions
from .services.requirements import participant_status, team_status
from .snapshot import build_snapshot, current_cohort, event_schema

app = FastAPI(title="Program Ops API")
# Everything except health, sign-in and check-in needs a signed-in admin.
admin = APIRouter(dependencies=[Depends(require_admin)])


def cohort_dep(session: Session = Depends(get_session)) -> m.Cohort:
    cohort = current_cohort(session)
    if cohort is None:
        raise HTTPException(status_code=503, detail="No cohort yet. Run: python -m app.seed")
    return cohort


def saved(session: Session, cohort: m.Cohort) -> s.CohortData:
    session.commit()
    return build_snapshot(session, cohort)


# Responses leave out empty optional fields, like the frontend's optional types.
api = {"response_model_exclude_none": True}


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@admin.get("/api/cohort", response_model=s.CohortData, **api)
def get_cohort(session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    return build_snapshot(session, cohort)


@admin.get("/api/statuses", response_model=s.Statuses, **api)
def get_statuses(session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    data = build_snapshot(session, cohort)
    return s.Statuses(
        participants={e.id: participant_status(data, e.id) for e in data.enrollments if e.status == "active"},
        teams={t.id: team_status(data, t) for t in data.teams},
    )


# ---- Attendance and requirements ----


@admin.post("/api/attendance/toggle", response_model=s.CohortData, **api)
def toggle_attendance(
    body: s.AttendanceToggle, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.toggle_attendance(session, cohort, body.event_id, body.enrollment_id)
    return saved(session, cohort)


@admin.post("/api/completions/toggle", response_model=s.CohortData, **api)
def toggle_completion(
    body: s.CompletionToggle, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.toggle_completion(session, cohort, body.requirement_id, body.subject_id, settings.today())
    return saved(session, cohort)


@admin.post("/api/requirements", response_model=s.CohortData, **api)
def add_requirement(
    body: s.RequirementIn, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.add_requirement(session, cohort, body)
    return saved(session, cohort)


@admin.delete("/api/requirements/{requirement_id}", response_model=s.CohortData, **api)
def delete_requirement(
    requirement_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.delete_requirement(session, cohort, requirement_id)
    return saved(session, cohort)


# ---- Team notes ----


@admin.post("/api/teams/{team_id}/notes", response_model=s.CohortData, **api)
def add_team_note(
    team_id: str,
    body: s.TeamNoteIn,
    session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
    user: m.User = Depends(require_admin),
):
    actions.add_team_note(session, cohort, team_id, body.body, user.name)
    return saved(session, cohort)


@admin.patch("/api/team-notes/{note_id}", response_model=s.CohortData, **api)
def update_team_note(
    note_id: str, body: s.TeamNoteIn, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.update_team_note(session, cohort, note_id, body.body)
    return saved(session, cohort)


@admin.delete("/api/team-notes/{note_id}", response_model=s.CohortData, **api)
def delete_team_note(note_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.delete_team_note(session, cohort, note_id)
    return saved(session, cohort)


# ---- Participants ----


@admin.put("/api/participants/{enrollment_id}", response_model=s.CohortData, **api)
def update_participant(
    enrollment_id: str,
    body: s.ParticipantDraft,
    session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    actions.update_participant(session, cohort, enrollment_id, body, settings.today())
    return saved(session, cohort)


@admin.post("/api/participants", response_model=s.AddParticipantsResult, **api)
def add_participants(
    body: s.AddParticipants, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    added = actions.add_participants(session, cohort, body.rows, settings.today())
    return s.AddParticipantsResult(added=added, data=saved(session, cohort))


# ---- Events ----


@admin.post("/api/events", response_model=s.CohortData, **api)
def add_event(body: s.EventIn, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.add_event(session, cohort, body)
    return saved(session, cohort)


@admin.patch("/api/events/{event_id}", response_model=s.CohortData, **api)
def update_event(
    event_id: str, body: s.EventPatch, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.update_event(session, cohort, event_id, body)
    return saved(session, cohort)


# ---- Custom fields ----


@admin.post("/api/fields", response_model=s.CohortData, **api)
def add_field(
    body: s.FieldDefinitionIn, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.add_field(session, cohort, body)
    return saved(session, cohort)


@admin.patch("/api/fields/{field_id}", response_model=s.CohortData, **api)
def update_field(
    field_id: str, body: s.FieldPatch, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.update_field(session, cohort, field_id, body)
    return saved(session, cohort)


@admin.post("/api/fields/{field_id}/move", response_model=s.CohortData, **api)
def move_field(
    field_id: str, body: s.MoveField, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.move_field(session, cohort, field_id, body.to_index)
    return saved(session, cohort)


@admin.delete("/api/fields/{field_id}", response_model=s.CohortData, **api)
def delete_field(field_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.delete_field(session, cohort, field_id)
    return saved(session, cohort)


# ---- Signed-in user ----


def profile_schema(user: m.User) -> s.Profile:
    return s.Profile(
        id=user.id, name=user.name, email=user.email, job_title=user.job_title,
        pronouns=user.pronouns, phone=user.phone, role=user.role,
    )


@admin.get("/api/me", response_model=s.Profile, **api)
def get_me(user: m.User = Depends(require_admin)):
    return profile_schema(user)


@admin.put("/api/me", response_model=s.Profile, **api)
def update_me(body: s.ProfileIn, session: Session = Depends(get_session), user: m.User = Depends(require_admin)):
    actions.update_profile(session, user, body)
    session.commit()
    return profile_schema(user)


# ---- Sign in ----


@app.post("/api/auth/login", response_model=s.Profile, **api)
def login(body: s.LoginRequest, response: Response, session: Session = Depends(get_session)):
    user = find_user(session, body.email)
    # Same message whether the email or the password is wrong, so it can't be
    # used to find out who has an account.
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token = start_session(session, user)
    session.commit()
    response.set_cookie(
        COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return profile_schema(user)


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    end_session(session, request.cookies.get(COOKIE))
    session.commit()
    response.delete_cookie(COOKIE, path="/")


# ---- Demo data ----


@admin.post("/api/reset", response_model=s.CohortData, **api)
def reset_demo(session: Session = Depends(get_session)):
    if not settings.allow_reset:
        raise HTTPException(status_code=403, detail="Resetting is turned off here.")
    reset(session)
    session.commit()
    return build_snapshot(session, current_cohort(session))


# ---- Public check-in (no login, reveals nothing about participants) ----


@app.get("/api/checkin/{token}", response_model=s.CheckinInfo, **api)
def checkin_info(token: str, session: Session = Depends(get_session)):
    event = actions.checkin_event(session, token)
    cohort = session.get(m.Cohort, event.cohort_id)
    program = session.get(m.Program, cohort.program_id)
    return s.CheckinInfo(
        program_name=program.name, cohort_name=cohort.name, today=settings.today(), event=event_schema(event)
    )


@app.post("/api/checkin/{token}", response_model=s.CheckinResult, **api)
def checkin(token: str, body: s.CheckinRequest, session: Session = Depends(get_session)):
    event = actions.checkin_event(session, token)
    result = actions.check_in(session, event, body.email, settings.today())
    session.commit()
    return result


app.include_router(admin)
