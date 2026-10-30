"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { RECORD_FIELD_TYPE_LABELS, targetName } from "@/lib/records";
import { useCohort } from "@/lib/store";
import { BUILT_IN_TARGETS, type RecordField, type RecordFieldType, type RecordType } from "@/lib/types";

const TYPES = Object.keys(RECORD_FIELD_TYPE_LABELS) as RecordFieldType[];

function describeField(data: ReturnType<typeof useCohort>["data"], f: RecordField): string {
  if (f.type === "link") {
    return `Links to ${f.multiple ? "several" : "one"} ${targetName(data, f.linkTo!, !f.multiple).toLowerCase()}`;
  }
  const base = RECORD_FIELD_TYPE_LABELS[f.type];
  return f.options?.length ? `${base}: ${f.options.join(", ")}` : base;
}

function hasOptions(type: RecordFieldType): boolean {
  return type === "select" || type === "multi_select";
}

function parseOptions(text: string): string[] {
  return text
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function FieldsEditor({ type }: { type: RecordType }) {
  const { data, moveRecordField } = useCohort();
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState(type.fields.length === 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Fields</h2>
          <p className="text-sm text-muted-foreground">
            The first text field names each record. Link fields connect records to other things.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Add field
          </Button>
        )}
      </div>

      <ul className="divide-y rounded-xl border">
        {type.fields.map((f, i) =>
          editing === f.id ? (
            <li key={f.id} className="p-3">
              <EditField type={type} field={f} onDone={() => setEditing(undefined)} />
            </li>
          ) : (
            <li key={f.id} className="group flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {f.label}
                </div>
                <div className="truncate text-xs text-muted-foreground">{describeField(data, f)}</div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${f.label} up`}
                  disabled={i === 0}
                  onClick={() => moveRecordField(type.id, f.id, i - 1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Move ${f.label} down`}
                  disabled={i === type.fields.length - 1}
                  onClick={() => moveRecordField(type.id, f.id, i + 1)}
                >
                  <ArrowDown />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Edit ${f.label}`} onClick={() => setEditing(f.id)}>
                  <Pencil />
                </Button>
              </div>
            </li>
          ),
        )}
        {type.fields.length === 0 && !adding && (
          <li className="px-3 py-4 text-sm text-muted-foreground">No fields yet.</li>
        )}
        {adding && (
          <li className="bg-muted/30 p-3">
            <NewField type={type} onDone={() => setAdding(false)} />
          </li>
        )}
      </ul>
    </section>
  );
}

function NewField({ type, onDone }: { type: RecordType; onDone: () => void }) {
  const { data, addRecordField } = useCohort();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<RecordFieldType>("text");
  const [options, setOptions] = useState("");
  const [linkTo, setLinkTo] = useState<string>("team");
  const [multiple, setMultiple] = useState(false);
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string>();
  const targets = [...BUILT_IN_TARGETS, ...data.recordTypes.map((t) => t.id)];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Enter a label.");
    const choices = parseOptions(options);
    if (hasOptions(kind) && choices.length === 0) return setError("Add at least one choice.");
    addRecordField(type.id, {
      label: label.trim(),
      type: kind,
      required,
      options: hasOptions(kind) ? choices : undefined,
      linkTo: kind === "link" ? linkTo : undefined,
      multiple: kind === "link" ? multiple : undefined,
    });
    // Ready for the next field, without carrying over this one's settings.
    setLabel("");
    setKind("text");
    setOptions("");
    setMultiple(false);
    setRequired(false);
    setError(undefined);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-field-label">Label</Label>
          <Input
            id="new-field-label"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Due date, Team, Status"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-field-type">Type</Label>
          <NativeSelect
            id="new-field-type"
            value={kind}
            onChange={(e) => setKind(e.target.value as RecordFieldType)}
            className="w-full"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {hasOptions(kind) && (
        <div className="space-y-1.5">
          <Label htmlFor="new-field-options">Choices, separated by commas</Label>
          <Input
            id="new-field-options"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="e.g. Open, In progress, Resolved"
          />
        </div>
      )}
      {kind === "link" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-field-target">Links to</Label>
            <NativeSelect
              id="new-field-target"
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
              className="w-full"
            >
              {targets.map((t) => (
                <option key={t} value={t}>
                  {targetName(data, t)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Can link to several
          </label>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Done
        </Button>
        <Button type="submit" size="sm">
          Add field
        </Button>
      </div>
    </form>
  );
}

function EditField({ type, field, onDone }: { type: RecordType; field: RecordField; onDone: () => void }) {
  const { data, updateRecordField, deleteRecordField } = useCohort();
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState(field.options?.join(", ") ?? "");
  const [required, setRequired] = useState(field.required);
  const [multiple, setMultiple] = useState(!!field.multiple);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  const usedBy = data.calculations.filter(
    (c) =>
      c.sourceTypeId === type.id &&
      (c.viaFieldId === field.id || c.dateFieldId === field.id || c.filter?.fieldId === field.id),
  );
  const filled = data.records.filter((r) => r.typeId === type.id && r.values[field.id] !== undefined).length;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Enter a label.");
    const choices = parseOptions(options);
    if (hasOptions(field.type) && choices.length === 0) return setError("Add at least one choice.");
    updateRecordField(type.id, field.id, {
      label: label.trim(),
      required,
      ...(hasOptions(field.type) ? { options: choices } : {}),
      ...(field.type === "link" ? { multiple } : {}),
    });
    onDone();
  }

  if (confirming) {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Delete <span className="font-medium">{field.label}</span>?{" "}
          {filled > 0 && `Its values in ${filled} record${filled === 1 ? "" : "s"} will be removed. `}
          {usedBy.length > 0 &&
            `This also deletes ${usedBy.map((c) => `“${c.label}”`).join(", ")} and the rules that use ${
              usedBy.length === 1 ? "it" : "them"
            }.`}
        </p>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              deleteRecordField(type.id, field.id);
              onDone();
            }}
          >
            Delete field
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`edit-${field.id}`}>Label</Label>
        <Input id={`edit-${field.id}`} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          {describeField(data, field)}. The type can&apos;t change once records may use it.
        </p>
      </div>
      {hasOptions(field.type) && (
        <div className="space-y-1.5">
          <Label htmlFor={`edit-options-${field.id}`}>Choices, separated by commas</Label>
          <Input id={`edit-options-${field.id}`} value={options} onChange={(e) => setOptions(e.target.value)} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        {field.type === "link" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Can link to several
          </label>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2 /> Delete
        </Button>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
