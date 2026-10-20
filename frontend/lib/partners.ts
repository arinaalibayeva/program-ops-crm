// Partners aren't stored on their own yet: a partner is the organization named
// on a project. These helpers group projects by that name so each gets a page.

import { activeMembers, worstStatus } from "./requirements";
import type { CohortData, Enrollment, Project, Status, SubjectStatus, Team } from "./types";

export interface Partner {
  /** URL-safe id made from the name. */
  id: string;
  name: string;
  projects: Project[];
  teams: Team[];
}

function partnerId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Every partner in the cohort, A to Z. */
export function partnersOf(data: CohortData): Partner[] {
  const byName = new Map<string, Partner>();
  for (const project of data.projects) {
    if (!project.partner) continue;
    const id = partnerId(project.partner);
    const partner = byName.get(id) ?? { id, name: project.partner, projects: [], teams: [] };
    partner.projects.push(project);
    partner.teams.push(...data.teams.filter((t) => t.projectId === project.id));
    byName.set(id, partner);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function partnerOfTeam(data: CohortData, team: Team): Partner | undefined {
  return partnersOf(data).find((p) => p.teams.some((t) => t.id === team.id));
}

/** The worst status among the partner's teams. */
export function partnerStatus(partner: Partner, teamStatuses: Map<string, SubjectStatus>): Status {
  return worstStatus(partner.teams.flatMap((t) => teamStatuses.get(t.id)?.status ?? []));
}

export function partnerMembers(data: CohortData, partner: Partner): Enrollment[] {
  return partner.teams.flatMap((t) => activeMembers(data, t.id));
}
