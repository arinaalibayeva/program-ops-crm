"use client";

import { X } from "lucide-react";
import { FieldInput } from "@/components/field-input";
import { NativeSelect } from "@/components/native-select";
import { asFieldDefinition, linkedIds, linkOptions, targetName } from "@/lib/records";
import { useCohort } from "@/lib/store";
import type { FieldValue, RecordField } from "@/lib/types";

/** The right input for a record field, including links to other records. */
export function RecordInput({
  field,
  value,
  onChange,
  id,
}: {
  field: RecordField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  id?: string;
}) {
  if (field.type !== "link") {
    return <FieldInput id={id} field={asFieldDefinition(field)} value={value} onChange={onChange} />;
  }
  return <LinkInput field={field} value={value} onChange={onChange} id={id} />;
}

function LinkInput({
  field,
  value,
  onChange,
  id,
}: {
  field: RecordField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  id?: string;
}) {
  const { data } = useCohort();
  const options = linkOptions(data, field.linkTo!);
  const selected = linkedIds(value);
  const name = targetName(data, field.linkTo!, true).toLowerCase();

  if (!field.multiple) {
    return (
      <NativeSelect id={id} value={selected[0] ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full">
        <option value="">No {name}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    );
  }

  const labels = new Map(options.map((o) => [o.id, o.label]));
  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs">
              {labels.get(s) ?? "Unknown"}
              <button
                type="button"
                aria-label={`Remove ${labels.get(s) ?? "link"}`}
                onClick={() => onChange(selected.filter((x) => x !== s))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <NativeSelect
        id={id}
        value=""
        onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
        className="w-full"
      >
        <option value="">Add a {name}…</option>
        {options
          .filter((o) => !selected.includes(o.id))
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
      </NativeSelect>
    </div>
  );
}
