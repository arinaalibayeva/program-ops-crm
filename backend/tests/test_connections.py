"""How records connect: partners, notes, owners, and record-based requirements."""

import json
from pathlib import Path

from app import models as m
from app.schemas import CohortData
from app.seed import load_sample, reset
from app.services.requirements import calculate, evaluate_rules, participant_summary, team_summary

SAMPLE = json.loads((Path(__file__).parents[1] / "app" / "sample" / "cohort.json").read_text())
TEAM = SAMPLE["teams"][0]["id"]
ENROLLMENT = SAMPLE["enrollments"][0]["id"]
PARTNER = SAMPLE["partners"][0]["id"]
ADMIN = "user-admin"


INTERNS = {s["id"] for s in SAMPLE["staff"] if s.get("jobTitle") == "Intern"}


def test_cohort_lists_staff_but_not_participants(client):
    staff = {s["id"] for s in client.get("/api/cohort").json()["staff"]}
    assert staff == INTERNS | {ADMIN}


def test_interns_cover_every_team_and_cannot_sign_in(client, session_factory):
    assert len(INTERNS) == 4
    teams = client.get("/api/cohort").json()["teams"]
    assert {t["ownerId"] for t in teams} == INTERNS
    with session_factory() as session:
        assert all(session.get(m.User, i).password_hash is None for i in INTERNS)


# ---- Notes ----


def test_notes_work_on_people_teams_and_partners(client):
    for subject_type, subject_id in (("participant", ENROLLMENT), ("team", TEAM), ("partner", PARTNER)):
        body = {"id": f"note-{subject_type}12345", "subjectType": subject_type, "subjectId": subject_id,
                "body": "  Talked to them.  ", "followUpDate": "2026-10-21"}
        notes = client.post("/api/notes", json=body).json()["notes"]
        note = next(n for n in notes if n["id"] == body["id"])
        assert (note["subjectType"], note["subjectId"], note["body"]) == (subject_type, subject_id, "Talked to them.")
        assert note["author"] == "Test Admin" and note["followUpDone"] is False


def test_note_edit_follow_up_and_delete(client):
    client.post("/api/notes", json={"id": "note-abcdef12", "subjectType": "team", "subjectId": TEAM, "body": "Hi",
                                    "followUpDate": "2026-10-21"})

    def note(data):
        return next(n for n in data["notes"] if n["id"] == "note-abcdef12")

    edited = note(client.patch("/api/notes/note-abcdef12", json={"body": "Hello"}).json())
    assert edited["body"] == "Hello" and edited["updatedAt"] and edited["followUpDate"] == "2026-10-21"

    done = note(client.patch("/api/notes/note-abcdef12", json={"followUpDone": True}).json())
    assert done["followUpDone"] is True and done["body"] == "Hello"

    cleared = note(client.patch("/api/notes/note-abcdef12", json={"followUpDate": None}).json())
    assert "followUpDate" not in cleared

    after = client.delete("/api/notes/note-abcdef12").json()["notes"]
    assert not any(n["id"] == "note-abcdef12" for n in after)


def test_note_validation(client):
    body = {"subjectType": "team", "subjectId": TEAM, "body": "   "}
    assert client.post("/api/notes", json=body).status_code == 400
    assert client.post("/api/notes", json={**body, "subjectId": "nope", "body": "Hi"}).status_code == 404
    assert client.post("/api/notes", json={**body, "subjectType": "event", "body": "Hi"}).status_code == 422
    assert client.patch("/api/notes/nope", json={"body": "Hi"}).status_code == 404


def test_notes_need_sign_in(anonymous):
    response = anonymous.post("/api/notes", json={"subjectType": "team", "subjectId": TEAM, "body": "Hi"})
    assert response.status_code == 401


# ---- Partners ----


