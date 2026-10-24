// Notes and their follow-ups, whatever they're about.

import { linkLabel, targetHref } from "./records";
import type { CohortData, Note } from "./types";

/** Where a note lives and what to call it. */
export function noteSubject(data: CohortData, note: Note): { label: string; href: string } {
  if (note.subjectType === "partner") {
    return {
      label: data.partners.find((p) => p.id === note.subjectId)?.name ?? "Unknown partner",
      href: `/admin/partners/${note.subjectId}`,
    };
  }
  return {
    label: linkLabel(data, note.subjectType, note.subjectId),
    href: targetHref(note.subjectType, note.subjectId),
  };
}

/** Every follow-up, soonest first. Done ones stay, crossed off. */
export function followUpsOf(data: CohortData): (Note & { followUpDate: string })[] {
  return data.notes
    .filter((n): n is Note & { followUpDate: string } => !!n.followUpDate)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}
