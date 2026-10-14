// Helpers for admin-defined participant fields.

import { formatDate } from "./format";
import type { CohortData, FieldDefinition, FieldType, FieldValue } from "./types";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  select: "Pick one",
  multi_select: "Pick several",
  checkbox: "Yes / no",
  url: "Link",
};

export function hasOptions(type: FieldType): boolean {
  return type === "select" || type === "multi_select";
}

/** Fields shown in forms and on profiles, in display order. */
export function activeFields(data: CohortData): FieldDefinition[] {
  return data.fields.filter((f) => !f.archived);
}

export function isEmptyValue(value: FieldValue | undefined): boolean {
  if (value === undefined || (typeof value === "string" && value.trim() === "")) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** How many enrollments have a value for this field. */
export function countValues(data: CohortData, fieldId: string): number {
  return data.enrollments.filter((e) => !isEmptyValue(e.fields?.[fieldId])).length;
}

export function formatFieldValue(
  field: FieldDefinition,
  value: FieldValue | undefined,
): string {
  if (field.type === "checkbox") return value ? "Yes" : "No";
  if (isEmptyValue(value)) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (field.type === "date") return formatDate(String(value));
  return String(value);
}

/** Returns an error message for a required field left empty. */
export function validateFields(
  fields: FieldDefinition[],
  values: Record<string, FieldValue>,
): string | undefined {
  const missing = fields.filter(
    (f) => f.required && f.type !== "checkbox" && isEmptyValue(values[f.id]),
  );
  if (missing.length > 0) {
    return `Fill in ${missing.map((f) => f.label).join(", ")}.`;
  }
}
