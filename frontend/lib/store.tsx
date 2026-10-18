"use client";

// Pages read data and call actions through useCohort(). With the backend on,
// each action updates the screen right away, then sends the change to the API
// and swaps in the saved cohort it returns. Without it, data lives in this
// browser's storage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SignInRequired, USE_BACKEND, api, goToSignIn } from "./api";
import { buildMockCohort } from "./mock-data";
import { applyDraft, type ParticipantDraft } from "./participant-draft";
import { participantStatus, teamStatus } from "./requirements";
import type {
  CohortData,
  FieldDefinition,
  FieldValue,
  ProgramEvent,
  Requirement,
  SubjectStatus,
} from "./types";

// Bump the version when CohortData changes shape so old saved data is ignored.
const STORAGE_KEY = "program-ops-crm:cohort:v12";

export type NewEvent = Omit<ProgramEvent, "id" | "cohortId" | "checkinToken">;

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
  /** Records a self check-in from the event link; does nothing if already recorded. */
  checkIn: (eventId: string, enrollmentId: string) => void;
  toggleCompletion: (requirementId: string, subjectId: string) => void;
  updateParticipant: (enrollmentId: string, draft: ParticipantDraft) => void;
  /** Resolves to how many people were added (people already enrolled are skipped). */
  addParticipants: (rows: NewParticipant[]) => Promise<number>;
  addEvent: (event: NewEvent) => void;
  /** Merges the given fields into the event; fields not passed are kept. */
  updateEvent: (id: string, event: Partial<NewEvent>) => void;
  addRequirement: (req: Omit<Requirement, "id">) => void;
  deleteRequirement: (id: string) => void;
  addField: (field: Omit<FieldDefinition, "id">) => void;
  updateField: (id: string, patch: Partial<Omit<FieldDefinition, "id">>) => void;
  moveField: (id: string, toIndex: number) => void;
  deleteField: (id: string) => void;
  addTeamNote: (teamId: string, body: string) => void;
  updateTeamNote: (id: string, body: string) => void;
  deleteTeamNote: (id: string) => void;
  reset: () => void;
  /** The last change the backend refused, shown until dismissed. */
  syncError?: string;
  clearSyncError: () => void;
}

