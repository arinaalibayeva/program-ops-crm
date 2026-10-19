// Custom record types: labels, links, calculations and rules. Everything here
// is worked out from CohortData, so pages and the store share one definition.

import { formatFieldValue, isEmptyValue } from "./fields";
import { formatDate } from "./format";
import { worstStatus } from "./requirements";
import type {
  BuiltInTarget,
  Calculation,
  CalculationKind,
  CohortData,
  Condition,
  ConditionOp,
  CustomRecord,
  FieldDefinition,
  FieldValue,
  RecordField,
  RecordFieldType,
  RecordType,
  Rule,
  RuleOp,
  RuleResult,
  SubjectStatus,
} from "./types";

export const RECORD_FIELD_TYPE_LABELS: Record<RecordFieldType, string> = {
  text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  select: "Pick one",
  multi_select: "Pick several",
  checkbox: "Yes / no",
  url: "Link to a website",
  link: "Link to records",
};

export const BUILT_IN_LABELS: Record<BuiltInTarget, { one: string; many: string }> = {
  participant: { one: "Participant", many: "Participants" },
  team: { one: "Team", many: "Teams" },
  event: { one: "Event", many: "Events" },
};

export const CALCULATION_LABELS: Record<CalculationKind, string> = {
  count: "Count",
  latest: "Latest date",
  days_since: "Days since latest",
  percent: "Percent that match",
};

