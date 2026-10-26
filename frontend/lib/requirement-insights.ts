// Shapes the rules engine's results for the Requirements page: per-rule rows,
// plain-language summaries, team roll-ups, and status over time.
//
// History is worked out, not stored: the engine is re-run "as of" earlier
// dates using only the attendance, completions, records and memberships that
// existed by then. Rules are judged as they are written today.

import { addDays, categoryPlural } from "./events";
import { formatDate } from "./format";
import { linkLabel } from "./records";
import {
  activeMembers,
  currentTeamId,
  participantStatus,
  teamStatus,
} from "./requirements";
import type {
  CohortData,
  Condition,
  RecordType,
  Requirement,
  RequirementResult,
  Status,
  SubjectStatus,
} from "./types";

/** What the page colours by: problems stand out, everything fine is one colour. */
export type Bucket = "missing" | "at_risk" | "ok";

export function bucketOf(status: Status): Bucket {
  return status === "missing"
    ? "missing"
    : status === "at_risk"
      ? "at_risk"
      : "ok";
}

const BUCKET_RANK: Record<Bucket, number> = { missing: 0, at_risk: 1, ok: 2 };

export function worstBucket(buckets: Bucket[]): Bucket {
  return buckets.reduce<Bucket>(
    (w, b) => (BUCKET_RANK[b] < BUCKET_RANK[w] ? b : w),
    "ok",
  );
}

// ---- Dates ----

