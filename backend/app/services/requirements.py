"""Requirement and rule evaluation, ported 1:1 from frontend/lib/requirements.ts
and the calculations in frontend/lib/records.ts.

Every function is pure: it reads a CohortData snapshot and returns a status,
so it's easy to test and gives the same answers as the frontend.
"""

import datetime as dt
import math

from ..schemas import (
    Calculation,
    CohortData,
    Condition,
    CustomRecord,
    Enrollment,
    Requirement,
    RequirementResult,
    RuleResult,
    Status,
    SubjectStatus,
    Team,
)

STATUS_RANK: dict[str, int] = {"met": 0, "on_track": 1, "at_risk": 2, "missing": 3}

# A complete_by item due within this many days counts as at risk.
DUE_SOON_DAYS = 7


def worst_status(statuses: list[Status]) -> Status:
    worst: Status = "met"
    for s in statuses:
        if STATUS_RANK[s] > STATUS_RANK[worst]:
            worst = s
    return worst


def needs_attention(status: Status) -> bool:
    return status in ("at_risk", "missing")


def category_plural(category: str) -> str:
    """Lowercase plural for sentences, e.g. "workshops", "office hours"."""
    words = category.replace("-", " ", 1)
    return words if words.endswith("s") else f"{words}s"


# ---- Membership helpers ----


def current_team_id(data: CohortData, enrollment_id: str) -> str | None:
    for m in data.memberships:
        if m.enrollment_id == enrollment_id and m.end_date is None:
            return m.team_id
    return None


def active_members(data: CohortData, team_id: str) -> list[Enrollment]:
    ids = {m.enrollment_id for m in data.memberships if m.team_id == team_id and m.end_date is None}
    return [e for e in data.enrollments if e.id in ids and e.status == "active"]


# ---- Evaluators ----


def _attendance_min(data: CohortData, req: Requirement, enrollment_id: str) -> RequirementResult:
    category = req.params["category"]
    min_count = req.params["minCount"]
    events = [e for e in data.events if e.category == category]
    past = [e for e in events if e.date < data.today]
    remaining = len(events) - len(past)
    attended_ids = {a.event_id for a in data.attendance if a.enrollment_id == enrollment_id}
    attended = sum(1 for e in past if e.id in attended_ids)
    missed = len(past) - attended
    still_needed = min_count - attended
    label = category_plural(category)

    if attended >= min_count:
        status, reason = "met", f"Attended {attended} {label} (needs {min_count})"
    elif attended + remaining < min_count:
        # Can no longer reach the minimum even by attending everything left.
        status = "missing"
        reason = f"Missed {missed} of {len(past)} {label}, can no longer reach {min_count}"
    elif missed > 0 and still_needed >= remaining:
        # Still possible, but there is no slack left.
        status = "at_risk"
        reason = (
            f"Missed {missed} of {len(past)} {label}, must attend the last one"
            if remaining == 1
            else f"Missed {missed} of {len(past)} {label}, must attend all {remaining} remaining"
        )
    else:
        status, reason = "on_track", f"Attended {attended} of {len(past)} {label} so far"
    return RequirementResult(requirement_id=req.id, status=status, reason=reason)


def _complete_by(data: CohortData, req: Requirement, subject_id: str) -> RequirementResult:
    done = next(
        (c for c in data.completions if c.requirement_id == req.id and c.subject_id == subject_id),
        None,
    )
    if done:
        return RequirementResult(
            requirement_id=req.id, status="met", reason=f"{req.name} done on {done.completed_at.isoformat()}"
        )
    due = req.params["dueDate"]
    days_left = (_as_date(due) - data.today).days
    if days_left < 0:
        return RequirementResult(
            requirement_id=req.id, status="missing", reason=f"{req.name} overdue by {-days_left} days"
        )
    if days_left <= DUE_SOON_DAYS:
        return RequirementResult(
            requirement_id=req.id, status="at_risk", reason=f"{req.name} due in {days_left} days, not done yet"
        )
    return RequirementResult(requirement_id=req.id, status="on_track", reason=f"{req.name} due {due}")


def linked_ids(value: object) -> list[str]:
    if isinstance(value, list):
        return value
    return [value] if isinstance(value, str) and value else []


