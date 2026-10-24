// A partner's work this cohort, worked out from its projects and their teams.

import { activeMembers, worstStatus } from "./requirements";
import type { CohortData, Enrollment, Partner, ProgramEvent, Project, Status, SubjectStatus, Team } from "./types";

export interface PartnerSummary extends Partner {
  projects: Project[];
  teams: Team[];
}

function summarize(data: CohortData, partner: Partner): PartnerSummary {
  const projects = data.projects.filter((p) => p.partnerId === partner.id);
  const ids = new Set(projects.map((p) => p.id));
  return { ...partner, projects, teams: data.teams.filter((t) => t.projectId && ids.has(t.projectId)) };
}

/** Every partner in the program, A to Z. */
export function partnersOf(data: CohortData): PartnerSummary[] {
  return data.partners.map((p) => summarize(data, p)).sort((a, b) => a.name.localeCompare(b.name));
}

export function partnerById(data: CohortData, id: string): PartnerSummary | undefined {
  const partner = data.partners.find((p) => p.id === id);
  return partner && summarize(data, partner);
}

export function partnerOfTeam(data: CohortData, team: Team): Partner | undefined {
  const project = data.projects.find((p) => p.id === team.projectId);
  return data.partners.find((p) => p.id === project?.partnerId);
}

/** The worst status among the partner's teams. */
export function partnerStatus(partner: PartnerSummary, teamStatuses: Map<string, SubjectStatus>): Status {
  return worstStatus(partner.teams.flatMap((t) => teamStatuses.get(t.id)?.status ?? []));
}

export function partnerMembers(data: CohortData, partner: PartnerSummary): Enrollment[] {
  return partner.teams.flatMap((t) => activeMembers(data, t.id));
}

/** This partner's events, plus partner sessions held for every partner. */
export function partnerEvents(data: CohortData, partnerId: string): ProgramEvent[] {
  return data.events.filter(
    (e) => e.partnerId === partnerId || (e.category === "partner" && !e.partnerId),
  );
}
