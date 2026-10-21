import json
from pathlib import Path

from app import models as m

SAMPLE = json.loads((Path(__file__).parents[1] / "app" / "sample" / "cohort.json").read_text())
TODAY_EVENT = "chk-ev-9-today"  # the sample event on the demo's "today"


def by_key(rows, *keys):
    return sorted(rows, key=lambda r: tuple(r[k] for k in keys))


def test_cohort_matches_the_frontend_sample(client):
    data = client.get("/api/cohort").json()
    for key in ("program", "cohort", "today", "people", "enrollments", "projects", "teams", "partners", "memberships",
                "events", "attendance", "requirements", "fields"):
        assert data[key] == SAMPLE[key], key
    assert by_key(data["completions"], "requirementId", "subjectId") == by_key(
        SAMPLE["completions"], "requirementId", "subjectId"
    )


def test_every_team_has_one_of_each_role():
    role = next(f for f in SAMPLE["fields"] if f["id"] == "field-role")
    fields = {e["id"]: e["fields"] for e in SAMPLE["enrollments"]}
    for team in SAMPLE["teams"]:
        members = [m["enrollmentId"] for m in SAMPLE["memberships"] if m["teamId"] == team["id"] and "endDate" not in m]
        assert sorted(fields[e]["field-role"] for e in members) == sorted(role["options"]), team["name"]


def test_toggle_attendance(client):
    body = {"eventId": "ev-1", "enrollmentId": "enr-1"}
    had = any(a == {**body, "source": "link"} for a in SAMPLE["attendance"])
    after = client.post("/api/attendance/toggle", json=body).json()["attendance"]
    assert any(a["eventId"] == "ev-1" and a["enrollmentId"] == "enr-1" for a in after) is not had


# ---- Check-in ----


def test_checkin_info_reveals_no_participants(client):
    info = client.get(f"/api/checkin/{TODAY_EVENT}").json()
    assert info["event"]["title"] == "Weekly team check-in"
    assert "people" not in info and "enrollments" not in info


def test_checkin_flow(client):
    url = f"/api/checkin/{TODAY_EVENT}"
    assert client.post(url, json={"email": "nobody@example.edu"}).json() == {"status": "not_found"}
    first = client.post(url, json={"email": "  Andrei.Farouk@EXAMPLE.edu "}).json()
    assert first == {"status": "checked_in", "firstName": "Andrei"}
    again = client.post(url, json={"email": "andrei.farouk@example.edu"}).json()
    assert again["status"] == "already_checked_in"
    records = [a for a in client.get("/api/cohort").json()["attendance"] if a["eventId"] == "ev-9"]
    assert records == [{"eventId": "ev-9", "enrollmentId": "enr-1", "source": "link"}]


def test_checkin_only_on_the_day(client):
    tokens = {e["id"]: e["checkinToken"] for e in SAMPLE["events"]}
    email = {"email": "andrei.farouk@example.edu"}
    assert client.post(f"/api/checkin/{tokens['ev-8']}", json=email).json()["status"] == "not_open"
    assert client.post(f"/api/checkin/{tokens['ev-1']}", json=email).json()["status"] == "closed"
    assert client.post("/api/checkin/chk-unknown", json=email).status_code == 404


def test_withdrawn_participant_cannot_check_in(client, session_factory):
    with session_factory() as session:
        enrollment = session.get(m.Enrollment, "enr-2")
        enrollment.status = "withdrawn"
        session.commit()
        email = session.get(m.Person, enrollment.person_id).email
    assert client.post(f"/api/checkin/{TODAY_EVENT}", json={"email": email}).json()["status"] == "not_found"


# ---- Participants ----


def draft_for(data, enrollment_id):
    enrollment = next(e for e in data["enrollments"] if e["id"] == enrollment_id)
    person = next(p for p in data["people"] if p["id"] == enrollment["personId"])
    team = next((m["teamId"] for m in data["memberships"] if m["enrollmentId"] == enrollment_id and "endDate" not in m), None)
    return {
        "name": person["name"],
        "email": person["email"],
        "fields": enrollment.get("fields", {}),
        "teamId": team,
        "attendedEventIds": [a["eventId"] for a in data["attendance"] if a["enrollmentId"] == enrollment_id],
        "completions": {c["requirementId"]: c["completedAt"] for c in data["completions"] if c["subjectId"] == enrollment_id},
        "exemptions": {x["requirementId"]: x.get("reason", "") for x in data["exemptions"] if x["subjectId"] == enrollment_id},
    }