const CohortContext = createContext<CohortContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CohortProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<CohortData>(buildMockCohort);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [syncError, setSyncError] = useState<string>();

  const load = useCallback(() => {
    setLoadError(undefined);
    api<CohortData>("/cohort")
      .then((saved) => {
        setData(saved);
        setLoaded(true);
      })
      .catch((e: Error) => {
        if (e instanceof SignInRequired) goToSignIn();
        else setLoadError(e.message);
      });
  }, []);

  /** Sends a change to the backend and shows what it saved. If it's refused,
   *  says why and reloads so the screen matches the database again. */
  const sync = useCallback(
    (request: () => Promise<CohortData>) => {
      if (!USE_BACKEND) return;
      request()
        .then(setData)
        .catch((e: Error) => {
          if (e instanceof SignInRequired) return goToSignIn();
          setSyncError(e.message);
          api<CohortData>("/cohort").then(setData).catch(() => {});
        });
    },
    [],
  );

  useEffect(() => {
    if (USE_BACKEND) load();
  }, [load]);

  // Restore edits from a previous visit. Runs after mount to avoid a
  // server/client hydration mismatch.
  useEffect(() => {
    if (USE_BACKEND) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setData(JSON.parse(saved));
    } catch {
      // Ignore unreadable storage and keep the fresh mock data.
    }
    setLoaded(true);
  }, []);

  // Pick up changes saved in another tab, e.g. a check-in while the admin
  // has the event page open. Stands in for live updates from the backend.
  useEffect(() => {
    if (USE_BACKEND) return;
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setData(JSON.parse(e.newValue));
      } catch {
        // Ignore a value we can't read.
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!loaded || USE_BACKEND) return;
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
    sync(() => api("/attendance/toggle", { body: { eventId, enrollmentId } }));
  }, [sync]);

  const checkIn = useCallback((eventId: string, enrollmentId: string) => {
    setData((d) =>
      d.attendance.some((a) => a.eventId === eventId && a.enrollmentId === enrollmentId)
        ? d
        : { ...d, attendance: [...d.attendance, { eventId, enrollmentId, source: "link" }] },
    );
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
    sync(() => api("/completions/toggle", { body: { requirementId, subjectId } }));
  }, [sync]);

  const updateParticipant = useCallback(
    (enrollmentId: string, draft: ParticipantDraft) => {
      setData((d) => applyDraft(d, enrollmentId, draft));
      sync(() => api(`/participants/${enrollmentId}`, { method: "PUT", body: draft }));
    },
    [sync],
  );

  const addParticipants = useCallback(
    async (rows: NewParticipant[]) => {
      if (USE_BACKEND) {
        const result = await api<{ added: number; data: CohortData }>("/participants", {
          body: { rows },
        });
        setData(result.data);
        return result.added;
      }
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
    sync(() => api("/events", { body: event }));
  }, [sync]);

  const updateEvent = useCallback<CohortContextValue["updateEvent"]>((id, event) => {
    setData((d) => ({
      ...d,
      events: d.events
        .map((e) => (e.id === id ? { ...e, ...event } : e))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    sync(() => api(`/events/${id}`, { method: "PATCH", body: event }));
  }, [sync]);

  const addRequirement = useCallback((req: Omit<Requirement, "id">) => {
    setData((d) => ({
      ...d,
      requirements: [...d.requirements, { ...req, id: newId("req") } as Requirement],
    }));
    sync(() => api("/requirements", { body: req }));
  }, [sync]);

  const deleteRequirement = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      requirements: d.requirements.filter((r) => r.id !== id),
      completions: d.completions.filter((c) => c.requirementId !== id),
      exemptions: d.exemptions.filter((x) => x.requirementId !== id),
    }));
    sync(() => api(`/requirements/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addField = useCallback((field: Omit<FieldDefinition, "id">) => {
    setData((d) => ({ ...d, fields: [...d.fields, { ...field, id: newId("field") }] }));
    sync(() => api("/fields", { body: field }));
  }, [sync]);

  const updateField = useCallback<CohortContextValue["updateField"]>((id, patch) => {
    setData((d) => ({
      ...d,
      fields: d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    sync(() => api(`/fields/${id}`, { method: "PATCH", body: patch }));
  }, [sync]);

  const moveField = useCallback((id: string, toIndex: number) => {
    setData((d) => {
      const fields = [...d.fields];
      const from = fields.findIndex((f) => f.id === id);
      if (from === -1 || from === toIndex) return d;
      const [field] = fields.splice(from, 1);
      fields.splice(toIndex, 0, field);
      return { ...d, fields };
    });
    sync(() => api(`/fields/${id}/move`, { body: { toIndex } }));
  }, [sync]);

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
    sync(() => api(`/fields/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addTeamNote = useCallback((teamId: string, body: string) => {
    const note = { id: newId("note"), teamId, body: body.trim(), createdAt: new Date().toISOString() };
    setData((d) => ({ ...d, teamNotes: [note, ...d.teamNotes] }));
    sync(() => api(`/teams/${teamId}/notes`, { body: { body } }));
  }, [sync]);

  const updateTeamNote = useCallback((id: string, body: string) => {
    setData((d) => ({
      ...d,
      teamNotes: d.teamNotes.map((n) =>
        n.id === id ? { ...n, body: body.trim(), updatedAt: new Date().toISOString() } : n,
      ),
    }));
    sync(() => api(`/team-notes/${id}`, { method: "PATCH", body: { body } }));
  }, [sync]);

  const deleteTeamNote = useCallback((id: string) => {
    setData((d) => ({ ...d, teamNotes: d.teamNotes.filter((n) => n.id !== id) }));
    sync(() => api(`/team-notes/${id}`, { method: "DELETE" }));
  }, [sync]);

  const reset = useCallback(() => {
    if (USE_BACKEND) sync(() => api("/reset", { method: "POST" }));
    else setData(buildMockCohort());
  }, [sync]);

  const value: CohortContextValue = {
    data,
    participantStatuses,
    teamStatuses,
    toggleAttendance,
    checkIn,
    toggleCompletion,
    updateParticipant,
    addParticipants,
    addEvent,
    updateEvent,
    addRequirement,
    deleteRequirement,
    addField,
    updateField,
    moveField,
    deleteField,
    addTeamNote,
    updateTeamNote,
    deleteTeamNote,
    reset,
    syncError,
    clearSyncError: () => setSyncError(undefined),
  };

  if (USE_BACKEND && !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {loadError ? (
          <div className="space-y-2">
            <p>Couldn&apos;t reach the server: {loadError}</p>
            <button type="button" onClick={load} className="font-medium text-foreground underline">
              Try again
            </button>
          </div>
        ) : (
          "Loading…"
        )}
      </div>
    );
  }

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
