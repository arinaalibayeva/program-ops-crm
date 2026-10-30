"use client";

import { useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyLinkButton } from "@/components/copy-link-button";
import { targetName } from "@/lib/records";
import { useCohort } from "@/lib/store";
import type { NewRecordForm } from "@/lib/record-actions";
import type { RecordForm, RecordType } from "@/lib/types";

export function FormsEditor({ type }: { type: RecordType }) {
  const { data, updateForm, deleteForm } = useCohort();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string>();
  const forms = data.forms.filter((f) => f.typeId === type.id);
  const askable = type.fields.filter((f) => f.type !== "link");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Forms</h2>
          <p className="text-sm text-muted-foreground">
            Share a link so people add {type.name.toLowerCase()} themselves.
          </p>
        </div>
        {!adding && askable.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> New form
          </Button>
        )}
      </div>
      {askable.length === 0 && (
        <p className="rounded-xl border px-3 py-4 text-sm text-muted-foreground">
          Add a field other than a link first, so the form has something to ask.
        </p>
      )}
      {(forms.length > 0 || adding) && (
        <ul className="divide-y rounded-xl border">
          {forms.map((form) =>
            editing === form.id ? (
              <li key={form.id} className="p-3">
                <FormFields
                  type={type}
                  initial={form}
                  submitLabel="Save"
                  onSubmit={(values) => {
                    updateForm(form.id, values);
                    setEditing(undefined);
                  }}
                  onCancel={() => setEditing(undefined)}
                />
              </li>
            ) : (
              <li key={form.id} className="space-y-2 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{form.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Asks for{" "}
                      {form.fieldIds
                        .map((id) => type.fields.find((f) => f.id === id)?.label)
                        .filter(Boolean)
                        .join(", ")}
                      {form.roster && " · matches people by email"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button size="icon-sm" variant="ghost" aria-label="Edit form" onClick={() => setEditing(form.id)}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Delete form" onClick={() => deleteForm(form.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyLinkButton path={`/f/${form.token}`} label="Copy form link" />
                  <a
                    href={`/f/${form.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" /> Open
                  </a>
                  <label className="ml-auto flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.isOpen}
                      onChange={(e) => updateForm(form.id, { isOpen: e.target.checked })}
                    />
                    Accepting responses
                  </label>
                </div>
              </li>
            ),
          )}
          {adding && (
            <li className="bg-muted/30 p-3">
              <NewForm type={type} onDone={() => setAdding(false)} />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function NewForm({ type, onDone }: { type: RecordType; onDone: () => void }) {
  const { addForm } = useCohort();
  return (
    <FormFields
      type={type}
      submitLabel="Create form"
      onSubmit={(values) => {
        addForm({ ...values, typeId: type.id, isOpen: true });
        onDone();
      }}
      onCancel={onDone}
    />
  );
}

function FormFields({
  type,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  type: RecordType;
  initial?: RecordForm;
  submitLabel: string;
  onSubmit: (values: Omit<NewRecordForm, "typeId" | "isOpen">) => void;
  onCancel: () => void;
}) {
  const { data } = useCohort();
  const askable = type.fields.filter((f) => f.type !== "link");
  const autoLinks = type.fields.filter((f) => f.type === "link" && (f.linkTo === "participant" || f.linkTo === "team"));
  const [title, setTitle] = useState(initial?.title ?? `Add a ${type.singular.toLowerCase()}`);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [fieldIds, setFieldIds] = useState<string[]>(initial?.fieldIds ?? askable.map((f) => f.id));
  const [roster, setRoster] = useState(initial?.roster ?? true);
  const [error, setError] = useState<string>();

  // A required field the form doesn't ask for would make every submission fail.
  const unasked = type.fields.filter(
    (f) =>
      f.required &&
      !fieldIds.includes(f.id) &&
      !(roster && f.type === "link" && (f.linkTo === "participant" || f.linkTo === "team")),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Enter a title.");
    if (fieldIds.length === 0) return setError("Pick at least one field.");
    if (unasked.length) return setError(`Ask for ${unasked.map((f) => f.label).join(", ")}; it's required.`);
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      fieldIds: askable.map((f) => f.id).filter((id) => fieldIds.includes(id)),
      roster,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="form-title">Title</Label>
        <Input id="form-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="form-description">
          Instructions
        </Label>
        <Input id="form-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Ask for</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          {askable.map((f) => (
            <label key={f.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fieldIds.includes(f.id)}
                onChange={(e) =>
                  setFieldIds(e.target.checked ? [...fieldIds, f.id] : fieldIds.filter((x) => x !== f.id))
                }
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={roster} onChange={(e) => setRoster(e.target.checked)} />
        <span>
          Ask for their email and match it to a participant
          {autoLinks.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              Fills in {autoLinks.map((f) => `${f.label} (${targetName(data, f.linkTo!, true).toLowerCase()})`).join(" and ")}{" "}
              automatically.
            </span>
          )}
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
