"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { cn } from "@/lib/utils";
import type { FieldDefinition, FieldValue } from "@/lib/types";

/** The right input for a custom field's type. */
export function FieldInput({
  field,
  value,
  onChange,
  id,
}: {
  field: FieldDefinition;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
  id?: string;
}) {
  switch (field.type) {
    case "long_text":
      return (
        <textarea
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      );
    case "number":
      return (
        <Input
          id={id}
          type="number"
          value={value === undefined || value === "" ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "url":
      return (
        <Input
          id={id}
          type="url"
          placeholder={field.placeholder ?? "https://"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "checkbox":
      return (
        <label className="flex h-8 items-center gap-2 text-sm">
          <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
          {value === true ? "Yes" : "No"}
        </label>
      );
    case "select":
      return (
        <NativeSelect
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      );
    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div id={id} className="flex flex-wrap gap-1.5">
          {field.options?.map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(on ? selected.filter((s) => s !== o) : [...selected, o])
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return (
        <Input
          id={id}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
