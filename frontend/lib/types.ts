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
  partnerId?: string;
}

export interface PartnerContact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

/** An organization that gives teams projects. Belongs to the program, so it outlasts a cohort. */
export interface Partner {
  id: string;
  programId: string;
  name: string;
  website?: string;
  description?: string;
  /** The staff member who looks after this relationship. */
  ownerId?: string;
  contacts: PartnerContact[];
}

/** Someone who can sign in to the CRM and look after teams and partners. */
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  jobTitle?: string;
}

export interface Team {
  id: string;
  cohortId: string;
  name: string;
  projectId?: string;
  /** The staff member who looks after this team. */
  ownerId?: string;
}

// ---- Custom record types ----
// Admins describe their own kinds of records (partner meetings, issues,
// submissions...) and link them to built-in things or to each other.
// Calculations read linked records; rules turn calculations into flags.

/** Built-in things a link can point at. Anything else is a record type id. */
export const BUILT_IN_TARGETS = ["participant", "team", "event"] as const;
export type BuiltInTarget = (typeof BUILT_IN_TARGETS)[number];

export type RecordFieldType = FieldType | "link";

export interface RecordField {
  id: string;
  label: string;
  type: RecordFieldType;
  /** Choices for select and multi_select. */
  options?: string[];
  required: boolean;
  /** For links: a built-in target or a record type id. */
  linkTo?: string;
  /** For links: can hold several records. */
  multiple?: boolean;
}

export interface RecordType {
  id: string;
  programId: string;
  /** Plural, as shown in navigation: "Partner meetings". */
  name: string;
  /** "Partner meeting". */
  singular: string;
  /** In display order. The first non-link field titles each record. */
  fields: RecordField[];
}

/** Link fields hold a record id, or a list of ids when multiple. */
export interface CustomRecord {
  id: string;
  typeId: string;
  cohortId: string;
  values: Record<string, FieldValue>;
  createdAt: string;
  updatedAt?: string;
}

export const CONDITION_OPS = ["is", "is_not", "is_empty", "is_not_empty"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

export interface Condition {
  fieldId: string;
  op: ConditionOp;
  value?: string;
}

export const CALCULATION_KINDS = ["count", "latest", "days_since", "percent"] as const;
export type CalculationKind = (typeof CALCULATION_KINDS)[number];

/**
 * A number or date worked out from linked records, shown on every record it's
 * "on" (participant, team or a record type id). It reads records of
 * sourceTypeId whose link field viaFieldId points at that record.
 */
export interface Calculation {
  id: string;
  programId: string;
  label: string;
  on: string;
  kind: CalculationKind;
  sourceTypeId: string;
  viaFieldId: string;
  /** For latest and days_since. */
  dateFieldId?: string;
  /** count: only matching records. percent: the share that match. */
  filter?: Condition;
}

export const RULE_OPS = ["gt", "gte", "lt", "lte", "eq"] as const;
export type RuleOp = (typeof RULE_OPS)[number];

/** Flags a record when its calculation crosses a threshold. */
export interface Rule {
  id: string;
  calculationId: string;
  op: RuleOp;
  value: number;
  /** Also flag when there's nothing to calculate from (e.g. no meetings yet). */
  whenEmpty: boolean;
  status: "at_risk" | "missing";
  /** Shown on Today, e.g. "No partner meeting in 2 weeks". */
  message: string;
}

/** A shareable link that creates records of one type. */
export interface RecordForm {
  id: string;
  typeId: string;
  title: string;
  description?: string;
  /** Non-link fields to ask for, in order. */
  fieldIds: string[];
  token: string;
  /**
   * Ask for the submitter's email and match it to an active participant;
   * links to participants and teams are then filled in automatically.
   */
  roster: boolean;
  isOpen: boolean;
}

export type NoteSubject = "participant" | "team" | "partner";

/** A note an admin wrote about a participant, team or partner. Times are ISO date-times. */
export interface Note {
  id: string;
  subjectType: NoteSubject;
  /** An enrollment, team or partner id. */
  subjectId: string;
  body: string;
  author?: string;
  /** Asks someone to come back to this by a date; it shows on Today until done. */
  followUpDate?: ISODate;
  followUpDone: boolean;
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
  "deadline",
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
  /** The one partner this event is with. Partner sessions without one are for every partner. */
  partnerId?: string;
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
  | "team_min_size"
  | "record_by";

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
    }
  | {
      id: string;
      name: string;
      scope: "participant" | "team";
      type: "record_by";
      /** Met by logging records of typeId linked through viaFieldId, not by ticking a box. */
      params: {
        typeId: string;
        viaFieldId: string;
        minCount: number;
        dueDate: ISODate;
        /** Which date on the record decides whether it was on time. */
        dateFieldId?: string;
      };
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
  partners: Partner[];
  staff: StaffMember[];
  /** Newest first. */
  notes: Note[];
  recordTypes: RecordType[];
  /** Oldest first. */
  records: CustomRecord[];
  calculations: Calculation[];
  rules: Rule[];
  forms: RecordForm[];
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

export interface RuleResult {
  ruleId: string;
  status: Status;
  reason: string;
}

export interface SubjectStatus {
  status: Status;
  results: RequirementResult[];
  /** Admin-defined rules that flagged this subject. */
  ruleResults?: RuleResult[];
  /** Short reasons for anything not met/on track, for the dashboard. */
  flags: string[];
}
