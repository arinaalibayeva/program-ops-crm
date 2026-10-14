"use client";

// In-browser store for the prototype. Pages read data and call actions through
// useCohort(); when the backend exists, these actions become API calls.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildMockCohort } from "./mock-data";
import { applyDraft, type ParticipantDraft } from "./participant-draft";
import { participantStatus, teamStatus } from "./requirements";
import type {
  CohortData,
  EventCategory,
  FieldDefinition,
  FieldValue,
  ProgramEvent,
  Requirement,
  SubjectStatus,
} from "./types";

// Bump the version when CohortData changes shape so old saved data is ignored.
const STORAGE_KEY = "program-ops-crm:cohort:v5";

export interface NewParticipant {
  name: string;
  email: string;
  team?: string;
  fields?: Record<string, FieldValue>;
}

interface CohortContextValue {
  data: CohortData;
  participantStatuses: Map<string, SubjectStatus>;
  teamStatuses: Map<string, SubjectStatus>;
  toggleAttendance: (eventId: string, enrollmentId: string) => void;
  toggleCompletion: (requirementId: string, subjectId: string) => void;
  updateParticipant: (enrollmentId: string, draft: ParticipantDraft) => void;
  addParticipants: (rows: NewParticipant[]) => number;
  addEvent: (event: {
    title: string;
    category: EventCategory;
    date: string;
    isRequired: boolean;
  }) => void;
  addRequirement: (req: Omit<Requirement, "id">) => void;
  deleteRequirement: (id: string) => void;
  addField: (field: Omit<FieldDefinition, "id">) => void;
  updateField: (id: string, patch: Partial<Omit<FieldDefinition, "id">>) => void;
  moveField: (id: string, toIndex: number) => void;
  deleteField: (id: string) => void;
  reset: () => void;
}

