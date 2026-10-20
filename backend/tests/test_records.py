import json
from pathlib import Path

SAMPLE = json.loads((Path(__file__).parents[1] / "app" / "sample" / "cohort.json").read_text())
TEAM = SAMPLE["teams"][0]["id"]


def test_sample_record_types_load(client):
    data = client.get("/api/cohort").json()
    for key in ("recordTypes", "calculations", "rules", "forms"):
        assert data[key] == SAMPLE[key], key
    assert len(data["records"]) == len(SAMPLE["records"])


def make_type(client):
    data = client.post("/api/record-types", json={"id": "rt-abcdef12", "name": "Submissions", "singular": "Submission"}).json()
    assert any(t["id"] == "rt-abcdef12" for t in data["recordTypes"])
    client.post("/api/record-types/rt-abcdef12/fields", json={"id": "rf-title123", "label": "Title", "type": "text", "required": True})
    client.post("/api/record-types/rt-abcdef12/fields", json={"id": "rf-team1234", "label": "Team", "type": "link", "linkTo": "team"})
    data = client.post(
        "/api/record-types/rt-abcdef12/fields",
        json={"id": "rf-status12", "label": "Status", "type": "select", "options": ["Late", "On time"]},
    ).json()
    return next(t for t in data["recordTypes"] if t["id"] == "rt-abcdef12")


def test_create_type_fields_and_records(client):
    t = make_type(client)
    assert [f["label"] for f in t["fields"]] == ["Title", "Team", "Status"]

    body = {"id": "rec-new12345", "typeId": t["id"], "values": {"rf-title123": " Brief ", "rf-team1234": TEAM, "rf-status12": "Late", "junk": 1}}
    record = next(r for r in client.post("/api/records", json=body).json()["records"] if r["id"] == "rec-new12345")
    assert record["values"] == {"rf-title123": "Brief", "rf-team1234": TEAM, "rf-status12": "Late"}

    bad = [
        ({"rf-team1234": TEAM}, "Fill in Title."),
        ({"rf-title123": "x", "rf-team1234": "team-nope"}, "Team links to something that doesn't exist."),
        ({"rf-title123": "x", "rf-status12": "Maybe"}, "Pick Status from its choices."),
        ({"rf-title123": "x", "rf-team1234": [TEAM, TEAM]}, "Team has the wrong kind of value."),
    ]
    for values, message in bad:
        response = client.post("/api/records", json={"typeId": t["id"], "values": values})
        assert response.status_code == 400 and response.json()["detail"] == message


def test_calculations_and_rules_validate(client):
    t = make_type(client)
    calc = {"id": "calc-late1234", "label": "Late submissions", "on": "team", "kind": "count", "sourceTypeId": t["id"],
            "viaFieldId": "rf-team1234", "filter": {"fieldId": "rf-status12", "op": "is", "value": "Late"}}
    assert client.post("/api/calculations", json={**calc, "on": "participant"}).status_code == 400
    client.post("/api/calculations", json=calc)
    rule = {"calculationId": "calc-late1234", "op": "gte", "value": 2, "status": "at_risk", "message": "2+ late"}
    data = client.post("/api/rules", json=rule).json()
    assert any(r["calculationId"] == "calc-late1234" for r in data["rules"])

    latest = {"label": "Last", "on": "team", "kind": "latest", "sourceTypeId": t["id"], "viaFieldId": "rf-team1234"}
    assert client.post("/api/calculations", json=latest).json()["detail"] == "Choose a date field."

    # Deleting the filtered field removes the calculation and its rule.
    data = client.delete("/api/record-fields/rf-status12").json()
    assert not any(c["id"] == "calc-late1234" for c in data["calculations"])
    assert not any(r["calculationId"] == "calc-late1234" for r in data["rules"])


def test_deleting_records_and_types_cleans_up(client):
    t = make_type(client)
    client.post("/api/record-types", json={"id": "rt-reviews12", "name": "Reviews", "singular": "Review"})
    client.post("/api/record-types/rt-reviews12/fields", json={"id": "rf-of123456", "label": "Of", "type": "link", "linkTo": t["id"]})
    client.post("/api/records", json={"id": "rec-sub12345", "typeId": t["id"], "values": {"rf-title123": "A"}})
    client.post("/api/records", json={"id": "rec-rev12345", "typeId": "rt-reviews12", "values": {"rf-of123456": "rec-sub12345"}})

    assert "Reviews" in client.delete(f"/api/record-types/{t['id']}").json()["detail"]

    data = client.delete("/api/records/rec-sub12345").json()
    review = next(r for r in data["records"] if r["id"] == "rec-rev12345")
    assert review["values"] == {}

    client.delete("/api/record-fields/rf-of123456")
    data = client.delete(f"/api/record-types/{t['id']}").json()
    assert not any(x["id"] == t["id"] for x in data["recordTypes"])


def test_form_matches_participant_and_fills_links(client, anonymous):
    form = SAMPLE["forms"][0]
    info = anonymous.get(f"/api/f/{form['token']}").json()
    assert info["title"] == form["title"] and info["roster"] is True
    assert all(f["type"] != "link" for f in info["fields"])

    person = SAMPLE["people"][0]
    enrollment = next(e for e in SAMPLE["enrollments"] if e["personId"] == person["id"])
    team = next(m["teamId"] for m in SAMPLE["memberships"] if m["enrollmentId"] == enrollment["id"] and "endDate" not in m)
    values = {"rf-m-summary": "Check-in", "rf-m-date": "2026-10-19", "rf-m-team": "team-sneaky"}

    assert anonymous.post(f"/api/f/{form['token']}", json={"email": "nobody@example.edu", "values": values}).json() == {"status": "not_found"}
    result = anonymous.post(f"/api/f/{form['token']}", json={"email": person["email"].upper(), "values": values}).json()
    assert result == {"status": "saved", "name": person["name"]}

    saved = client.get("/api/cohort").json()["records"][-1]
    assert saved["values"]["rf-m-team"] == team
    assert saved["values"]["rf-m-attended"] == [enrollment["id"]]

    client.patch(f"/api/forms/{form['id']}", json={"isOpen": False})
    assert anonymous.post(f"/api/f/{form['token']}", json={"email": person["email"], "values": values}).json() == {"status": "closed"}


def test_record_routes_need_sign_in(anonymous):
    assert anonymous.post("/api/record-types", json={"name": "X", "singular": "X"}).status_code == 401