export function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** "today", "tomorrow", "in 4 days", "yesterday", "3 days ago". */
export function relativeDay(today: string, date: string): string {
  const n = daysUntil(today, date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export function weekOf(data: CohortData, date: string): number {
  return Math.floor(daysUntil(data.cohort.startDate, date) / 7) + 1;
}

export function totalWeeks(data: CohortData): number {
  return weekOf(data, data.cohort.endDate);
}

// ---- Per-rule rows ----

export interface SubjectRow {
  id: string;
  name: string;
  teamId?: string;
  teamName?: string;
  ownerId?: string;
  result: RequirementResult;
  bucket: Bucket;
}

export interface Statuses {
  participantStatuses: Map<string, SubjectStatus>;
  teamStatuses: Map<string, SubjectStatus>;
}

/** Everyone a rule applies to, worst first, then by name. */
export function ruleRows(
  data: CohortData,
  req: Requirement,
  s: Statuses,
): SubjectRow[] {
  const source =
    req.scope === "participant" ? s.participantStatuses : s.teamStatuses;
  const rows: SubjectRow[] = [];
  for (const [id, status] of source) {
    const result = status.results.find((r) => r.requirementId === req.id);
    if (!result) continue;
    const teamId = req.scope === "participant" ? currentTeamId(data, id) : id;
    const team = data.teams.find((t) => t.id === teamId);
    rows.push({
      id,
      name: linkLabel(data, req.scope, id),
      teamId,
      teamName: team?.name,
      ownerId: team?.ownerId,
      result,
      bucket: bucketOf(result.status),
    });
  }
  return rows.sort(
    (a, b) =>
      BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] ||
      a.name.localeCompare(b.name),
  );
}

export function countBuckets(rows: { bucket: Bucket }[]) {
  return {
    missing: rows.filter((r) => r.bucket === "missing").length,
    atRisk: rows.filter((r) => r.bucket === "at_risk").length,
    ok: rows.filter((r) => r.bucket === "ok").length,
    total: rows.length,
  };
}

export function problemScore(rows: SubjectRow[]): number {
  const c = countBuckets(rows);
  // A rule someone can no longer meet outranks any number of "at risk".
  return c.missing * 1000 + c.atRisk;
}

export function dueDateOf(req: Requirement): string | undefined {
  return req.type === "complete_by" || req.type === "record_by"
    ? req.params.dueDate
    : undefined;
}

export function countedEvents(data: CohortData, req: Requirement) {
  if (req.type !== "attendance_min") return [];
  return data.events
    .filter((e) => e.category === req.params.category)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const scopeWord = (req: Requirement, n: number) =>
  req.scope === "participant"
    ? n === 1
      ? "person"
      : "people"
    : n === 1
      ? "team"
      : "teams";

export function countOf(req: Requirement, n: number): string {
  return `${n} ${scopeWord(req, n)}`;
}

/** The grey line under a rule's name: what it counts and when. */
export function ruleTiming(
  data: CohortData,
  req: Requirement,
  rows: SubjectRow[],
): string {
  const done = rows.filter((r) => r.result.status === "met").length;
  switch (req.type) {
    case "attendance_min": {
      const events = countedEvents(data, req);
      const held = events.filter((e) => e.date < data.today).length;
      const next = events.find((e) => e.date >= data.today);
      const what = `${req.params.minCount} of ${events.length} ${categoryPlural(req.params.category)}`;
      return next
        ? `${what} · ${held} held, next ${formatDate(next.date)}`
        : `${what} · all ${held} held`;
    }
    case "complete_by":
    case "record_by": {
      const due = req.params.dueDate;
      const tally = `${done} of ${rows.length} in`;
      return due < data.today
        ? `Closed ${formatDate(due)} · ${tally}`
        : `Due ${formatDate(due, { weekday: true })} · ${tally}`;
    }
    case "team_min_size": {
      const sizes = data.teams
        .map((t) => ({ name: t.name, n: activeMembers(data, t.id).length }))
        .sort((a, b) => a.n - b.n);
      const smallest = sizes[0];
      return smallest
        ? `${req.params.minActive}+ active members · smallest: ${smallest.name} (${smallest.n})`
        : `${req.params.minActive}+ active members`;
    }
  }
}

/** The rule as a sentence; objects are the parts that would become editable. */
export type SentencePart = string | { chip: string };

/** " where Month is October", or nothing without a filter. */
function filterParts(type: RecordType | undefined, filter: Condition | undefined): SentencePart[] {
  if (!filter) return [];
  const field = type?.fields.find((f) => f.id === filter.fieldId);
  return [" where ", { chip: `${field?.label ?? "a field"} is ${filter.value ?? ""}` }];
}

export function ruleSentence(
  data: CohortData,
  req: Requirement,
): SentencePart[] {
  const who = {
    chip: req.scope === "participant" ? "Each participant" : "Each team",
  };
  switch (req.type) {
    case "attendance_min": {
      const n = countedEvents(data, req).length;
      return [
        who,
        " must attend at least ",
        { chip: String(req.params.minCount) },
        " of the ",
        { chip: `${n} ${categoryPlural(req.params.category)}` },
        " by ",
        { chip: `the end of term (${formatDate(data.cohort.endDate)})` },
        ".",
      ];
    }
    case "complete_by":
      return [
        who,
        " must hand in ",
        { chip: req.name },
        " by ",
        { chip: formatDate(req.params.dueDate, { weekday: true }) },
        ".",
      ];
    case "record_by": {
      const type = data.recordTypes.find((t) => t.id === req.params.typeId);
      const n = req.params.minCount;
      const what =
        (n === 1 ? type?.singular : type?.name)?.toLowerCase() ?? "records";
      return [
        who,
        " must log at least ",
        { chip: String(n) },
        " ",
        { chip: what },
        ...filterParts(type, req.params.filter),
        " by ",
        { chip: formatDate(req.params.dueDate, { weekday: true }) },
        ".",
      ];
    }
    case "team_min_size":
      return [
        who,
        " must keep at least ",
        { chip: String(req.params.minActive) },
        " active members ",
        { chip: "all term" },
        ".",
      ];
  }
}

/** Words for each kind of problem, so pills read naturally per rule type. */
export function problemWords(
  data: CohortData,
  req: Requirement,
): { missing: string; atRisk: string; ok: string } {
  switch (req.type) {
    case "attendance_min": {
      const next = countedEvents(data, req).find((e) => e.date >= data.today);
      return {
        missing: "can no longer reach it",
        atRisk: next ? `must attend ${formatDate(next.date)}` : "at risk",
        ok: "on track",
      };
    }
    case "complete_by":
    case "record_by":
      return req.params.dueDate < data.today
        ? { missing: "missed it", atRisk: "at risk", ok: "handed in" }
        : {
            missing: "missed it",
            atRisk: `not in yet, due ${relativeDay(data.today, req.params.dueDate)}`,
            ok: "on track",
          };
    case "team_min_size":
      return { missing: "too small", atRisk: "at risk", ok: "big enough" };
  }
}

// ---- Team roll-up ----

/** A rule's state for one team. Participant rules take the worst member. */
export function teamCell(
  data: CohortData,
  req: Requirement,
  teamId: string,
  s: Statuses,
): { bucket: Bucket; problems: number } {
  if (req.scope === "team") {
    const result = s.teamStatuses
      .get(teamId)
      ?.results.find((r) => r.requirementId === req.id);
    const bucket = result ? bucketOf(result.status) : "ok";
    return { bucket, problems: bucket === "ok" ? 0 : 1 };
  }
  const buckets = activeMembers(data, teamId).flatMap((e) => {
    const r = s.participantStatuses
      .get(e.id)
      ?.results.find((x) => x.requirementId === req.id);
    return r ? [bucketOf(r.status)] : [];
  });
  return {
    bucket: worstBucket(buckets),
    problems: buckets.filter((b) => b !== "ok").length,
  };
}

// ---- The program as it stood on an earlier date ----

function recordDate(
  data: CohortData,
  typeId: string,
  values: Record<string, unknown>,
  createdAt: string,
): string {
  const type = data.recordTypes.find((t) => t.id === typeId);
  const dateField = type?.fields.find((f) => f.type === "date");
  const value = dateField && values[dateField.id];
  return typeof value === "string" && value ? value : createdAt.slice(0, 10);
}

export function dataAsOf(data: CohortData, date: string): CohortData {
  return {
    ...data,
    today: date,
    enrollments: data.enrollments
      .filter((e) => e.joinedAt <= date)
      // Someone who left after this date was still active then.
      .map((e) =>
        e.status === "withdrawn" && e.leftAt && e.leftAt > date
          ? { ...e, status: "active" as const }
          : e,
      ),
    memberships: data.memberships
      .filter((m) => m.startDate <= date)
      .map((m) =>
        m.endDate && m.endDate > date ? { ...m, endDate: undefined } : m,
      ),
    completions: data.completions.filter((c) => c.completedAt <= date),
    records: data.records.filter(
      (r) => recordDate(data, r.typeId, r.values, r.createdAt) <= date,
    ),
  };
}

interface Snapshot {
  date: string;
  /** requirementId -> subjectId -> bucket */
  byRule: Map<string, Map<string, Bucket>>;
  /** Share of participants on track for every participant rule. */
  peopleOnTrack: number;
}

function snapshot(data: CohortData): Snapshot {
  const byRule = new Map<string, Map<string, Bucket>>(
    data.requirements.map((r) => [r.id, new Map()]),
  );
  let fine = 0;
  let people = 0;
  for (const e of data.enrollments) {
    if (e.status !== "active") continue;
    const s = participantStatus(data, e.id);
    people++;
    if (s.results.every((r) => bucketOf(r.status) === "ok")) fine++;
    for (const r of s.results)
      byRule.get(r.requirementId)?.set(e.id, bucketOf(r.status));
  }
  for (const t of data.teams) {
    // Only the team's own rules; the member roll-up is shown separately.
    for (const r of teamStatus(data, t).results)
      byRule.get(r.requirementId)?.set(t.id, bucketOf(r.status));
  }
  return {
    date: data.today,
    byRule,
    peopleOnTrack: people ? fine / people : 1,
  };
}

export interface WeekPoint {
  week: number;
  date: string;
  peopleOnTrack: number;
  /** requirementId -> share on track */
  rules: Map<string, number>;
}

/** One point per finished week, plus today. Empty in the first week. */
export function weeklyHistory(data: CohortData): WeekPoint[] {
  const current = weekOf(data, data.today);
  if (current < 2) return [];
  const dates: string[] = [];
  for (let w = 1; w < current; w++)
    dates.push(addDays(data.cohort.startDate, w * 7 - 1));
  dates.push(data.today);
  return dates.map((date, i) => {
    const snap = snapshot(dataAsOf(data, date));
    const rules = new Map<string, number>();
    for (const [id, subjects] of snap.byRule) {
      const all = [...subjects.values()];
      rules.set(
        id,
        all.length ? all.filter((b) => b === "ok").length / all.length : 1,
      );
    }
    return { week: i + 1, date, peopleOnTrack: snap.peopleOnTrack, rules };
  });
}

export interface StatusChange {
  date: string;
  requirementId: string;
  to: Bucket;
  subjects: { id: string; name: string }[];
}

/** Day-by-day changes caused by the rules, newest first. */
export function statusChanges(data: CohortData, limit = 5): StatusChange[] {
  const start = data.cohort.startDate;
  const days = Math.max(0, daysUntil(start, data.today));
  const changes: StatusChange[] = [];
  let prev = snapshot(dataAsOf(data, start));
  for (let i = 1; i <= days; i++) {
    const date = addDays(start, i);
    const next = snapshot(dataAsOf(data, date));
    for (const [reqId, subjects] of next.byRule) {
      const before = prev.byRule.get(reqId);
      const grouped = new Map<Bucket, string[]>();
      for (const [id, b] of subjects) {
        const was = before?.get(id);
        if (was === undefined || was === b) continue;
        grouped.set(b, [...(grouped.get(b) ?? []), id]);
      }
      const req = data.requirements.find((r) => r.id === reqId)!;
      for (const [to, ids] of grouped) {
        changes.push({
          date,
          requirementId: reqId,
          to,
          subjects: ids.map((id) => ({
            id,
            name: linkLabel(data, req.scope, id),
          })),
        });
      }
    }
    prev = next;
  }
  return changes
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || BUCKET_RANK[a.to] - BUCKET_RANK[b.to],
    )
    .slice(0, limit);
}

export function describeChange(
  data: CohortData,
  change: StatusChange,
): { who: string; what: string } {
  const req = data.requirements.find((r) => r.id === change.requirementId)!;
  const n = change.subjects.length;
  const who =
    n <= 2 ? change.subjects.map((s) => s.name).join(" and ") : countOf(req, n);
  const deadline = req.type === "complete_by" || req.type === "record_by";
  const what =
    change.to === "missing"
      ? deadline
        ? `missed ${req.name}`
        : req.type === "team_min_size"
          ? `fell below the minimum size`
          : `can no longer reach ${req.name}`
      : change.to === "at_risk"
        ? `moved to at risk on ${req.name}`
        : deadline
          ? `handed in ${req.name}`
          : `back on track for ${req.name}`;
  return { who, what };
}