def test_unchanged_draft_changes_nothing(client):
    before = client.get("/api/cohort").json()
    after = client.put("/api/participants/enr-2", json=draft_for(before, "enr-2")).json()
    assert after["people"] == before["people"]
    assert after["memberships"] == before["memberships"]
    assert sorted(map(json.dumps, after["attendance"])) == sorted(map(json.dumps, before["attendance"]))


def test_team_change_keeps_history(client):
    data = client.get("/api/cohort").json()
    draft = draft_for(data, "enr-2") | {"teamId": "team-5"}
    after = client.put("/api/participants/enr-2", json=draft).json()
    history = [m for m in after["memberships"] if m["enrollmentId"] == "enr-2"]
    assert [m["teamId"] for m in history][-1] == "team-5"
    assert history[-2]["endDate"] == "2026-10-19"


def test_participant_validation(client):
    data = client.get("/api/cohort").json()
    draft = draft_for(data, "enr-2")
    taken = client.put("/api/participants/enr-2", json=draft | {"email": "andrei.farouk@example.edu"})
    assert taken.status_code == 400 and taken.json()["detail"] == "Another person already uses this email."
    assert client.put("/api/participants/enr-2", json=draft | {"name": " "}).status_code == 400


def test_add_participants_reuses_people(client):
    rows = [
        {"name": "New Person", "email": "new@example.edu", "team": "Brand new team"},
        {"name": "Andrei Again", "email": "andrei.farouk@example.edu"},  # already enrolled
    ]
    result = client.post("/api/participants", json={"rows": rows}).json()
    assert result["added"] == 1
    assert any(t["name"] == "Brand new team" for t in result["data"]["teams"])


# ---- Events ----


def test_add_and_edit_event(client):
    event = {"title": "Retro", "category": "meeting", "date": "2026-11-02", "startTime": "10:00",
             "endTime": "11:00", "isRequired": False, "links": [{"label": "Notes", "url": "https://x.example.org"}]}
    data = client.post("/api/events", json=event).json()
    created = next(e for e in data["events"] if e["title"] == "Retro")
    assert created["checkinToken"].startswith("chk-")

    # Sending null clears a field; fields not sent stay as they were.
    data = client.patch(f"/api/events/{created['id']}", json={"endTime": None, "host": "Dana"}).json()
    updated = next(e for e in data["events"] if e["id"] == created["id"])
    assert "endTime" not in updated and updated["host"] == "Dana"
    assert updated["links"] == [{"label": "Notes", "url": "https://x.example.org"}]


def test_event_validation(client):
    bad = {"title": "X", "category": "meeting", "date": "2026-11-02", "startTime": "11:00", "endTime": "10:00"}
    assert client.post("/api/events", json=bad).status_code == 400
    assert client.post("/api/events", json=bad | {"category": "party"}).status_code == 422


# ---- Fields and requirements ----


def test_fields_add_move_delete(client):
    data = client.post("/api/fields", json={"label": "Pronouns", "type": "text"}).json()
    new = data["fields"][-1]
    assert new["label"] == "Pronouns"
    data = client.post(f"/api/fields/{new['id']}/move", json={"toIndex": 0}).json()
    assert data["fields"][0]["id"] == new["id"]
    data = client.delete("/api/fields/field-phone").json()
    assert all("field-phone" not in e.get("fields", {}) for e in data["enrollments"])


def test_delete_requirement_removes_its_records(client):
    data = client.delete("/api/requirements/req-5").json()
    assert all(c["requirementId"] != "req-5" for c in data["completions"])


def test_reset_restores_sample(client):
    client.post("/api/attendance/toggle", json={"eventId": "ev-1", "enrollmentId": "enr-1"})
    assert client.post("/api/reset").json()["attendance"] == SAMPLE["attendance"]


# ---- Profile ----


def test_profile_read_and_update(client):
    me = client.get("/api/me").json()
    assert me["name"] == "Test Admin" and me["role"] == "manager"
    updated = client.put("/api/me", json={"name": "Arina A", "email": "arina@example.edu", "pronouns": "she/her", "jobTitle": " "}).json()
    assert updated["name"] == "Arina A" and updated["pronouns"] == "she/her" and "jobTitle" not in updated
    assert client.put("/api/me", json={"name": "", "email": "a@b.co"}).status_code == 400


def test_delete_event_removes_attendance(client):
    data = client.delete("/api/events/ev-1").json()
    assert not any(e["id"] == "ev-1" for e in data["events"])
    assert not any(a["eventId"] == "ev-1" for a in data["attendance"])
    assert client.delete("/api/events/ev-1").status_code == 404
