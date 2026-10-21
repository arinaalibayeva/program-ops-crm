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

/** Follow-ups still to do, soonest first. */
export function openFollowUps(data: CohortData): (Note & { followUpDate: string })[] {
  return data.notes
    .filter((n): n is Note & { followUpDate: string } => !!n.followUpDate && !n.followUpDone)
    .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate));
}
