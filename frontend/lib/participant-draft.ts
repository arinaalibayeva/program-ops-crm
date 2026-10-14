// Edit mode on the participant page works on a draft. Applying it is a pure
// function, so the page can preview statuses before saving and the store can
// save every change in one step.

import { isEmptyValue, validateFields } from "./fields";
import { currentTeamId } from "./requirements";
import type { CohortData, FieldDefinition, FieldValue } from "./types";

export interface ParticipantDraft {
  name: string;
  email: string;
  fields: Record<string, FieldValue>;
  /** Undefined means no team. */
  teamId?: string;
  attendedEventIds: string[];
  /** Completion date per complete_by requirement; missing means not done. */
  completions: Record<string, string>;
  /** Excuse reason per requirement ("" for no reason); missing means not excused. */
  exemptions: Record<string, string>;
}

export function draftFrom(data: CohortData, enrollmentId: string): ParticipantDraft {
  const enrollment = data.enrollments.find((e) => e.id === enrollmentId)!;
  const person = data.people.find((p) => p.id === enrollment.personId)!;
  const completions: Record<string, string> = {};
  for (const c of data.completions) {
    if (c.subjectId === enrollmentId) completions[c.requirementId] = c.completedAt;
  }
  const exemptions: Record<string, string> = {};
  for (const x of data.exemptions) {
    if (x.subjectId === enrollmentId) exemptions[x.requirementId] = x.reason ?? "";
  }
  return {
    name: person.name,
    email: person.email,
    fields: { ...enrollment.fields },
    teamId: currentTeamId(data, enrollmentId),
    attendedEventIds: data.attendance
      .filter((a) => a.enrollmentId === enrollmentId)
      .map((a) => a.eventId),
    completions,
    exemptions,
  };
}

export function applyDraft(
  data: CohortData,
  enrollmentId: string,
  draft: ParticipantDraft,
): CohortData {
  const enrollment = data.enrollments.find((e) => e.id === enrollmentId)!;

  // Team: close the current membership and open a new one, keeping history.
  let memberships = data.memberships;
  const current = memberships.find((m) => m.enrollmentId === enrollmentId && !m.endDate);
  if (current?.teamId !== draft.teamId) {
    memberships = memberships.map((m) => (m === current ? { ...m, endDate: data.today } : m));
    if (draft.teamId) {
      memberships = [
        ...memberships,
        { enrollmentId, teamId: draft.teamId, startDate: data.today },
      ];
    }
  }

  // Attendance: keep existing records (and how they were recorded), add new ones.
  const wanted = new Set(draft.attendedEventIds);
  const existing = new Set<string>();
  const attendance = data.attendance.filter((a) => {
    if (a.enrollmentId !== enrollmentId) return true;
    existing.add(a.eventId);
    return wanted.has(a.eventId);
  });
  for (const eventId of draft.attendedEventIds) {
    if (!existing.has(eventId)) attendance.push({ eventId, enrollmentId, source: "manual" });
  }

  const fields: Record<string, FieldValue> = {};
  for (const [id, value] of Object.entries(draft.fields)) {
    if (!isEmptyValue(value)) fields[id] = value;
  }

  return {
    ...data,
    people: data.people.map((p) =>
      p.id === enrollment.personId
        ? { ...p, name: draft.name.trim(), email: draft.email.trim() }
        : p,
    ),
    enrollments: data.enrollments.map((e) => (e.id === enrollmentId ? { ...e, fields } : e)),
    memberships,
    attendance,
    completions: [
      ...data.completions.filter((c) => c.subjectId !== enrollmentId),
      ...Object.entries(draft.completions).map(([requirementId, completedAt]) => ({
        requirementId,
        subjectId: enrollmentId,
        completedAt,
      })),
    ],
    exemptions: [
      ...data.exemptions.filter((x) => x.subjectId !== enrollmentId),
      ...Object.entries(draft.exemptions).map(([requirementId, reason]) => ({
        requirementId,
        subjectId: enrollmentId,
        reason: reason.trim() || undefined,
      })),
    ],
  };
}

/** Returns a message for the first problem, or undefined if the draft can be saved. */
export function validateDraft(
  data: CohortData,
  enrollmentId: string,
  draft: ParticipantDraft,
  fields: FieldDefinition[],
): string | undefined {
  if (!draft.name.trim()) return "Enter a name.";
  const email = draft.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email.";
  const personId = data.enrollments.find((e) => e.id === enrollmentId)?.personId;
  if (data.people.some((p) => p.id !== personId && p.email.toLowerCase() === email)) {
    return "Another person already uses this email.";
  }
  return validateFields(fields, draft.fields);
}