def test_add_and_update_partner_with_contacts(client):
    data = client.post("/api/partners", json={"id": "partner-newone12", "name": " New Org ", "ownerId": ADMIN}).json()
    assert next(p for p in data["partners"] if p["id"] == "partner-newone12")["name"] == "New Org"

    data = client.patch("/api/partners/partner-newone12", json={"website": "https://new.example.org", "ownerId": None}).json()
    partner = next(p for p in data["partners"] if p["id"] == "partner-newone12")
    assert partner["website"] == "https://new.example.org" and "ownerId" not in partner

    data = client.post("/api/partners/partner-newone12/contacts",
                       json={"id": "contact-abc123", "name": "Ana", "email": "ana@new.example.org"}).json()
    assert next(p for p in data["partners"] if p["id"] == "partner-newone12")["contacts"][0]["name"] == "Ana"

    data = client.delete("/api/partner-contacts/contact-abc123").json()
    assert next(p for p in data["partners"] if p["id"] == "partner-newone12")["contacts"] == []


def test_partner_validation(client):
    assert client.post("/api/partners", json={"name": " "}).status_code == 400
    assert client.post("/api/partners", json={"name": SAMPLE["partners"][0]["name"].upper()}).status_code == 400
    assert client.post("/api/partners", json={"name": "X", "website": "javascript:alert(1)"}).status_code == 400
    assert client.post("/api/partners", json={"name": "X", "ownerId": "user-p"}).status_code == 404  # not staff
    assert client.patch(f"/api/partners/{PARTNER}", json={"website": "javascript:alert(1)"}).status_code == 400
    assert client.post(f"/api/partners/{PARTNER}/contacts", json={"name": "A", "email": "nope"}).status_code == 400


def test_project_partner_can_change_and_clear(client):
    project = SAMPLE["projects"][0]["id"]
    other = SAMPLE["partners"][1]["id"]
    data = client.put(f"/api/projects/{project}/partner", json={"partnerId": other}).json()
    assert next(p for p in data["projects"] if p["id"] == project)["partnerId"] == other
    data = client.put(f"/api/projects/{project}/partner", json={"partnerId": None}).json()
    assert "partnerId" not in next(p for p in data["projects"] if p["id"] == project)
    assert client.put(f"/api/projects/{project}/partner", json={"partnerId": "nope"}).status_code == 404


def test_event_can_belong_to_a_partner(client):
    event = SAMPLE["events"][0]["id"]
    data = client.patch(f"/api/events/{event}", json={"partnerId": PARTNER}).json()
    assert next(e for e in data["events"] if e["id"] == event)["partnerId"] == PARTNER
    assert client.patch(f"/api/events/{event}", json={"partnerId": "nope"}).status_code == 404


def test_an_event_can_be_crossed_off_and_back(client):
    deadline = SAMPLE["events"][0]["id"]

    def event(data):
        return next(e for e in data["events"] if e["id"] == deadline)

    assert event(client.patch(f"/api/events/{deadline}", json={"completed": True}).json())["completed"] is True
    assert event(client.get("/api/cohort").json())["completed"] is True
    assert "completed" not in event(client.patch(f"/api/events/{deadline}", json={"completed": False}).json())


# ---- Owners ----


def test_team_owner(client):
    data = client.put(f"/api/teams/{TEAM}/owner", json={"ownerId": ADMIN}).json()
    assert next(t for t in data["teams"] if t["id"] == TEAM)["ownerId"] == ADMIN
    assert client.put(f"/api/teams/{TEAM}/owner", json={"ownerId": "user-p"}).status_code == 404
    data = client.put(f"/api/teams/{TEAM}/owner", json={"ownerId": None}).json()
    assert "ownerId" not in next(t for t in data["teams"] if t["id"] == TEAM)


def test_removing_staff_frees_what_they_looked_after(client):
    invited = client.post("/api/team/invites", json={"name": "New", "email": "new@example.edu"}).json()["member"]["id"]
    client.put(f"/api/teams/{TEAM}/owner", json={"ownerId": invited})
    client.patch(f"/api/partners/{PARTNER}", json={"ownerId": invited})

    assert client.delete(f"/api/team/{invited}").status_code == 200

    data = client.get("/api/cohort").json()
    assert "ownerId" not in next(t for t in data["teams"] if t["id"] == TEAM)
    assert "ownerId" not in next(p for p in data["partners"] if p["id"] == PARTNER)


def test_reset_keeps_interns_assigned_without_duplicating_them(session_factory):
    with session_factory() as session:
        reset(session)
        session.flush()
        assert {t.owner_id for t in session.query(m.Team)} == INTERNS
        assert {p.owner_id for p in session.query(m.Partner)} == INTERNS
        assert session.query(m.User).filter(m.User.job_title == "Intern").count() == 4