def _linked_records(data: CohortData, req: Requirement, subject_id: str) -> list[CustomRecord]:
    p = req.params
    return [
        r for r in data.records
        if r.type_id == p["typeId"] and subject_id in linked_ids(r.values.get(p["viaFieldId"]))
    ]


def _record_progress(data: CohortData, req: Requirement, subject_id: str) -> str:
    """on_time, late, missing (past due without enough records) or pending."""
    p = req.params
    records = _linked_records(data, req, subject_id)
    if len(records) < p["minCount"]:
        return "missing" if (_as_date(p["dueDate"]) - data.today).days < 0 else "pending"
    date_field = p.get("dateFieldId")
    dates = sorted(v for v in (r.values.get(date_field) for r in records) if isinstance(v, str) and v) if date_field else []
    # Late when the record that met the minimum came after the due date.
    late = len(dates) >= p["minCount"] and dates[p["minCount"] - 1] > str(p["dueDate"])
    return "late" if late else "on_time"


def _record_by(data: CohortData, req: Requirement, subject_id: str) -> RequirementResult:
    p = req.params
    count = len(_linked_records(data, req, subject_id))
    logged = f"{count} of {p['minCount']} logged"
    progress = _record_progress(data, req, subject_id)
    days_left = (_as_date(p["dueDate"]) - data.today).days
    if progress == "on_time":
        status, reason = "met", f"{req.name} logged ({count})"
    elif progress == "late":
        status, reason = "met", f"{req.name} logged late, after {p['dueDate']}"
    elif progress == "missing":
        status, reason = "missing", f"{req.name} overdue by {-days_left} days, {logged}"
    elif days_left <= DUE_SOON_DAYS:
        status, reason = "at_risk", f"{req.name} due in {days_left} days, {logged}"
    else:
        status, reason = "on_track", f"{req.name} due {p['dueDate']}, {logged}"
    return RequirementResult(requirement_id=req.id, status=status, reason=reason)


def _team_min_size(data: CohortData, req: Requirement, team_id: str) -> RequirementResult:
    count = len(active_members(data, team_id))
    min_active = req.params["minActive"]
    if count >= min_active:
        return RequirementResult(requirement_id=req.id, status="met", reason=f"{count} active members")
    return RequirementResult(
        requirement_id=req.id, status="missing", reason=f"Down to {count} active members (min {min_active})"
    )


def _exemption(data: CohortData, req: Requirement, subject_id: str) -> RequirementResult | None:
    """An excused requirement counts as met, so it never flags the subject."""
    ex = next(
        (x for x in data.exemptions if x.requirement_id == req.id and x.subject_id == subject_id),
        None,
    )
    if ex is None:
        return None
    return RequirementResult(
        requirement_id=req.id,
        status="met",
        reason=f"Excused: {ex.reason}" if ex.reason else "Excused",
        excused=True,
    )


def _as_date(value: dt.date | str) -> dt.date:
    return value if isinstance(value, dt.date) else dt.date.fromisoformat(value)


# ---- Subject-level status ----


def _summarize(results: list[RequirementResult]) -> SubjectStatus:
    return SubjectStatus(
        status=worst_status([r.status for r in results]),
        results=results,
        flags=[r.reason for r in results if needs_attention(r.status)],
    )


def participant_status(data: CohortData, enrollment_id: str) -> SubjectStatus:
    results: list[RequirementResult] = []
    for req in data.requirements:
        if req.scope != "participant":
            continue
        excused = _exemption(data, req, enrollment_id)
        if excused:
            results.append(excused)
        elif req.type == "attendance_min":
            results.append(_attendance_min(data, req, enrollment_id))
        elif req.type == "complete_by":
            results.append(_complete_by(data, req, enrollment_id))
        elif req.type == "record_by":
            results.append(_record_by(data, req, enrollment_id))
    return _summarize(results)


