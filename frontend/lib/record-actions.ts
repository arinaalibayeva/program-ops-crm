// Changes to custom record types and records, as pure functions of CohortData.
// The store applies them right away; the backend makes the same changes
// (backend/app/services/records.py), including what each delete cleans up.

import { linkedIds } from "./records";
import type {
  Calculation,
  CohortData,
  CustomRecord,
  FieldValue,
  RecordField,
  RecordForm,
  RecordType,
  Rule,
} from "./types";

export type NewRecordType = Pick<RecordType, "name" | "singular">;
export type NewRecordField = Omit<RecordField, "id">;
export type NewCalculation = Omit<Calculation, "id" | "programId">;
export type NewRule = Omit<Rule, "id">;
export type NewRecordForm = Omit<RecordForm, "id" | "token">;

function mapType(d: CohortData, typeId: string, f: (t: RecordType) => RecordType): CohortData {
  return { ...d, recordTypes: d.recordTypes.map((t) => (t.id === typeId ? f(t) : t)) };
}

/** Drops calculations matching `gone`, and their rules. */
function dropCalculations(d: CohortData, gone: (c: Calculation) => boolean): CohortData {
  const removed = new Set(d.calculations.filter(gone).map((c) => c.id));
  return {
    ...d,
    calculations: d.calculations.filter((c) => !removed.has(c.id)),
    rules: d.rules.filter((r) => !removed.has(r.calculationId)),
  };
}

export function addRecordType(d: CohortData, id: string, input: NewRecordType): CohortData {
  const type: RecordType = { id, programId: d.program.id, ...input, fields: [] };
  return { ...d, recordTypes: [...d.recordTypes, type] };
}

export function updateRecordType(d: CohortData, id: string, patch: Partial<NewRecordType>): CohortData {
  return mapType(d, id, (t) => ({ ...t, ...patch }));
}

/** Callers check first that no other type links here (the backend refuses). */
export function deleteRecordType(d: CohortData, id: string): CohortData {
  const next = dropCalculations(d, (c) => c.sourceTypeId === id || c.on === id);
  return {
    ...next,
    recordTypes: next.recordTypes.filter((t) => t.id !== id),
    records: next.records.filter((r) => r.typeId !== id),
    forms: next.forms.filter((f) => f.typeId !== id),
  };
}

export function addRecordField(d: CohortData, typeId: string, id: string, field: NewRecordField): CohortData {
  return mapType(d, typeId, (t) => ({ ...t, fields: [...t.fields, { ...field, id }] }));
}

export function updateRecordField(
  d: CohortData,
  typeId: string,
  fieldId: string,
  patch: Partial<NewRecordField>,
): CohortData {
  return mapType(d, typeId, (t) => ({
    ...t,
    fields: t.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
  }));
}

export function moveRecordField(d: CohortData, typeId: string, fieldId: string, toIndex: number): CohortData {
  return mapType(d, typeId, (t) => {
    const fields = t.fields.filter((f) => f.id !== fieldId);
    const field = t.fields.find((f) => f.id === fieldId);
    if (!field) return t;
    fields.splice(Math.max(0, Math.min(toIndex, fields.length)), 0, field);
    return { ...t, fields };
  });
}

/** Also removes the field's values, calculations that use it, and it from forms. */
export function deleteRecordField(d: CohortData, typeId: string, fieldId: string): CohortData {
  const next = dropCalculations(
    d,
    (c) =>
      c.sourceTypeId === typeId &&
      (c.viaFieldId === fieldId || c.dateFieldId === fieldId || c.filter?.fieldId === fieldId),
  );
  return {
    ...mapType(next, typeId, (t) => ({ ...t, fields: t.fields.filter((f) => f.id !== fieldId) })),
    records: next.records.map((r) => {
      if (r.typeId !== typeId || !(fieldId in r.values)) return r;
      const values = { ...r.values };
      delete values[fieldId];
      return { ...r, values };
    }),
    forms: next.forms.map((f) =>
      f.typeId === typeId ? { ...f, fieldIds: f.fieldIds.filter((id) => id !== fieldId) } : f,
    ),
  };
}

export function addRecord(
  d: CohortData,
  id: string,
  typeId: string,
  values: Record<string, FieldValue>,
): CohortData {
  const record: CustomRecord = {
    id,
    typeId,
    cohortId: d.cohort.id,
    values,
    createdAt: new Date().toISOString(),
  };
  return { ...d, records: [...d.records, record] };
}

export function updateRecord(d: CohortData, id: string, values: Record<string, FieldValue>): CohortData {
  return {
    ...d,
    records: d.records.map((r) => (r.id === id ? { ...r, values, updatedAt: new Date().toISOString() } : r)),
  };
}

/** Also unlinks the record from records that point at it. */
export function deleteRecord(d: CohortData, id: string): CohortData {
  const linkFields = new Set(
    d.recordTypes.flatMap((t) => t.fields.filter((f) => f.type === "link").map((f) => f.id)),
  );
  return {
    ...d,
    records: d.records
      .filter((r) => r.id !== id)
      .map((r) => {
        let changed = false;
        const values = { ...r.values };
        for (const [key, value] of Object.entries(values)) {
          if (!linkFields.has(key) || !linkedIds(value).includes(id)) continue;
          changed = true;
          if (Array.isArray(value)) values[key] = value.filter((v) => v !== id);
          else delete values[key];
        }
        return changed ? { ...r, values } : r;
      }),
  };
}

export function addCalculation(d: CohortData, id: string, calc: NewCalculation): CohortData {
  return { ...d, calculations: [...d.calculations, { ...calc, id, programId: d.program.id }] };
}

export function deleteCalculation(d: CohortData, id: string): CohortData {
  return dropCalculations(d, (c) => c.id === id);
}

export function addRule(d: CohortData, id: string, rule: NewRule): CohortData {
  return { ...d, rules: [...d.rules, { ...rule, id }] };
}

export function deleteRule(d: CohortData, id: string): CohortData {
  return { ...d, rules: d.rules.filter((r) => r.id !== id) };
}

export function addForm(d: CohortData, id: string, token: string, form: NewRecordForm): CohortData {
  return { ...d, forms: [...d.forms, { ...form, id, token }] };
}

export function updateForm(d: CohortData, id: string, patch: Partial<NewRecordForm>): CohortData {
  return { ...d, forms: d.forms.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function deleteForm(d: CohortData, id: string): CohortData {
  return { ...d, forms: d.forms.filter((f) => f.id !== id) };
}
