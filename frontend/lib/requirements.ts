// Requirement evaluation. Each evaluator is a pure function of the cohort data,
// so this logic can be ported 1:1 to backend/app/services/requirements.py
// and unit tested there.

import { categoryPlural, takesAttendance } from "./events";
import type {
  CohortData,
  CustomRecord,
  Enrollment,
  Requirement,
  RequirementResult,
  Status,
  SubjectStatus,
  Team,
} from "./types";

const STATUS_RANK: Record<Status, number> = {
  met: 0,
  on_track: 1,
  at_risk: 2,
  missing: 3,
};

/** A complete_by item due within this many days counts as at risk. */
const DUE_SOON_DAYS = 7;

export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    "met",
  );
}

export function needsAttention(status: Status): boolean {
  return status === "at_risk" || status === "missing";
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
  );
}

// ---- Membership helpers ----

export function currentTeamId(
  data: CohortData,
  enrollmentId: string,
): string | undefined {
  return data.memberships.find(
    (m) => m.enrollmentId === enrollmentId && !m.endDate,
  )?.teamId;
}

export function activeMembers(data: CohortData, teamId: string): Enrollment[] {
  const ids = new Set(
    data.memberships
      .filter((m) => m.teamId === teamId && !m.endDate)
      .map((m) => m.enrollmentId),
  );
  return data.enrollments.filter((e) => ids.has(e.id) && e.status === "active");
}

/** Attendance across every event so far, whatever its category. */
export function attendanceSummary(
  data: CohortData,
  enrollmentId: string,
): { attended: number; total: number } {
  const past = data.events.filter((e) => takesAttendance(e) && e.date < data.today);
  const attended = past.filter((e) =>
    data.attendance.some((a) => a.eventId === e.id && a.enrollmentId === enrollmentId),
  ).length;
  return { attended, total: past.length };
}

// ---- Evaluators ----

function evaluateAttendanceMin(
  data: CohortData,
  req: Extract<Requirement, { type: "attendance_min" }>,
  enrollmentId: string,
): RequirementResult {
  const { category, minCount } = req.params;
  const events = data.events.filter((e) => e.category === category);
  const past = events.filter((e) => e.date < data.today);
  const remaining = events.length - past.length;
  const attended = past.filter((e) =>
    data.attendance.some(
      (a) => a.eventId === e.id && a.enrollmentId === enrollmentId,
    ),
  ).length;
  const missed = past.length - attended;
  const stillNeeded = minCount - attended;
  const label = categoryPlural(category);

  let status: Status;
  let reason: string;
  if (attended >= minCount) {
    status = "met";
    reason = `Attended ${attended} ${label} (needs ${minCount})`;
  } else if (attended + remaining < minCount) {
    // Can no longer reach the minimum even by attending everything left.
    status = "missing";
    reason = `Missed ${missed} of ${past.length} ${label}, can no longer reach ${minCount}`;
  } else if (missed > 0 && stillNeeded >= remaining) {
    // Still possible, but there is no slack left.
    status = "at_risk";
    reason =
      remaining === 1
        ? `Missed ${missed} of ${past.length} ${label}, must attend the last one`
        : `Missed ${missed} of ${past.length} ${label}, must attend all ${remaining} remaining`;
  } else {
    status = "on_track";
    reason = `Attended ${attended} of ${past.length} ${label} so far`;
  }
  return { requirementId: req.id, status, reason };
}

function evaluateCompleteBy(
  data: CohortData,
  req: Extract<Requirement, { type: "complete_by" }>,
  subjectId: string,
): RequirementResult {
  const done = data.completions.find(
    (c) => c.requirementId === req.id && c.subjectId === subjectId,
  );
  if (done) {
    return {
      requirementId: req.id,
      status: "met",
      reason: `${req.name} done on ${done.completedAt}`,
    };
  }
  const daysLeft = daysBetween(data.today, req.params.dueDate);
  if (daysLeft < 0) {
    return {
      requirementId: req.id,
      status: "missing",
      reason: `${req.name} overdue by ${-daysLeft} days`,
    };
  }
  if (daysLeft <= DUE_SOON_DAYS) {
    return {
      requirementId: req.id,
      status: "at_risk",
      reason: `${req.name} due in ${daysLeft} days, not done yet`,
    };
  }
  return {
    requirementId: req.id,
    status: "on_track",
    reason: `${req.name} due ${req.params.dueDate}`,
  };
}

type RecordRequirement = Extract<Requirement, { type: "record_by" }>;

function linkedRecords(
  data: CohortData,
  req: RecordRequirement,
  subjectId: string,
): CustomRecord[] {
  const { typeId, viaFieldId } = req.params;
  return data.records.filter((r) => {
    if (r.typeId !== typeId) return false;
    const value = r.values[viaFieldId];
    return Array.isArray(value) ? value.includes(subjectId) : value === subjectId;
  });
}

export type RecordProgress = "on_time" | "late" | "missing" | "pending";