def team_status(data: CohortData, team: Team) -> SubjectStatus:
    """A team's status is the worst of its team-level requirements. If any
    active member is missing a requirement, the team is at least "at risk" so
    the organizer sees it, but one member can't make the whole team "missing"."""
    results: list[RequirementResult] = []
    for req in data.requirements:
        if req.scope != "team":
            continue
        excused = _exemption(data, req, team.id)
        if excused:
            results.append(excused)
        elif req.type == "team_min_size":
            results.append(_team_min_size(data, req, team.id))
        elif req.type == "complete_by":
            results.append(_complete_by(data, req, team.id))
        elif req.type == "record_by":
            results.append(_record_by(data, req, team.id))
    summary = _summarize(results)

    missing_members = sum(
        1 for e in active_members(data, team.id) if participant_status(data, e.id).status == "missing"
    )
    if missing_members > 0:
        summary.flags.append(
            f"{missing_members} member{'s' if missing_members > 1 else ''} missing requirements"
        )
        summary.status = worst_status([summary.status, "at_risk"])
    return summary


# ---- Calculations and rules ----


def _is_empty(value: object) -> bool:
    if value is None or value == []:
        return True
    return isinstance(value, str) and value.strip() == ""


def _as_text(value: object) -> str:
    if isinstance(value, bool):
        return "yes" if value else "no"
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).lower()


def _matches(record: CustomRecord, condition: Condition) -> bool:
    value = record.values.get(condition.field_id)
    if condition.op == "is_empty":
        return _is_empty(value) or value is False
    if condition.op == "is_not_empty":
        return not (_is_empty(value) or value is False)
    wanted = (condition.value or "").lower()
    hit = any(_as_text(v) == wanted for v in (value if isinstance(value, list) else [value]))
    return hit if condition.op == "is" else not hit


def calculate(data: CohortData, calc: Calculation, subject_id: str) -> int | str | None:
    """A number for count, percent and days_since; a date for latest; None when there's nothing to go on."""
    records = [
        r for r in data.records
        if r.type_id == calc.source_type_id and subject_id in linked_ids(r.values.get(calc.via_field_id))
    ]
    matching = [r for r in records if _matches(r, calc.filter)] if calc.filter else records
    if calc.kind == "count":
        return len(matching)
    if calc.kind == "percent":
        # Half rounds up, as in JavaScript.
        return math.floor(100 * len(matching) / len(records) + 0.5) if records else None
    dates = sorted(v for v in (r.values.get(calc.date_field_id or "") for r in matching) if isinstance(v, str) and v)
    if not dates:
        return None
    return dates[-1] if calc.kind == "latest" else (data.today - _as_date(dates[-1])).days


def _crosses(op: str, value: float, threshold: float) -> bool:
    return {
        "gt": value > threshold,
        "gte": value >= threshold,
        "lt": value < threshold,
        "lte": value <= threshold,
        "eq": value == threshold,
    }[op]


def evaluate_rules(data: CohortData, on: str, subject_id: str) -> list[RuleResult]:
    """Rules that flag this subject. `on` is participant, team or a record type id."""
    results: list[RuleResult] = []
    for rule in data.rules:
        calc = next((c for c in data.calculations if c.id == rule.calculation_id), None)
        if calc is None or calc.on != on or calc.kind == "latest":
            continue
        value = calculate(data, calc, subject_id)
        flagged = rule.when_empty if value is None else _crosses(rule.op, float(value), rule.value)
        if flagged:
            results.append(RuleResult(rule_id=rule.id, status=rule.status, reason=rule.message))
    return results


def with_rules(status: SubjectStatus, rules: list[RuleResult]) -> SubjectStatus:
    """Adds rule flags to a requirement-based status."""
    if not rules:
        return status
    return SubjectStatus(
        status=worst_status([status.status, *[r.status for r in rules]]),
        results=status.results,
        rule_results=rules,
        flags=[*status.flags, *[r.reason for r in rules]],
    )


def participant_summary(data: CohortData, enrollment_id: str) -> SubjectStatus:
    """Everything that decides a participant's status: requirements and rules."""
    return with_rules(participant_status(data, enrollment_id), evaluate_rules(data, "participant", enrollment_id))


def team_summary(data: CohortData, team: Team) -> SubjectStatus:
    """Everything that decides a team's status: requirements and rules."""
    return with_rules(team_status(data, team), evaluate_rules(data, "team", team.id))