export const CONDITION_LABELS: Record<ConditionOp, string> = {
  is: "is",
  is_not: "is not",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

export const RULE_OP_LABELS: Record<RuleOp, string> = {
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  eq: "is exactly",
};

function isBuiltIn(target: string): target is BuiltInTarget {
  return target === "participant" || target === "team" || target === "event";
}

export function typeById(data: CohortData, id: string): RecordType | undefined {
  return data.recordTypes.find((t) => t.id === id);
}

/** "Teams", "Participants" or a record type's name. */
export function targetName(data: CohortData, target: string, one = false): string {
  if (isBuiltIn(target)) return BUILT_IN_LABELS[target][one ? "one" : "many"];
  const type = typeById(data, target);
  return type ? (one ? type.singular : type.name) : "Deleted type";
}

/** Where a built-in or custom record lives in the admin. */
export function targetHref(target: string, id: string): string {
  if (target === "participant") return `/admin/participants/${id}`;
  if (target === "team") return `/admin/teams/${id}`;
  if (target === "event") return `/admin/events/${id}`;
  return `/admin/records/${target}/${id}`;
}

export function linkedIds(value: FieldValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  return typeof value === "string" && value ? [value] : [];
}

/** A record field shaped like a participant field, so the shared field helpers and inputs work. */
export function asFieldDefinition(field: RecordField): FieldDefinition {
  return {
    id: field.id,
    label: field.label,
    type: field.type === "link" ? "text" : field.type,
    options: field.options,
    required: field.required,
    showInList: true,
    visibleToParticipant: false,
  };
}

export function recordTitle(data: CohortData, record: CustomRecord): string {
  const type = typeById(data, record.typeId);
  if (!type) return "Record";
  const titleField = type.fields.find((f) => f.type !== "link" && f.type !== "checkbox");
  const value = titleField ? record.values[titleField.id] : undefined;
  if (titleField && !isEmptyValue(value)) return formatFieldValue(asFieldDefinition(titleField), value);
  return `${type.singular} ${formatDate(record.createdAt.slice(0, 10))}`;
}

/** Name of one linked thing, for chips and tables. */
export function linkLabel(data: CohortData, target: string, id: string): string {
  if (target === "participant") {
    const e = data.enrollments.find((x) => x.id === id);
    return data.people.find((p) => p.id === e?.personId)?.name ?? "Unknown";
  }
  if (target === "team") {
    const team = data.teams.find((t) => t.id === id);
    return team ? `Team ${team.name}` : "Unknown team";
  }
  if (target === "event") return data.events.find((e) => e.id === id)?.title ?? "Unknown event";
  const record = data.records.find((r) => r.id === id);
  return record ? recordTitle(data, record) : "Deleted record";
}

/** Everything a link field can point at, sorted by name. */
export function linkOptions(data: CohortData, target: string): { id: string; label: string }[] {
  let ids: string[];
  if (target === "participant") {
    ids = data.enrollments.filter((e) => e.status === "active").map((e) => e.id);
  } else if (target === "team") {
    ids = data.teams.map((t) => t.id);
  } else if (target === "event") {
    return data.events.map((e) => ({ id: e.id, label: `${e.title} · ${formatDate(e.date)}` }));
  } else {
    ids = data.records.filter((r) => r.typeId === target).map((r) => r.id);
  }
  return ids
    .map((id) => ({ id, label: linkLabel(data, target, id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formatRecordValue(data: CohortData, field: RecordField, value: FieldValue | undefined): string {
  if (field.type === "link") {
    const ids = linkedIds(value);
    return ids.length ? ids.map((id) => linkLabel(data, field.linkTo!, id)).join(", ") : "—";
  }
  return formatFieldValue(asFieldDefinition(field), value);
}

/** Does a record's value satisfy a condition? Lists match if any item does. */
export function matches(data: CohortData, record: CustomRecord, condition: Condition): boolean {
  const value = record.values[condition.fieldId];
  if (condition.op === "is_empty") return isEmptyValue(value) || value === false;
  if (condition.op === "is_not_empty") return !(isEmptyValue(value) || value === false);
  const wanted = (condition.value ?? "").toLowerCase();
  const values = Array.isArray(value) ? value : [value];
  const hit = values.some((v) => {
    if (typeof v === "boolean") return (v ? "yes" : "no") === wanted;
    return String(v ?? "").toLowerCase() === wanted;
  });
  return condition.op === "is" ? hit : !hit;
}

export function describeCondition(data: CohortData, type: RecordType | undefined, c: Condition): string {
  const field = type?.fields.find((f) => f.id === c.fieldId);
  const label = field?.label ?? "a deleted field";
  if (c.op === "is_empty" || c.op === "is_not_empty") return `${label} ${CONDITION_LABELS[c.op]}`;
  const value = field?.type === "link" && c.value ? linkLabel(data, field.linkTo!, c.value) : c.value;
  return `${label} ${CONDITION_LABELS[c.op]} ${value || "(blank)"}`;
}

/** Records of the calculation's source type that link to this subject. */
export function sourceRecords(data: CohortData, calc: Calculation, subjectId: string): CustomRecord[] {
  return data.records.filter(
    (r) => r.typeId === calc.sourceTypeId && linkedIds(r.values[calc.viaFieldId]).includes(subjectId),
  );
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** A number for count, percent and days_since; an ISO date for latest; undefined when there's nothing to go on. */
export function calculate(data: CohortData, calc: Calculation, subjectId: string): number | string | undefined {
  const records = sourceRecords(data, calc, subjectId);
  const matching = calc.filter ? records.filter((r) => matches(data, r, calc.filter!)) : records;
  switch (calc.kind) {
    case "count":
      return matching.length;
    case "percent":
      return records.length ? Math.round((100 * matching.length) / records.length) : undefined;
    case "latest":
    case "days_since": {
      const dates = matching
        .map((r) => r.values[calc.dateFieldId ?? ""])
        .filter((v): v is string => typeof v === "string" && v !== "")
        .sort();
      const latest = dates.at(-1);
      if (!latest) return undefined;
      return calc.kind === "latest" ? latest : daysBetween(latest, data.today);
    }
  }
}

export function formatCalculation(calc: Calculation, value: number | string | undefined): string {
  if (value === undefined) {
    return calc.kind === "percent" ? "No records yet" : "Never";
  }
  if (calc.kind === "latest") return formatDate(String(value));
  if (calc.kind === "percent") return `${value}%`;
  if (calc.kind === "days_since") {
    if (value === 0) return "Today";
    return `${value} day${value === 1 ? "" : "s"} ago`;
  }
  return String(value);
}

export function describeCalculation(data: CohortData, calc: Calculation): string {
  const type = typeById(data, calc.sourceTypeId);
  const via = type?.fields.find((f) => f.id === calc.viaFieldId)?.label ?? "a deleted field";
  const source = type?.name ?? "deleted records";
  const filter = calc.filter ? ` where ${describeCondition(data, type, calc.filter)}` : "";
  const date = type?.fields.find((f) => f.id === calc.dateFieldId)?.label ?? "date";
  const what = {
    count: `Number of ${source}${filter}`,
    percent: `Share of ${source}${filter}`,
    latest: `Latest ${date} of ${source}${filter}`,
    days_since: `Days since the latest ${date} of ${source}${filter}`,
  }[calc.kind];
  return `${what}, linked by ${via}`;
}

/** Only numbers can cross a threshold. */
export function canHaveRules(kind: CalculationKind): boolean {
  return kind !== "latest";
}

function crosses(op: RuleOp, value: number, threshold: number): boolean {
  if (op === "gt") return value > threshold;
  if (op === "gte") return value >= threshold;
  if (op === "lt") return value < threshold;
  if (op === "lte") return value <= threshold;
  return value === threshold;
}

/** Rules that flag this subject. `on` is participant, team or a record type id. */
export function evaluateRules(data: CohortData, on: string, subjectId: string): RuleResult[] {
  const results: RuleResult[] = [];
  for (const rule of data.rules) {
    const calc = data.calculations.find((c) => c.id === rule.calculationId);
    if (!calc || calc.on !== on || !canHaveRules(calc.kind)) continue;
    const value = calculate(data, calc, subjectId);
    const flagged = value === undefined ? rule.whenEmpty : crosses(rule.op, Number(value), rule.value);
    if (flagged) results.push({ ruleId: rule.id, status: rule.status, reason: rule.message });
  }
  return results;
}

/** Adds rule flags to a requirement-based status. */
export function withRules(status: SubjectStatus, rules: RuleResult[]): SubjectStatus {
  if (rules.length === 0) return status;
  return {
    ...status,
    status: worstStatus([status.status, ...rules.map((r) => r.status)]),
    ruleResults: rules,
    flags: [...status.flags, ...rules.map((r) => r.reason)],
  };
}

export function describeRule(rule: Rule, calc: Calculation | undefined): string {
  const label = calc?.label ?? "A deleted calculation";
  const unit = calc?.kind === "percent" ? "%" : "";
  const main = `${label} ${RULE_OP_LABELS[rule.op]} ${rule.value}${unit}`;
  return rule.whenEmpty ? `${main}, or there's nothing yet` : main;
}

/** Record types with a link field pointing at `target`, for "related records" sections. */
export function incomingLinks(data: CohortData, target: string): { type: RecordType; field: RecordField }[] {
  return data.recordTypes.flatMap((type) =>
    type.fields.filter((f) => f.type === "link" && f.linkTo === target).map((field) => ({ type, field })),
  );
}

/** Returns an error for a required field left empty. */
export function validateRecord(type: RecordType, values: Record<string, FieldValue>): string | undefined {
  const missing = type.fields.filter((f) => f.required && f.type !== "checkbox" && isEmptyValue(values[f.id]));
  if (missing.length) return `Fill in ${missing.map((f) => f.label).join(", ")}.`;
}
