"""The Program Ops API.

Admin routes return the whole cohort after every change, in the same shape
the frontend already uses, so the frontend just swaps in the new data.
"""

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from sqlalchemy.orm import Session

from . import models as m
from . import schemas as s
from .auth import (
    COOKIE,
    LOCK_MINUTES,
    SESSION_DAYS,
    end_session,
    find_user,
    is_locked,
    record_login,
    require_admin,
    require_manager,
    start_session,
    verify_password,
)
from .config import settings
from .db import get_session
from .seed import reset
from .services import actions
from .services import records
from .services import personal
from .services import team
from .services.requirements import participant_summary, team_summary
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
        participants={e.id: participant_summary(data, e.id) for e in data.enrollments if e.status == "active"},
        teams={t.id: team_summary(data, t) for t in data.teams},
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


@admin.put("/api/requirements/{requirement_id}", response_model=s.CohortData, **api)
def update_requirement(
    requirement_id: str,
    body: s.RequirementIn,
    session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    actions.update_requirement(session, cohort, requirement_id, body)
    return saved(session, cohort)


@admin.delete("/api/requirements/{requirement_id}", response_model=s.CohortData, **api)
def delete_requirement(
    requirement_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.delete_requirement(session, cohort, requirement_id)
    return saved(session, cohort)


# ---- Notes ----


@admin.post("/api/notes", response_model=s.CohortData, **api)
def add_note(
    body: s.NoteCreate,
    session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
    user: m.User = Depends(require_admin),
):
    actions.add_note(session, cohort, body, user.name)
    return saved(session, cohort)


@admin.patch("/api/notes/{note_id}", response_model=s.CohortData, **api)
def update_note(
    note_id: str, body: s.NotePatch, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.update_note(session, cohort, note_id, body)
    return saved(session, cohort)


@admin.delete("/api/notes/{note_id}", response_model=s.CohortData, **api)
def delete_note(note_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.delete_note(session, cohort, note_id)
    return saved(session, cohort)


# ---- Partners and owners ----


@admin.post("/api/partners", response_model=s.CohortData, **api)
def add_partner(
    body: s.PartnerCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.add_partner(session, cohort, body)
    return saved(session, cohort)


@admin.patch("/api/partners/{partner_id}", response_model=s.CohortData, **api)
def update_partner(
    partner_id: str, body: s.PartnerPatch, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    actions.update_partner(session, cohort, partner_id, body)
    return saved(session, cohort)


@admin.post("/api/partners/{partner_id}/contacts", response_model=s.CohortData, **api)
def add_contact(
    partner_id: str, body: s.PartnerContactCreate, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    actions.add_contact(session, cohort, partner_id, body)
    return saved(session, cohort)


@admin.delete("/api/partner-contacts/{contact_id}", response_model=s.CohortData, **api)
def delete_contact(contact_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.delete_contact(session, cohort, contact_id)
    return saved(session, cohort)


@admin.put("/api/projects/{project_id}/partner", response_model=s.CohortData, **api)
def set_project_partner(
    project_id: str, body: s.ProjectPartner, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    actions.set_project_partner(session, cohort, project_id, body.partner_id)
    return saved(session, cohort)


@admin.put("/api/teams/{team_id}/owner", response_model=s.CohortData, **api)
def set_team_owner(
    team_id: str, body: s.TeamOwner, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    actions.set_team_owner(session, cohort, team_id, body.owner_id)
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


@admin.delete("/api/events/{event_id}", response_model=s.CohortData, **api)
def delete_event(event_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    actions.delete_event(session, cohort, event_id)
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


@admin.get("/api/me/items", response_model=list[s.PersonalItem], **api)
def get_my_items(session: Session = Depends(get_session), user: m.User = Depends(require_admin)):
    return personal.items(session, user)


@admin.post("/api/me/items", response_model=list[s.PersonalItem], **api)
def add_my_item(
    body: s.PersonalItemIn, session: Session = Depends(get_session), user: m.User = Depends(require_admin)
):
    personal.add(session, user, body)
    session.commit()
    return personal.items(session, user)


@admin.patch("/api/me/items/{item_id}", response_model=list[s.PersonalItem], **api)
def update_my_item(
    item_id: str, body: s.PersonalItemPatch, session: Session = Depends(get_session),
    user: m.User = Depends(require_admin),
):
    personal.update(session, user, item_id, body)
    session.commit()
    return personal.items(session, user)


@admin.delete("/api/me/items/{item_id}", response_model=list[s.PersonalItem], **api)
def delete_my_item(item_id: str, session: Session = Depends(get_session), user: m.User = Depends(require_admin)):
    personal.remove(session, user, item_id)
    session.commit()
    return personal.items(session, user)


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
    if user is not None and is_locked(user):
        raise HTTPException(
            status_code=429, detail=f"Too many tries. Wait {LOCK_MINUTES} minutes, or ask your manager for a new link."
        )
    correct = user is not None and verify_password(body.password, user.password_hash)
    if user is not None:
        record_login(user, correct)
    # Same message whether the email or the password is wrong, so it can't be
    # used to find out who has an account.
    if not correct:
        session.commit()
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return signed_in(session, response, user)


def signed_in(session: Session, response: Response, user: m.User) -> s.Profile:
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


# ---- Invitations (public: the token in the link is the proof) ----


@app.get("/api/invites/{token}", response_model=s.InviteInfo, **api)
def invite_info(token: str, session: Session = Depends(get_session)):
    cohort = current_cohort(session)
    program = session.get(m.Program, cohort.program_id) if cohort else None
    return team.invite_info(session, token, program.name if program else None)


@app.post("/api/invites/{token}", response_model=s.Profile, **api)
def accept_invite(token: str, body: s.SetPassword, response: Response, session: Session = Depends(get_session)):
    return signed_in(session, response, team.accept(session, token, body.password))


# ---- Team access (managers only, except seeing who's on it) ----


@admin.get("/api/team", response_model=list[s.TeamMember], **api)
def get_team(session: Session = Depends(get_session)):
    return team.members(session)


@admin.post("/api/team/invites", response_model=s.InviteLink, **api)
def invite_member(
    body: s.InviteCreate, session: Session = Depends(get_session), manager: m.User = Depends(require_manager)
):
    link = team.invite(session, manager, body)
    session.commit()
    return link


@admin.post("/api/team/{user_id}/link", response_model=s.InviteLink, **api)
def new_member_link(
    user_id: str, session: Session = Depends(get_session), manager: m.User = Depends(require_manager)
):
    link = team.new_link(session, manager, user_id)
    session.commit()
    return link


@admin.patch("/api/team/{user_id}", response_model=list[s.TeamMember], **api)
def change_member_role(
    user_id: str, body: s.RoleChange, session: Session = Depends(get_session),
    manager: m.User = Depends(require_manager),
):
    team.change_role(session, manager, user_id, body.role)
    session.commit()
    return team.members(session)


@admin.delete("/api/team/{user_id}", response_model=list[s.TeamMember], **api)
def remove_member(user_id: str, session: Session = Depends(get_session), manager: m.User = Depends(require_manager)):
    team.remove(session, manager, user_id)
    session.commit()
    return team.members(session)


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


# ---- Forms (public: anyone with the link) ----


@app.get("/api/f/{token}", response_model=s.PublicForm, **api)
def form_info(token: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    form = records.form_by_token(session, token)
    program = session.get(m.Program, cohort.program_id)
    asked = {f.id: f for f in records.fields_of(session, form.type_id)}
    return s.PublicForm(
        title=form.title, description=form.description, program_name=program.name, roster=form.roster,
        fields=[
            s.RecordField(id=f.id, label=f.label, type=f.type, options=f.options, required=f.required)
            for f in (asked[i] for i in form.field_ids if i in asked)
        ],
    )


@app.post("/api/f/{token}", response_model=s.FormResult, **api)
def submit_form(
    token: str, body: s.FormSubmission, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    result = records.submit_form(session, cohort, records.form_by_token(session, token), body)
    session.commit()
    return result


# ---- Custom record types ----


@admin.post("/api/record-types", response_model=s.CohortData, **api)
def add_record_type(
    body: s.RecordTypeCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    records.add_type(session, cohort, body)
    return saved(session, cohort)


@admin.patch("/api/record-types/{type_id}", response_model=s.CohortData, **api)
def update_record_type(
    type_id: str, body: s.RecordTypePatch, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    records.update_type(session, cohort, type_id, body)
    return saved(session, cohort)


@admin.delete("/api/record-types/{type_id}", response_model=s.CohortData, **api)
def delete_record_type(type_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_type(session, cohort, type_id)
    return saved(session, cohort)


@admin.post("/api/record-types/{type_id}/fields", response_model=s.CohortData, **api)
def add_record_field(
    type_id: str, body: s.RecordFieldCreate, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    records.add_field(session, cohort, type_id, body)
    return saved(session, cohort)


@admin.patch("/api/record-fields/{field_id}", response_model=s.CohortData, **api)
def update_record_field(
    field_id: str, body: s.RecordFieldPatch, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    records.update_field(session, cohort, field_id, body)
    return saved(session, cohort)


@admin.post("/api/record-fields/{field_id}/move", response_model=s.CohortData, **api)
def move_record_field(
    field_id: str, body: s.MoveField, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    records.move_field(session, cohort, field_id, body.to_index)
    return saved(session, cohort)


@admin.delete("/api/record-fields/{field_id}", response_model=s.CohortData, **api)
def delete_record_field(field_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_field(session, cohort, field_id)
    return saved(session, cohort)


@admin.post("/api/records", response_model=s.CohortData, **api)
def add_record(body: s.RecordCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.add_record(session, cohort, body)
    return saved(session, cohort)


@admin.put("/api/records/{record_id}", response_model=s.CohortData, **api)
def update_record(
    record_id: str, body: s.RecordValues, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    records.update_record(session, cohort, record_id, body.values)
    return saved(session, cohort)


@admin.delete("/api/records/{record_id}", response_model=s.CohortData, **api)
def delete_record(record_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_record(session, cohort, record_id)
    return saved(session, cohort)


@admin.post("/api/calculations", response_model=s.CohortData, **api)
def add_calculation(
    body: s.CalculationCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)
):
    records.add_calculation(session, cohort, body)
    return saved(session, cohort)


@admin.delete("/api/calculations/{calc_id}", response_model=s.CohortData, **api)
def delete_calculation(calc_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_calculation(session, cohort, calc_id)
    return saved(session, cohort)


@admin.post("/api/rules", response_model=s.CohortData, **api)
def add_rule(body: s.RuleCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.add_rule(session, cohort, body)
    return saved(session, cohort)


@admin.delete("/api/rules/{rule_id}", response_model=s.CohortData, **api)
def delete_rule(rule_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_rule(session, cohort, rule_id)
    return saved(session, cohort)


@admin.post("/api/forms", response_model=s.CohortData, **api)
def add_form(body: s.RecordFormCreate, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.add_form(session, cohort, body)
    return saved(session, cohort)


@admin.patch("/api/forms/{form_id}", response_model=s.CohortData, **api)
def update_form(
    form_id: str, body: s.RecordFormPatch, session: Session = Depends(get_session),
    cohort: m.Cohort = Depends(cohort_dep),
):
    records.update_form(session, cohort, form_id, body)
    return saved(session, cohort)


@admin.delete("/api/forms/{form_id}", response_model=s.CohortData, **api)
def delete_form(form_id: str, session: Session = Depends(get_session), cohort: m.Cohort = Depends(cohort_dep)):
    records.delete_form(session, cohort, form_id)
    return saved(session, cohort)


app.include_router(admin)
