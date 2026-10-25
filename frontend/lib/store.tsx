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
import * as records from "./record-actions";
import type {
  NewCalculation,
  NewRecordField,
  NewRecordForm,
  NewRecordType,
  NewRule,
} from "./record-actions";
import { evaluateRules, withRules } from "./records";
import type {
  CohortData,
  FieldDefinition,
  FieldValue,
  Note,
  NoteSubject,
  Partner,
  PartnerContact,
  ProgramEvent,
  Requirement,
  SubjectStatus,
} from "./types";

// Bump the version when CohortData changes shape so old saved data is ignored.
const STORAGE_KEY = "program-ops-crm:cohort:v19";

export type NewEvent = Omit<ProgramEvent, "id" | "cohortId" | "checkinToken">;

export type NewPartner = Pick<Partner, "name" | "website" | "description" | "ownerId">;
export type NewContact = Omit<PartnerContact, "id">;
export type NotePatch = Partial<Pick<Note, "body" | "followUpDone">> & { followUpDate?: string | null };

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
  /** Also removes its attendance and unlinks records that point at it. */
  deleteEvent: (id: string) => void;
  addRequirement: (req: Omit<Requirement, "id">) => void;
  /** Name and settings only; what it applies to and its kind stay fixed. */
  updateRequirement: (req: Requirement) => void;
  deleteRequirement: (id: string) => void;
  addField: (field: Omit<FieldDefinition, "id">) => void;
  updateField: (id: string, patch: Partial<Omit<FieldDefinition, "id">>) => void;
  moveField: (id: string, toIndex: number) => void;
  deleteField: (id: string) => void;
  addNote: (subjectType: NoteSubject, subjectId: string, body: string, followUpDate?: string) => void;
  updateNote: (id: string, patch: NotePatch) => void;
  deleteNote: (id: string) => void;
  /** Returns the new partner's id so pages can open it. */
  addPartner: (partner: NewPartner) => string;
  updatePartner: (id: string, patch: Partial<NewPartner>) => void;
  addContact: (partnerId: string, contact: NewContact) => void;
  deleteContact: (partnerId: string, contactId: string) => void;
  setProjectPartner: (projectId: string, partnerId: string | undefined) => void;
  setTeamOwner: (teamId: string, ownerId: string | undefined) => void;
  // Custom record types. Adds return the new id so pages can open it.
  addRecordType: (input: NewRecordType) => string;
  updateRecordType: (id: string, patch: Partial<NewRecordType>) => void;
  deleteRecordType: (id: string) => void;
  addRecordField: (typeId: string, field: NewRecordField) => string;
  updateRecordField: (typeId: string, fieldId: string, patch: Partial<NewRecordField>) => void;
  moveRecordField: (typeId: string, fieldId: string, toIndex: number) => void;
  deleteRecordField: (typeId: string, fieldId: string) => void;
  addRecord: (typeId: string, values: Record<string, FieldValue>) => string;
  /** Replaces the record's values. */
  updateRecord: (id: string, values: Record<string, FieldValue>) => void;
  deleteRecord: (id: string) => void;
  addCalculation: (calc: NewCalculation) => string;
  deleteCalculation: (id: string) => void;
  addRule: (rule: NewRule) => void;
  deleteRule: (id: string) => void;
  addForm: (form: NewRecordForm) => string;
  updateForm: (id: string, patch: Partial<NewRecordForm>) => void;
  deleteForm: (id: string) => void;
  reset: () => void;
  /** The last change the backend refused, shown until dismissed. */
  syncError?: string;
  clearSyncError: () => void;
}