# ---- Requirements met by records ----

REPORTS = {"typeId": "rt-reports", "viaFieldId": "rf-r-team", "minCount": 1, "dateFieldId": "rf-r-date"}


def requirement(**params) -> dict:
    return {"id": "r", "name": "Report", "scope": "team", "type": "record_by", "params": {**REPORTS, **params}}


def with_requirement(data: CohortData, req: dict, records: list[dict] | None = None) -> CohortData:
    raw = data.model_dump(mode="json", by_alias=True)
    raw["requirements"], raw["records"] = [req], records or []
    raw["calculations"], raw["rules"] = [], []
    return CohortData.model_validate(raw)


def report(date: str, month: str = "September") -> dict:
    return {"id": f"rec-{date}", "typeId": "rt-reports", "cohortId": "c-fall-2026", "createdAt": f"{date}T10:00:00Z",
            "values": {"rf-r-title": "R", "rf-r-date": date, "rf-r-team": TEAM, "rf-r-month": month}}


def result_for(data: CohortData):
    return team_summary(data, next(t for t in data.teams if t.id == TEAM)).results[0]


def test_record_requirement_statuses():
    sample = load_sample()  # today is 2026-10-19
    on_time = result_for(with_requirement(sample, requirement(dueDate="2026-10-30"), [report("2026-10-01")]))
    assert (on_time.status, on_time.reason) == ("met", "Report logged (1)")

    late = result_for(with_requirement(sample, requirement(dueDate="2026-10-05"), [report("2026-10-07")]))
    assert (late.status, late.reason) == ("met", "Report logged late, after Oct 5")

    overdue = result_for(with_requirement(sample, requirement(dueDate="2026-10-05")))
    assert (overdue.status, overdue.reason) == ("missing", "Report overdue by 14 days, 0 of 1 logged")

    soon = result_for(with_requirement(sample, requirement(dueDate="2026-10-22")))
    assert (soon.status, soon.reason) == ("at_risk", "Report due in 3 days, 0 of 1 logged")

    later = result_for(with_requirement(sample, requirement(dueDate="2026-11-22")))
    assert later.status == "on_track"


def test_record_requirement_counts_only_matching_records():
    """September's report doesn't count towards October's."""
    sample = load_sample()
    october = requirement(dueDate="2026-10-05", filter={"fieldId": "rf-r-month", "op": "is", "value": "October"})
    assert result_for(with_requirement(sample, october, [report("2026-10-01")])).status == "missing"
    assert result_for(with_requirement(sample, october, [report("2026-10-01", "October")])).status == "met"


def test_form_submission_completes_a_record_requirement(client, anonymous):
    """Nobody ticks a box: logging the report is what clears the flag."""
    missing_team = SAMPLE["teams"][9]["id"]

    def status():
        team = client.get("/api/statuses").json()["teams"][missing_team]
        return next(r for r in team["results"] if r["requirementId"] == "req-7")["status"]

    assert status() == "missing"
    member = next(m for m in SAMPLE["memberships"] if m["teamId"] == missing_team and "endDate" not in m)
    enrollment = next(e for e in SAMPLE["enrollments"] if e["id"] == member["enrollmentId"])
    person = next(p for p in SAMPLE["people"] if p["id"] == enrollment["personId"])
    result = anonymous.post("/api/f/submit-report-demo", json={
        "email": person["email"], "values": {"rf-r-title": "Report", "rf-r-date": "2026-10-19", "rf-r-month": "September"},
    }).json()
    assert result["status"] == "saved"
    assert status() == "met"


def test_record_requirement_validation(client):
    def add(**params):
        return client.post("/api/requirements", json={
            "name": "R", "scope": "team", "type": "record_by",
            "params": {**REPORTS, "dueDate": "2026-11-01", **params},
        })

    assert add().status_code == 200
    assert add(typeId="nope").status_code == 400
    assert add(viaFieldId="rf-m-team").status_code == 400  # a field on another type
    assert add(viaFieldId="rf-r-title").status_code == 400  # not a link
    assert add(dateFieldId="rf-r-title").status_code == 400  # not a date
    assert add(filter={"fieldId": "rf-m-summary", "op": "is", "value": "x"}).status_code == 400  # another type's field
    assert add(filter={"fieldId": "rf-r-month", "op": "is", "value": "October"}).status_code == 200

    assert add(minCount=0).status_code == 400
    assert add(dueDate="soon").status_code == 400
    scoped = client.post("/api/requirements", json={
        "name": "R", "scope": "participant", "type": "record_by", "params": {**REPORTS, "dueDate": "2026-11-01"},
    })
    assert scoped.status_code == 400  # links to teams, not participants


