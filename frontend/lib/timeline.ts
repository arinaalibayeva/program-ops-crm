// One running history per record, worked out from what's already stored:
// attendance, team moves, completions, notes and linked records. Nothing is
// logged separately, so it only shows what the data itself still knows.

import { takesAttendance } from "./events";
import { partnerEvents, type PartnerSummary } from "./partners";
import { incomingLinks, linkedIds, recordTitle, typeById } from "./records";
import type { CohortData, CustomRecord, Note, NoteSubject } from "./types";

export interface TimelineEntry {
  id: string;
  /** An ISO date or date-time. */
  date: string;
  title: string;
  detail?: string;
  href?: string;
}

function newestFirst(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function noteEntries(data: CohortData, subjectType: NoteSubject, subjectId: string): TimelineEntry[] {
  return data.notes
    .filter((n: Note) => n.subjectType === subjectType && n.subjectId === subjectId)
    .map((n) => ({
      id: n.id,
      date: n.createdAt,
      title: n.author ? `Note from ${n.author}` : "Note",
      detail: n.body,
    }));
}

function recordEntry(data: CohortData, record: CustomRecord): TimelineEntry {
  const type = typeById(data, record.typeId);
  const dateField = type?.fields.find((f) => f.type === "date");
  const date = dateField && record.values[dateField.id];
  return {
    id: record.id,
    date: typeof date === "string" && date ? date : record.createdAt,
    title: recordTitle(data, record),
    detail: type?.singular,
    href: `/admin/records/${record.typeId}/${record.id}`,
  };
}

function recordEntries(data: CohortData, target: string, id: string): TimelineEntry[] {
  const links = incomingLinks(data, target);
  return data.records
    .filter((r) => links.some(({ type, field }) => r.typeId === type.id && linkedIds(r.values[field.id]).includes(id)))
    .map((r) => recordEntry(data, r));
}

function completionEntries(data: CohortData, subjectId: string): TimelineEntry[] {
  return data.completions
    .filter((c) => c.subjectId === subjectId)
    .map((c) => ({
      id: `done-${c.requirementId}`,
      date: c.completedAt,
      title: `${data.requirements.find((r) => r.id === c.requirementId)?.name ?? "Requirement"} done`,
      href: `/admin/requirements/${c.requirementId}`,
    }));
}

export function participantTimeline(data: CohortData, enrollmentId: string): TimelineEntry[] {
  const enrollment = data.enrollments.find((e) => e.id === enrollmentId);
  if (!enrollment) return [];
  const entries: TimelineEntry[] = [
    { id: "joined", date: enrollment.joinedAt, title: `Joined ${data.cohort.name}` },
    ...noteEntries(data, "participant", enrollmentId),
    ...recordEntries(data, "participant", enrollmentId),
    ...completionEntries(data, enrollmentId),
  ];
  if (enrollment.leftAt) entries.push({ id: "left", date: enrollment.leftAt, title: "Left the program" });

  for (const m of data.memberships.filter((x) => x.enrollmentId === enrollmentId)) {
    const team = data.teams.find((t) => t.id === m.teamId);
    const href = `/admin/teams/${m.teamId}`;
    entries.push({ id: `in-${m.teamId}-${m.startDate}`, date: m.startDate, title: `Joined Team ${team?.name}`, href });
    if (m.endDate) {
      entries.push({ id: `out-${m.teamId}-${m.endDate}`, date: m.endDate, title: `Left Team ${team?.name}`, href });
    }
  }

  const attended = new Set(data.attendance.filter((a) => a.enrollmentId === enrollmentId).map((a) => a.eventId));
  for (const event of data.events) {
    if (!takesAttendance(event) || event.date >= data.today || event.date < enrollment.joinedAt) continue;
    if (!attended.has(event.id) && !event.isRequired) continue;
    entries.push({
      id: event.id,
      date: event.date,
      title: `${attended.has(event.id) ? "Attended" : "Missed"} ${event.title}`,
      href: `/admin/events/${event.id}`,
    });
  }
  return newestFirst(entries);
}

export function teamTimeline(data: CohortData, teamId: string): TimelineEntry[] {
  const entries = [
    ...noteEntries(data, "team", teamId),
    ...recordEntries(data, "team", teamId),
    ...completionEntries(data, teamId),
  ];
  // Everyone starts together, so only later moves are worth a line.
  for (const m of data.memberships.filter((x) => x.teamId === teamId)) {
    const e = data.enrollments.find((x) => x.id === m.enrollmentId);
    const name = data.people.find((p) => p.id === e?.personId)?.name ?? "Someone";
    const href = `/admin/participants/${m.enrollmentId}`;
    if (m.startDate > data.cohort.startDate) {
      entries.push({ id: `in-${m.enrollmentId}-${m.startDate}`, date: m.startDate, title: `${name} joined`, href });
    }
    if (m.endDate) {
      entries.push({ id: `out-${m.enrollmentId}-${m.endDate}`, date: m.endDate, title: `${name} left`, href });
    }
  }
  return newestFirst(entries);
}

export function partnerTimeline(data: CohortData, partner: PartnerSummary): TimelineEntry[] {
  return newestFirst([
    ...noteEntries(data, "partner", partner.id),
    ...partner.teams.flatMap((team) =>
      recordEntries(data, "team", team.id).map((entry) => ({
        ...entry,
        detail: [`Team ${team.name}`, entry.detail].filter(Boolean).join(" · "),
      })),
    ),
    ...partnerEvents(data, partner.id).map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      detail: "Event",
      href: `/admin/events/${e.id}`,
    })),
  ]);
}