const CohortContext = createContext<CohortContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Hard to guess, for links shared outside the admin. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
      if (e.status === "active") {
        map.set(e.id, withRules(participantStatus(data, e.id), evaluateRules(data, "participant", e.id)));
      }
    }
    return map;
  }, [data]);

  const teamStatuses = useMemo(
    () =>
      new Map(
        data.teams.map((t) => [t.id, withRules(teamStatus(data, t), evaluateRules(data, "team", t.id))]),
      ),
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
    // Undefined means "clear this"; JSON would leave it out, so it's sent as null.
    const body = Object.fromEntries(Object.entries(event).map(([k, v]) => [k, v ?? null]));
    sync(() => api(`/events/${id}`, { method: "PATCH", body }));
  }, [sync]);

  const deleteEvent = useCallback((id: string) => {
    setData((d) => records.deleteEvent(d, id));
    sync(() => api(`/events/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addRequirement = useCallback((req: Omit<Requirement, "id">) => {
    setData((d) => ({
      ...d,
      requirements: [...d.requirements, { ...req, id: newId("req") } as Requirement],
    }));
    sync(() => api("/requirements", { body: req }));
  }, [sync]);

  const updateRequirement = useCallback((req: Requirement) => {
    setData((d) => ({ ...d, requirements: d.requirements.map((r) => (r.id === req.id ? req : r)) }));
    const { id, ...body } = req;
    sync(() => api(`/requirements/${id}`, { method: "PUT", body }));
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

  const addNote = useCallback<CohortContextValue["addNote"]>((subjectType, subjectId, body, followUpDate) => {
    const id = newId("note");
    const note: Note = {
      id,
      subjectType,
      subjectId,
      body: body.trim(),
      followUpDate,
      followUpDone: false,
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, notes: [note, ...d.notes] }));
    sync(() => api("/notes", { body: { id, subjectType, subjectId, body, followUpDate } }));
  }, [sync]);

  const updateNote = useCallback<CohortContextValue["updateNote"]>((id, patch) => {
    setData((d) => ({
      ...d,
      notes: d.notes.map((n) => {
        if (n.id !== id) return n;
        const next = { ...n, ...patch, followUpDate: "followUpDate" in patch ? (patch.followUpDate ?? undefined) : n.followUpDate };
        return patch.body === undefined
          ? next
          : { ...next, body: patch.body.trim(), updatedAt: new Date().toISOString() };
      }),
    }));
    sync(() => api(`/notes/${id}`, { method: "PATCH", body: patch }));
  }, [sync]);

  const deleteNote = useCallback((id: string) => {
    setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    sync(() => api(`/notes/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addPartner = useCallback((partner: NewPartner) => {
    const id = newId("partner");
    setData((d) => ({ ...d, partners: [...d.partners, { ...partner, id, programId: d.program.id, contacts: [] }] }));
    sync(() => api("/partners", { body: { id, ...partner } }));
    return id;
  }, [sync]);

  const updatePartner = useCallback((id: string, patch: Partial<NewPartner>) => {
    setData((d) => ({
      ...d,
      partners: d.partners.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    // Undefined means "clear this"; JSON would leave it out, so it's sent as null.
    const body = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? null]));
    sync(() => api(`/partners/${id}`, { method: "PATCH", body }));
  }, [sync]);

  const addContact = useCallback((partnerId: string, contact: NewContact) => {
    const id = newId("contact");
    setData((d) => ({
      ...d,
      partners: d.partners.map((p) =>
        p.id === partnerId ? { ...p, contacts: [...p.contacts, { ...contact, id }] } : p,
      ),
    }));
    sync(() => api(`/partners/${partnerId}/contacts`, { body: { id, ...contact } }));
  }, [sync]);

  const deleteContact = useCallback((partnerId: string, contactId: string) => {
    setData((d) => ({
      ...d,
      partners: d.partners.map((p) =>
        p.id === partnerId ? { ...p, contacts: p.contacts.filter((c) => c.id !== contactId) } : p,
      ),
    }));
    sync(() => api(`/partner-contacts/${contactId}`, { method: "DELETE" }));
  }, [sync]);

  const setProjectPartner = useCallback((projectId: string, partnerId: string | undefined) => {
    setData((d) => ({
      ...d,
      projects: d.projects.map((p) => (p.id === projectId ? { ...p, partnerId } : p)),
    }));
    sync(() => api(`/projects/${projectId}/partner`, { method: "PUT", body: { partnerId: partnerId ?? null } }));
  }, [sync]);

  const setTeamOwner = useCallback((teamId: string, ownerId: string | undefined) => {
    setData((d) => ({
      ...d,
      teams: d.teams.map((t) => (t.id === teamId ? { ...t, ownerId } : t)),
    }));
    sync(() => api(`/teams/${teamId}/owner`, { method: "PUT", body: { ownerId: ownerId ?? null } }));
  }, [sync]);

  // ---- Custom record types ----
  // Each applies the change here, then sends it with the same id so the
  // backend's copy matches and pages can link to it straight away.

  const addRecordType = useCallback((input: NewRecordType) => {
    const id = newId("rt");
    setData((d) => records.addRecordType(d, id, input));
    sync(() => api("/record-types", { body: { id, ...input } }));
    return id;
  }, [sync]);

  const updateRecordType = useCallback((id: string, patch: Partial<NewRecordType>) => {
    setData((d) => records.updateRecordType(d, id, patch));
    sync(() => api(`/record-types/${id}`, { method: "PATCH", body: patch }));
  }, [sync]);

  const deleteRecordType = useCallback((id: string) => {
    setData((d) => records.deleteRecordType(d, id));
    sync(() => api(`/record-types/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addRecordField = useCallback((typeId: string, field: NewRecordField) => {
    const id = newId("rf");
    setData((d) => records.addRecordField(d, typeId, id, field));
    sync(() => api(`/record-types/${typeId}/fields`, { body: { id, ...field } }));
    return id;
  }, [sync]);

  const updateRecordField = useCallback(
    (typeId: string, fieldId: string, patch: Partial<NewRecordField>) => {
      setData((d) => records.updateRecordField(d, typeId, fieldId, patch));
      sync(() => api(`/record-fields/${fieldId}`, { method: "PATCH", body: patch }));
    },
    [sync],
  );

  const moveRecordField = useCallback((typeId: string, fieldId: string, toIndex: number) => {
    setData((d) => records.moveRecordField(d, typeId, fieldId, toIndex));
    sync(() => api(`/record-fields/${fieldId}/move`, { body: { toIndex } }));
  }, [sync]);

  const deleteRecordField = useCallback((typeId: string, fieldId: string) => {
    setData((d) => records.deleteRecordField(d, typeId, fieldId));
    sync(() => api(`/record-fields/${fieldId}`, { method: "DELETE" }));
  }, [sync]);

  const addRecord = useCallback((typeId: string, values: Record<string, FieldValue>) => {
    const id = newId("rec");
    setData((d) => records.addRecord(d, id, typeId, values));
    sync(() => api("/records", { body: { id, typeId, values } }));
    return id;
  }, [sync]);

  const updateRecord = useCallback((id: string, values: Record<string, FieldValue>) => {
    setData((d) => records.updateRecord(d, id, values));
    sync(() => api(`/records/${id}`, { method: "PUT", body: { values } }));
  }, [sync]);

  const deleteRecord = useCallback((id: string) => {
    setData((d) => records.deleteRecord(d, id));
    sync(() => api(`/records/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addCalculation = useCallback((calc: NewCalculation) => {
    const id = newId("calc");
    setData((d) => records.addCalculation(d, id, calc));
    sync(() => api("/calculations", { body: { id, ...calc } }));
    return id;
  }, [sync]);

  const deleteCalculation = useCallback((id: string) => {
    setData((d) => records.deleteCalculation(d, id));
    sync(() => api(`/calculations/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addRule = useCallback((rule: NewRule) => {
    const id = newId("rule");
    setData((d) => records.addRule(d, id, rule));
    sync(() => api("/rules", { body: { id, ...rule } }));
  }, [sync]);

  const deleteRule = useCallback((id: string) => {
    setData((d) => records.deleteRule(d, id));
    sync(() => api(`/rules/${id}`, { method: "DELETE" }));
  }, [sync]);

  const addForm = useCallback((form: NewRecordForm) => {
    const id = newId("form");
    const token = newToken();
    setData((d) => records.addForm(d, id, token, form));
    sync(() => api("/forms", { body: { id, token, ...form } }));
    return id;
  }, [sync]);

  const updateForm = useCallback((id: string, patch: Partial<NewRecordForm>) => {
    setData((d) => records.updateForm(d, id, patch));
    sync(() => api(`/forms/${id}`, { method: "PATCH", body: patch }));
  }, [sync]);

  const deleteForm = useCallback((id: string) => {
    setData((d) => records.deleteForm(d, id));
    sync(() => api(`/forms/${id}`, { method: "DELETE" }));
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
    deleteEvent,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    addField,
    updateField,
    moveField,
    deleteField,
    addNote,
    updateNote,
    deleteNote,
    addPartner,
    updatePartner,
    addContact,
    deleteContact,
    setProjectPartner,
    setTeamOwner,
    addRecordType,
    updateRecordType,
    deleteRecordType,
    addRecordField,
    updateRecordField,
    moveRecordField,
    deleteRecordField,
    addRecord,
    updateRecord,
    deleteRecord,
    addCalculation,
    deleteCalculation,
    addRule,
    deleteRule,
    addForm,
    updateForm,
    deleteForm,
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
    const partnerById = new Map(data.partners.map((p) => [p.id, p]));
    const personFor = (enrollmentId: string) => {
      const e = enrollmentById.get(enrollmentId);
      return e ? personById.get(e.personId) : undefined;
    };
    return { personById, enrollmentById, teamById, projectById, partnerById, personFor };
  }, [data]);
}