def test_deleting_what_a_record_requirement_uses(client):
    data = client.delete("/api/record-fields/rf-r-date").json()
    req = next(r for r in data["requirements"] if r["id"] == "req-7")
    assert "dateFieldId" not in req["params"]

    data = client.delete("/api/record-fields/rf-r-team").json()
    assert not any(r["id"] == "req-7" for r in data["requirements"])


def test_deleting_a_record_type_removes_its_requirements(client):
    data = client.delete("/api/record-types/rt-reports").json()
    assert not any(r["id"] == "req-7" for r in data["requirements"])


# ---- Rules ----


def test_statuses_include_rule_flags(client):
    statuses = client.get("/api/statuses").json()["teams"]
    flagged = statuses[SAMPLE["teams"][4]["id"]]
    assert "Has an open issue" in flagged["flags"]
    assert any(r["ruleId"] == "rule-open-issue" for r in flagged["ruleResults"])
    assert flagged["status"] in ("at_risk", "missing")


def test_rules_need_the_threshold_crossed():
    data = load_sample()
    issue_team = data.teams[4].id
    calc = next(c for c in data.calculations if c.id == "calc-open-issues")
    assert calculate(data, calc, issue_team) == 1
    assert calculate(data, calc, data.teams[0].id) == 0
    assert not any(r.rule_id == "rule-open-issue" for r in evaluate_rules(data, "team", data.teams[0].id))


def test_participant_summary_without_rules_keeps_requirement_status():
    data = load_sample()
    summary = participant_summary(data, ENROLLMENT)
    assert summary.rule_results is None


def test_a_requirement_can_be_edited_but_not_change_kind(client):
    body = {"name": "Brief, final", "scope": "team", "type": "complete_by", "params": {"dueDate": "2026-10-30"}}
    data = client.put("/api/requirements/req-5", json=body).json()
    req = next(r for r in data["requirements"] if r["id"] == "req-5")
    assert (req["name"], req["params"]["dueDate"]) == ("Brief, final", "2026-10-30")
    assert client.put("/api/requirements/req-5", json={**body, "scope": "participant"}).status_code == 400
    assert client.put("/api/requirements/req-5", json={**body, "params": {}}).status_code == 400
    assert client.put("/api/requirements/nope", json=body).status_code == 404


def test_nudges_are_saved_with_the_program_date(client):
    sample = {n["id"] for n in client.get("/api/cohort").json()["nudges"]}
    assert sample, "the sample cohort comes with a few nudges"
    data = client.post("/api/nudges", json={"id": "nudge-abcdef12", "requirementId": "req-5", "subjectId": TEAM}).json()
    nudge = next(n for n in data["nudges"] if n["id"] == "nudge-abcdef12")
    assert nudge["requirementId"] == "req-5" and nudge["subjectId"] == TEAM
    assert nudge["sentBy"] == "Test Admin" and nudge["sentOn"] == data["today"]
    # Flags from tracked numbers aren't tied to a rule.
    flag = client.post("/api/nudges", json={"subjectId": TEAM}).json()["nudges"]
    assert any(n["subjectId"] == TEAM and "requirementId" not in n for n in flag)
    assert client.post("/api/nudges", json={"requirementId": "nope", "subjectId": TEAM}).status_code == 404


def test_nudges_require_a_valid_subject_in_the_requirement_scope(client):
    assert client.post("/api/nudges", json={"subjectId": "missing-subject"}).status_code == 404
    assert client.post("/api/nudges", json={"requirementId": "req-5", "subjectId": ENROLLMENT}).status_code == 404
    assert client.post("/api/nudges", json={"requirementId": "req-5", "subjectId": "missing-team"}).status_code == 404
