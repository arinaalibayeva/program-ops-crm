"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  ArrowLeft,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { useCohort } from "@/lib/store";
import { FIELD_TYPE_LABELS, countValues, hasOptions } from "@/lib/fields";
import { cn } from "@/lib/utils";
import { FIELD_TYPES, type FieldDefinition, type FieldType } from "@/lib/types";

const BUILT_IN = [
  { label: "Name", type: "Short text" },
  { label: "Email", type: "Email" },
  { label: "Team", type: "Assigned from the participant's page" },
];

export default function FieldsPage() {
  const { data, moveField, updateField, deleteField } = useCohort();
  const [dragId, setDragId] = useState<string>();

  const active = data.fields.filter((f) => !f.archived);
  const archived = data.fields.filter((f) => f.archived);

  // Positions in data.fields include archived fields, so move relative to
  // the neighbouring active field rather than by list index.
  const indexOf = (id: string) => data.fields.findIndex((f) => f.id === id);

  return (
    <>
      <Link
        href="/admin/participants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Participants
      </Link>
      <PageHeader title="Participant fields" actions={<FieldDialog />} />

      <Card className="mb-6 py-0">
        <CardContent className="px-0">
          <div className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Built in · always included
          </div>
          <ul className="divide-y">
            {BUILT_IN.map((f) => (
              <li key={f.label} className="flex items-center gap-3 px-4 py-2.5">
                <Lock className="size-4 text-muted-foreground/60" />
                <span className="text-sm font-medium">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.type}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-6 py-0">
        <CardContent className="px-0">
          <div className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Custom fields · {active.length}
          </div>
          {active.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No custom fields yet. Add one to start tracking extra information.
            </p>
          ) : (
            <ul className="divide-y">
              {active.map((field, i) => (
                <li
                  key={field.id}
                  draggable
                  onDragStart={(e) => {
                    setDragId(field.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", field.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragId && dragId !== field.id)
                      moveField(dragId, indexOf(field.id));
                  }}
                  onDragEnd={() => setDragId(undefined)}
                  className={cn(
                    "flex items-center gap-3 bg-card px-4 py-2.5",
                    dragId === field.id && "opacity-40",
                  )}
                >
                  <GripVertical className="size-4 cursor-grab text-muted-foreground active:cursor-grabbing" />
                  <FieldSummary field={field} />
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${field.label} up`}
                      disabled={i === 0}
                      onClick={() =>
                        moveField(field.id, indexOf(active[i - 1].id))
                      }
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${field.label} down`}
                      disabled={i === active.length - 1}
                      onClick={() =>
                        moveField(field.id, indexOf(active[i + 1].id))
                      }
                    >
                      <ChevronDown />
                    </Button>
                    <FieldDialog field={field} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Archive ${field.label}`}
                      title="Archive (hides the field, keeps its data)"
                      onClick={() => updateField(field.id, { archived: true })}
                    >
                      <Archive />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card className="py-0">
          <CardContent className="px-0">
            <div className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Archived · hidden everywhere, data kept
            </div>
            <ul className="divide-y">
              {archived.map((field) => {
                const count = countValues(data, field.id);
                return (
                  <li
                    key={field.id}
                    className="flex items-center gap-3 px-4 py-2.5 opacity-70"
                  >
                    <Archive className="size-4 text-muted-foreground" />
                    <FieldSummary field={field} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateField(field.id, { archived: false })}
                    >
                      <ArchiveRestore /> Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${field.label} permanently`}
                      onClick={() => {
                        const msg =
                          count > 0
                            ? `Delete "${field.label}" and the values saved for ${count} participants? This can't be undone.`
                            : `Delete "${field.label}"?`;
                        if (confirm(msg)) deleteField(field.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function FieldSummary({ field }: { field: FieldDefinition }) {
  const { data } = useCohort();
  const count = countValues(data, field.id);
  const total = data.enrollments.length;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{field.label}</span>
        {field.required && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            Required
          </span>
        )}
        {field.showInList && (
          <span
            className="text-muted-foreground"
            title="Shown as a column in the participant list"
          >
            <Table2 className="size-3.5" />
          </span>
        )}
        {field.visibleToParticipant && (
          <span
            className="text-muted-foreground"
            title="Participants can see this"
          >
            <Eye className="size-3.5" />
          </span>
        )}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {FIELD_TYPE_LABELS[field.type]}
        {field.options &&
          hasOptions(field.type) &&
          ` · ${field.options.join(", ")}`}
        {field.type !== "checkbox" && ` · filled for ${count} of ${total}`}
      </div>
    </div>
  );
}

/** Create a field, or edit one when `field` is given. */
function FieldDialog({ field }: { field?: FieldDefinition }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {field ? (
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${field.label}`}
            />
          }
        >
          <Pencil />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus />
          New field
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        {/* Mounted only while open, so the form starts fresh each time. */}
        {open && <FieldForm field={field} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FieldForm({
  field,
  onDone,
}: {
  field?: FieldDefinition;
  onDone: () => void;
}) {
  const { data, addField, updateField } = useCohort();
  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [options, setOptions] = useState<string[]>(field?.options ?? []);
  const [newOption, setNewOption] = useState("");
  const [required, setRequired] = useState(field?.required ?? false);
  const [showInList, setShowInList] = useState(field?.showInList ?? false);
  const [visibleToParticipant, setVisibleToParticipant] = useState(
    field?.visibleToParticipant ?? true,
  );
  const [error, setError] = useState("");

  // Changing the type would make existing values meaningless.
  const typeLocked = field ? countValues(data, field.id) > 0 : false;

  function addOption() {
    const o = newOption.trim();
    if (o && !options.some((x) => x.toLowerCase() === o.toLowerCase())) {
      setOptions([...options, o]);
    }
    setNewOption("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = label.trim();
    const taken = [
      ...BUILT_IN.map((b) => b.label),
      ...data.fields.filter((f) => f.id !== field?.id).map((f) => f.label),
    ];
    if (!name) return setError("Give the field a name.");
    if (taken.some((t) => t.toLowerCase() === name.toLowerCase())) {
      return setError(`There is already a field called "${name}".`);
    }
    if (hasOptions(type) && options.length === 0) {
      return setError("Add at least one option.");
    }
    const values = {
      label: name,
      type,
      options: hasOptions(type) ? options : undefined,
      required: type === "checkbox" ? false : required,
      showInList,
      visibleToParticipant,
    };
    if (field) updateField(field.id, values);
    else addField(values);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{field ? "Edit field" : "New field"}</DialogTitle>
        <DialogDescription>
          {field
            ? "Changes apply to every participant in this program."
            : "Added to every participant's profile in this program."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="field-label">Name</Label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Major, Pronouns, LinkedIn"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="field-type">Type</Label>
        <NativeSelect
          id="field-type"
          value={type}
          onChange={(e) => setType(e.target.value as FieldType)}
          disabled={typeLocked}
          className="w-full"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
        {typeLocked && (
          <p className="text-xs text-muted-foreground">
            The type can&apos;t change once participants have values for this
            field.
          </p>
        )}
      </div>

      {hasOptions(type) && (
        <div className="space-y-1.5">
          <Label htmlFor="field-option">Options</Label>
          {options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <span
                  key={o}
                  className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
                >
                  {o}
                  <button
                    type="button"
                    aria-label={`Remove ${o}`}
                    onClick={() => setOptions(options.filter((x) => x !== o))}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              id="field-option"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder="Type an option and press Enter"
            />
            <Button type="button" variant="outline" onClick={addOption}>
              Add
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {type !== "checkbox" && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={setRequired} />
            Required when adding a participant
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showInList} onCheckedChange={setShowInList} />
          Show as a column in the participant list
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={visibleToParticipant}
            onCheckedChange={setVisibleToParticipant}
          />
          Participants can see this on their profile
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="submit">{field ? "Save changes" : "Create field"}</Button>
      </DialogFooter>
    </form>
  );
}
