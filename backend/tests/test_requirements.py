"""The Python requirement rules must agree with the frontend's TypeScript ones."""

import json
from pathlib import Path

from app.schemas import CohortData
from app.seed import load_sample
from app.services.requirements import category_plural, participant_status, team_status

EXPECTED = json.loads((Path(__file__).parents[1] / "app" / "sample" / "expected_statuses.json").read_text())


def dump(status):
    return status.model_dump(mode="json", by_alias=True, exclude_none=True)


def test_participant_statuses_match_frontend():
    data = load_sample()
    for enrollment_id, expected in EXPECTED["participants"].items():
        assert dump(participant_status(data, enrollment_id)) == expected, enrollment_id


def test_team_statuses_match_frontend():
    data = load_sample()
    for team in data.teams:
        assert dump(team_status(data, team)) == EXPECTED["teams"][team.id], team.id


def test_sample_has_the_planted_problems():
    data = load_sample()
    flagged = [e for e in data.enrollments if e.status == "active" and participant_status(data, e.id).status in ("at_risk", "missing")]
    teams = [t for t in data.teams if team_status(data, t).status in ("at_risk", "missing")]
    assert (len(flagged), len(teams)) == (6, 6)


# ---- Small hand-built cases for each rule ----


def cohort(**overrides) -> CohortData:
    base = {
        "program": {"id": "p", "name": "P"},
        "cohort": {"id": "c", "programId": "p", "name": "C", "startDate": "2026-09-01", "endDate": "2026-12-01"},
        "today": "2026-10-15",
        "people": [], "enrollments": [{"id": "e1", "personId": "x", "cohortId": "c", "status": "active", "joinedAt": "2026-09-01"}],
        "projects": [], "teams": [], "memberships": [], "events": [], "attendance": [],
        "requirements": [], "completions": [], "exemptions": [], "fields": [],
    }
    base.update(overrides)
    return CohortData.model_validate(base)


def workshop(i: int, date: str) -> dict:
    return {"id": f"w{i}", "cohortId": "c", "title": f"W{i}", "category": "workshop", "date": date,
            "isRequired": True, "checkinToken": f"t{i}"}


ATTEND_3 = {"id": "r", "name": "Workshops", "scope": "participant", "type": "attendance_min",
            "params": {"category": "workshop", "minCount": 3}}


def test_attendance_on_track_at_risk_missing_met():
    events = [workshop(1, "2026-10-01"), workshop(2, "2026-10-08"), workshop(3, "2026-10-22"), workshop(4, "2026-10-29")]
    attended = lambda *ids: [{"eventId": i, "enrollmentId": "e1", "source": "link"} for i in ids]  # noqa: E731

    on_track = cohort(events=events, requirements=[ATTEND_3], attendance=attended("w1", "w2"))
    assert participant_status(on_track, "e1").status == "on_track"

    # Missed one with two left: still possible but no slack.
    at_risk = cohort(events=events, requirements=[ATTEND_3], attendance=attended("w1"))
    assert participant_status(at_risk, "e1").status == "at_risk"
    assert participant_status(at_risk, "e1").flags == ["Missed 1 of 2 workshops, must attend all 2 remaining"]

    missing = cohort(events=events[:3], requirements=[ATTEND_3], attendance=[])
    assert participant_status(missing, "e1").status == "missing"

    met = cohort(events=events, requirements=[ATTEND_3], attendance=attended("w1", "w2", "w3"),
                 today="2026-10-30")
    assert participant_status(met, "e1").status == "met"


def test_complete_by_due_soon_overdue_and_done():
    req = {"id": "r", "name": "Form", "scope": "participant", "type": "complete_by", "params": {"dueDate": "2026-10-20"}}
    assert participant_status(cohort(requirements=[req]), "e1").status == "at_risk"
    assert participant_status(cohort(requirements=[req], today="2026-10-25"), "e1").flags == ["Form overdue by 5 days"]
    assert participant_status(cohort(requirements=[req], today="2026-10-01"), "e1").status == "on_track"
    done = cohort(requirements=[req], completions=[{"requirementId": "r", "subjectId": "e1", "completedAt": "2026-10-10"}])
    assert participant_status(done, "e1").status == "met"


def test_excused_counts_as_met():
    req = {"id": "r", "name": "Form", "scope": "participant", "type": "complete_by", "params": {"dueDate": "2026-10-01"}}
    data = cohort(requirements=[req], exemptions=[{"requirementId": "r", "subjectId": "e1", "reason": "Medical leave"}])
    result = participant_status(data, "e1")
    assert result.status == "met"
    assert result.results[0].reason == "Excused: Medical leave"


def test_team_is_at_risk_when_a_member_is_missing():
    form = {"id": "r", "name": "Form", "scope": "participant", "type": "complete_by", "params": {"dueDate": "2026-10-01"}}
    size = {"id": "s", "name": "Size", "scope": "team", "type": "team_min_size", "params": {"minActive": 1}}
    data = cohort(
        requirements=[form, size],
        teams=[{"id": "t", "cohortId": "c", "name": "T"}],
        memberships=[{"enrollmentId": "e1", "teamId": "t", "startDate": "2026-09-01"}],
    )
    status = team_status(data, data.teams[0])
    assert status.status == "at_risk"
    assert status.flags == ["1 member missing requirements"]


def test_category_plural():
    assert category_plural("workshop") == "workshops"
    assert category_plural("office-hours") == "office hours"
    assert category_plural("all-hands") == "all hands"