const CohortContext = createContext<CohortContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CohortProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CohortData>(buildMockCohort);
  const [loaded, setLoaded] = useState(false);

  // Restore edits from a previous visit. Runs after mount to avoid a
  // server/client hydration mismatch.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {
      // Ignore unreadable storage and keep the fresh mock data.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be unavailable (private mode); edits just won't persist.
    }
  }, [data, loaded]);

  const participantStatuses = useMemo(() => {
    const map = new Map<string, SubjectStatus>();
    for (const e of data.enrollments) {
      if (e.status === "active") map.set(e.id, participantStatus(data, e.id));
    }
    return map;
  }, [data]);

  const teamStatuses = useMemo(
    () => new Map(data.teams.map((t) => [t.id, teamStatus(data, t)])),
    [data],
  );

  const toggleAttendance = useCallback((eventId: string, enrollmentId: string) => {
    setData((d) => {
      const exists = d.attendance.some(
        (a) => a.eventId === eventId && a.enrollmentId === enrollmentId,
      );
      return {
        ...d,
        attendance: exists
          ? d.attendance.filter(
              (a) => !(a.eventId === eventId && a.enrollmentId === enrollmentId),
            )
          : [...d.attendance, { eventId, enrollmentId, source: "manual" }],
      };
    });
  }, []);

  const toggleCompletion = useCallback((requirementId: string, subjectId: string) => {
    setData((d) => {
      const exists = d.completions.some(
        (c) => c.requirementId === requirementId && c.subjectId === subjectId,
      );
      return {
        ...d,
        completions: exists
          ? d.completions.filter(
              (c) => !(c.requirementId === requirementId && c.subjectId === subjectId),
            )
          : [...d.completions, { requirementId, subjectId, completedAt: d.today }],
      };
    });
  }, []);

  const updateParticipant = useCallback(
    (enrollmentId: string, draft: ParticipantDraft) => {
      setData((d) => applyDraft(d, enrollmentId, draft));
    },
    [],
  );

  const addParticipants = useCallback(
    (rows: NewParticipant[]) => {
      const d = data;
      const next = {
        ...d,
        people: [...d.people],
        enrollments: [...d.enrollments],
        memberships: [...d.memberships],
        teams: [...d.teams],
      };
      let added = 0;
      for (const row of rows) {
        // Reuse the person record if this email already exists (returning
        // participant), otherwise create one.
        let person = next.people.find(
          (p) => p.email.toLowerCase() === row.email.toLowerCase(),
        );
        if (!person) {
          person = { id: newId("person"), name: row.name, email: row.email };
          next.people.push(person);
        }
        const personId = person.id;
        if (next.enrollments.some((e) => e.personId === personId)) continue;
        const enrollment = {
          id: newId("enr"),
          personId,
          cohortId: d.cohort.id,
          status: "active" as const,
          joinedAt: d.today,
          fields: row.fields,
        };
        next.enrollments.push(enrollment);
        added++;

        const teamName = row.team?.trim();
        if (teamName) {
          let team = next.teams.find(
            (t) => t.name.toLowerCase() === teamName.toLowerCase(),
          );
          if (!team) {
            team = { id: newId("team"), cohortId: d.cohort.id, name: teamName };
            next.teams.push(team);
          }
          next.memberships.push({
            enrollmentId: enrollment.id,
            teamId: team.id,
            startDate: d.today,
          });
        }
      }
      setData(next);
      return added;
    },
    [data],
  );

  const addEvent = useCallback<CohortContextValue["addEvent"]>((event) => {
    setData((d) => {
      const id = newId("ev");
      const newEvent: ProgramEvent = {
        ...event,
        id,
        cohortId: d.cohort.id,
        checkinToken: newId("chk"),
      };
      return {
        ...d,
        events: [...d.events, newEvent].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }, []);

  const addRequirement = useCallback((req: Omit<Requirement, "id">) => {
    setData((d) => ({
      ...d,
      requirements: [...d.requirements, { ...req, id: newId("req") } as Requirement],
    }));
  }, []);

  const deleteRequirement = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      requirements: d.requirements.filter((r) => r.id !== id),
      completions: d.completions.filter((c) => c.requirementId !== id),
      exemptions: d.exemptions.filter((x) => x.requirementId !== id),
    }));
  }, []);

  const addField = useCallback((field: Omit<FieldDefinition, "id">) => {
    setData((d) => ({ ...d, fields: [...d.fields, { ...field, id: newId("field") }] }));
  }, []);

  const updateField = useCallback<CohortContextValue["updateField"]>((id, patch) => {
    setData((d) => ({
      ...d,
      fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const moveField = useCallback((id: string, toIndex: number) => {
    setData((d) => {
      const fields = [...d.fields];
      const from = fields.findIndex((f) => f.id === id);
      if (from === -1 || from === toIndex) return d;
      const [field] = fields.splice(from, 1);
      fields.splice(toIndex, 0, field);
      return { ...d, fields };
    });
  }, []);

  // Permanent: also removes every participant's value for the field.
  const deleteField = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      fields: d.fields.filter((f) => f.id !== id),
      enrollments: d.enrollments.map((e) => {
        if (!e.fields || !(id in e.fields)) return e;
        const fields = { ...e.fields };
        delete fields[id];
        return { ...e, fields };
      }),
    }));
  }, []);

  const reset = useCallback(() => setData(buildMockCohort()), []);

  const value: CohortContextValue = {
    data,
    participantStatuses,
    teamStatuses,
    toggleAttendance,
    toggleCompletion,
    updateParticipant,
    addParticipants,
    addEvent,
    addRequirement,
    deleteRequirement,
    addField,
    updateField,
    moveField,
    deleteField,
    reset,
  };

  return <CohortContext.Provider value={value}>{children}</CohortContext.Provider>;
}

export function useCohort(): CohortContextValue {
  const ctx = useContext(CohortContext);
  if (!ctx) throw new Error("useCohort must be used inside <CohortProvider>");
  return ctx;
}

// ---- Convenience selectors ----

export function usePeopleIndex() {
  const { data } = useCohort();
  return useMemo(() => {
    const personById = new Map(data.people.map((p) => [p.id, p]));
    const enrollmentById = new Map(data.enrollments.map((e) => [e.id, e]));
    const teamById = new Map(data.teams.map((t) => [t.id, t]));
    const projectById = new Map(data.projects.map((p) => [p.id, p]));
    const personFor = (enrollmentId: string) => {
      const e = enrollmentById.get(enrollmentId);
      return e ? personById.get(e.personId) : undefined;
    };
    return { personById, enrollmentById, teamById, projectById, personFor };
  }, [data]);
}
