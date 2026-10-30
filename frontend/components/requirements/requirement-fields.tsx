"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import type { CohortData, Condition } from "@/lib/types";

/** "Only count records where [Month] is [October]", for record deadlines. */
export function RecordFilterFields({
  data,
  typeId,
  filter,
  onChange,
}: {
  data: CohortData;
  typeId: string | undefined;
  filter: Condition | undefined;
  onChange: (filter: Condition | undefined) => void;
}) {
  const type = data.recordTypes.find((t) => t.id === typeId);
  const choices = type?.fields.filter((f) => f.type === "select") ?? [];
  if (choices.length === 0) return null;
  const field = choices.find((f) => f.id === filter?.fieldId);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="filter-field">Only count records where</Label>
        <NativeSelect
          id="filter-field"
          value={filter?.fieldId ?? ""}
          onChange={(e) => {
            const next = choices.find((f) => f.id === e.target.value);
            onChange(
              next
                ? { fieldId: next.id, op: "is", value: next.options?.[0] ?? "" }
                : undefined,
            );
          }}
          className="w-full"
        >
          <option value="">Any record counts</option>
          {choices.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {field && (
        <div className="space-y-1.5">
          <Label htmlFor="filter-value">is</Label>
          <NativeSelect
            id="filter-value"
            value={filter?.value ?? ""}
            onChange={(e) =>
              onChange({ fieldId: field.id, op: "is", value: e.target.value })
            }
            className="w-full"
          >
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </div>
  );
}

export function DescriptionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="req-description">What to hand in</Label>
      <textarea
        id="req-description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Shown on the calendar, e.g. one PDF on Forum"
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
