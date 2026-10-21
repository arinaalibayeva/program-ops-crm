// The people who run the program, and what each of them looks after.

import { currentTeamId } from "./requirements";
import type { CohortData, Note } from "./types";

export const UNASSIGNED = "Unassigned";

export function staffName(data: CohortData, id: string | undefined): string {
  return data.staff.find((s) => s.id === id)?.name ?? UNASSIGNED;
}

/** Who looks after a participant: the owner of their team. */
export function participantOwner(data: CohortData, enrollmentId: string): string | undefined {
  const teamId = currentTeamId(data, enrollmentId);
  return data.teams.find((t) => t.id === teamId)?.ownerId;
}

/** Who should act on a note: whoever looks after what it's about. */
export function noteOwner(data: CohortData, note: Note): string | undefined {
  if (note.subjectType === "participant") return participantOwner(data, note.subjectId);
  if (note.subjectType === "team") return data.teams.find((t) => t.id === note.subjectId)?.ownerId;
  return data.partners.find((p) => p.id === note.subjectId)?.ownerId;
}
