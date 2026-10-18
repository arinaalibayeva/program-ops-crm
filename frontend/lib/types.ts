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
  /** Values for the program's custom fields, keyed by FieldDefinition id. */
  fields?: Record<string, FieldValue>;
}

// ---- Custom participant fields ----

export const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "date",
  "select",
  "multi_select",
  "checkbox",
  "url",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type FieldValue = string | number | boolean | string[];

/**
 * An admin-defined participant field. Name, email and team are built in
 * because the app's logic depends on them; everything else is defined per
 * program. Array order in CohortData.fields is the display order.
 */
export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  /** Choices for select and multi_select. */
  options?: string[];
  /** Example shown in empty text inputs. */
  placeholder?: string;
  required: boolean;
  showInList: boolean;
  visibleToParticipant: boolean;
  /** Archived fields are hidden but keep their values. */
  archived?: boolean;
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

/** A note an admin wrote about a team. Times are ISO date-times. */
export interface TeamNote {
  id: string;
  teamId: string;
  body: string;
  author?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Dated team membership, so team changes keep their history. */
export interface TeamMembership {
  enrollmentId: string;
  teamId: string;
  startDate: ISODate;
  endDate?: ISODate;
}

export const EVENT_CATEGORIES = [
  "workshop",
  "talk",
  "panel",
  "meeting",
  "all-hands",
  "office-hours",
  "mentoring",
  "orientation",
  "showcase",
  "partner",
  "networking",
  "social",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** A labelled link on an event: slides, a recording, a form. */
export interface EventLink {
  label: string;
  url: string;
}

export interface ProgramEvent {
  id: string;
  cohortId: string;
  title: string;
  category: EventCategory;
  /** First (or only) day. */
  date: ISODate;
  /** Last day, for events that span several days. */
  endDate?: ISODate;
  /** "HH:MM", 24-hour. No start time means all day. */
  startTime?: string;
  endTime?: string;
  /** A room or address, or a meeting link. */
  location?: string;
  /** Who runs the event: a facilitator, speaker or partner. */
  host?: string;
  description?: string;
  links?: EventLink[];
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

/** Excuses a participant or team from one requirement, e.g. a medical leave. */
export interface Exemption {
  requirementId: string;
  subjectId: string; // enrollmentId or teamId
  reason?: string;
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
  exemptions: Exemption[];
  fields: FieldDefinition[];
  /** Newest first. */
  teamNotes: TeamNote[];
}

// ---- Computed status ----

/** Ordered from best to worst. */
export type Status = "met" | "on_track" | "at_risk" | "missing";

export interface RequirementResult {
  requirementId: string;
  status: Status;
  reason: string;
  /** Counted as met because the subject was excused. */
  excused?: boolean;
}

export interface SubjectStatus {
  status: Status;
  results: RequirementResult[];
  /** Short reasons for anything not met/on track, for the dashboard. */
  flags: string[];
}
