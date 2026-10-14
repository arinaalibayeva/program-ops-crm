// Domain types. These mirror the planned PostgreSQL tables so the mock data
// layer can later be swapped for the FastAPI backend without touching pages.

export type ISODate = string; // "2026-10-19"

export interface Program {
  id: string;
  name: string;
}

export interface Cohort {
  id: string;
  programId: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
}

/** Long-lived CRM record for a human. Survives across cohorts. */
export interface Person {
  id: string;
  name: string;
  email: string;
}

/** A person's participation in one cohort. */
export interface Enrollment {
  id: string;
  personId: string;
  cohortId: string;
  status: "active" | "withdrawn";
  joinedAt: ISODate;
  leftAt?: ISODate;
}

export interface Project {
  id: string;
  cohortId: string;
  title: string;
  partner?: string;
}

export interface Team {
  id: string;
  cohortId: string;
  name: string;
  projectId?: string;
}

/** Dated team membership, so team changes keep their history. */
export interface TeamMembership {
  enrollmentId: string;
  teamId: string;
  startDate: ISODate;
  endDate?: ISODate;
}

export const EVENT_CATEGORIES = ["workshop", "all-hands", "partner", "social"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface ProgramEvent {
  id: string;
  cohortId: string;
  title: string;
  category: EventCategory;
  date: ISODate;
  isRequired: boolean;
  checkinToken: string;
}

export interface Attendance {
  eventId: string;
  enrollmentId: string;
  source: "link" | "manual";
}

export type RequirementType =
  | "attendance_min"
  | "complete_by"
  | "team_min_size";

export type Requirement =
  | {
      id: string;
      name: string;
      scope: "participant";
      type: "attendance_min";
      params: { category: EventCategory; minCount: number };
    }
  | {
      id: string;
      name: string;
      scope: "participant" | "team";
      type: "complete_by";
      params: { dueDate: ISODate };
    }
  | {
      id: string;
      name: string;
      scope: "team";
      type: "team_min_size";
      params: { minActive: number };
    };

/** Marks a complete_by requirement as done for a participant or team. */
export interface Completion {
  requirementId: string;
  subjectId: string; // enrollmentId or teamId
  completedAt: ISODate;
}

export interface CohortData {
  program: Program;
  cohort: Cohort;
  today: ISODate;
  people: Person[];
  enrollments: Enrollment[];
  projects: Project[];
  teams: Team[];
  memberships: TeamMembership[];
  events: ProgramEvent[];
  attendance: Attendance[];
  requirements: Requirement[];
  completions: Completion[];
}

// ---- Computed status ----

/** Ordered from best to worst. */
export type Status = "met" | "on_track" | "at_risk" | "missing";

export interface RequirementResult {
  requirementId: string;
  status: Status;
  reason: string;
}

export interface SubjectStatus {
  status: Status;
  results: RequirementResult[];
  /** Short reasons for anything not met/on track, for the dashboard. */
  flags: string[];
}