/** "missing" is past due without enough records; "pending" still has time. */
export function recordProgress(
  data: CohortData,
  req: RecordRequirement,
  subjectId: string,
): RecordProgress {
  const { minCount, dueDate, dateFieldId } = req.params;
  const records = linkedRecords(data, req, subjectId);
  if (records.length < minCount) {
    return daysBetween(data.today, dueDate) < 0 ? "missing" : "pending";
  }
  const dates = dateFieldId
    ? records
        .map((r) => r.values[dateFieldId])
        .filter((v): v is string => typeof v === "string" && v !== "")
        .sort()
    : [];
  // Late when the record that met the minimum came after the due date.
  return dates.length >= minCount && dates[minCount - 1] > dueDate ? "late" : "on_time";
}

function evaluateRecordBy(
  data: CohortData,
  req: RecordRequirement,
  subjectId: string,
): RequirementResult {
  const { minCount, dueDate } = req.params;
  const count = linkedRecords(data, req, subjectId).length;
  const logged = `${count} of ${minCount} logged`;
  const progress = recordProgress(data, req, subjectId);
  const daysLeft = daysBetween(data.today, dueDate);
  const result = (status: Status, reason: string): RequirementResult => ({
    requirementId: req.id,
    status,
    reason,
  });
  if (progress === "on_time") return result("met", `${req.name} logged (${count})`);
  if (progress === "late") return result("met", `${req.name} logged late, after ${dueDate}`);
  if (progress === "missing") return result("missing", `${req.name} overdue by ${-daysLeft} days, ${logged}`);
  if (daysLeft <= DUE_SOON_DAYS) return result("at_risk", `${req.name} due in ${daysLeft} days, ${logged}`);
  return result("on_track", `${req.name} due ${dueDate}, ${logged}`);
}

function evaluateTeamMinSize(
  data: CohortData,
  req: Extract<Requirement, { type: "team_min_size" }>,
  teamId: string,
): RequirementResult {
  const count = activeMembers(data, teamId).length;
  const { minActive } = req.params;
  return count >= minActive
    ? {
        requirementId: req.id,
        status: "met",
        reason: `${count} active members`,
      }
    : {
        requirementId: req.id,
        status: "missing",
        reason: `Down to ${count} active members (min ${minActive})`,
      };
}

/** An excused requirement counts as met, so it never flags the subject. */
function exemptionResult(
  data: CohortData,
  req: Requirement,
  subjectId: string,
): RequirementResult | undefined {
  const ex = data.exemptions.find(
    (x) => x.requirementId === req.id && x.subjectId === subjectId,
  );
  if (!ex) return undefined;
  return {
    requirementId: req.id,
    status: "met",
    reason: ex.reason ? `Excused: ${ex.reason}` : "Excused",
    excused: true,
  };
}

// ---- Subject-level status ----

function summarize(results: RequirementResult[]): SubjectStatus {
  return {
    status: worstStatus(results.map((r) => r.status)),
    results,
    flags: results.filter((r) => needsAttention(r.status)).map((r) => r.reason),
  };
}

export function participantStatus(
  data: CohortData,
  enrollmentId: string,
): SubjectStatus {
  const results: RequirementResult[] = [];
  for (const req of data.requirements) {
    if (req.scope !== "participant") continue;
    const excused = exemptionResult(data, req, enrollmentId);
    if (excused) results.push(excused);
    else if (req.type === "attendance_min") {
      results.push(evaluateAttendanceMin(data, req, enrollmentId));
    } else if (req.type === "complete_by") {
      results.push(evaluateCompleteBy(data, req, enrollmentId));
    } else if (req.type === "record_by") {
      results.push(evaluateRecordBy(data, req, enrollmentId));
    }
  }
  return summarize(results);
}

/**
 * A team's status is the worst of its team-level requirements. If any active
 * member is missing a requirement, the team is at least "at risk" so the
 * organizer sees it, but one member can't make the whole team "missing".
 */
export function teamStatus(data: CohortData, team: Team): SubjectStatus {
  const results: RequirementResult[] = [];
  for (const req of data.requirements) {
    if (req.scope !== "team") continue;
    const excused = exemptionResult(data, req, team.id);
    if (excused) results.push(excused);
    else if (req.type === "team_min_size") {
      results.push(evaluateTeamMinSize(data, req, team.id));
    } else if (req.type === "complete_by") {
      results.push(evaluateCompleteBy(data, req, team.id));
    } else if (req.type === "record_by") {
      results.push(evaluateRecordBy(data, req, team.id));
    }
  }
  const summary = summarize(results);

  const missingMembers = activeMembers(data, team.id).filter(
    (e) => participantStatus(data, e.id).status === "missing",
  ).length;
  if (missingMembers > 0) {
    summary.flags.push(
      `${missingMembers} member${missingMembers > 1 ? "s" : ""} missing requirements`,
    );
    summary.status = worstStatus([summary.status, "at_risk"]);
  }
  return summary;
}

export function describeRequirement(req: Requirement, data: CohortData): string {
  switch (req.type) {
    case "attendance_min":
      return `Attend at least ${req.params.minCount} ${categoryPlural(req.params.category)}`;
    case "complete_by":
      return `Complete by ${req.params.dueDate}`;
    case "team_min_size":
      return `Team keeps at least ${req.params.minActive} active members`;
    case "record_by": {
      const type = data.recordTypes.find((t) => t.id === req.params.typeId);
      const name = req.params.minCount === 1 ? type?.singular : type?.name;
      return `At least ${req.params.minCount} ${name?.toLowerCase() ?? "records"} by ${req.params.dueDate}`;
    }
  }
}
