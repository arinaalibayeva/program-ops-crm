"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { EVENT_CATEGORY_LABELS } from "@/lib/events";
import { useCohort } from "@/lib/store";
import {
  EVENT_CATEGORIES,
  type Condition,
  type Requirement,
} from "@/lib/types";
import {
  DescriptionField,
  NumberField,
  RecordFilterFields,
} from "./requirement-fields";

/** Changes a rule's name and settings. Its kind and who it applies to stay the same. */
export function EditRequirementDialog({
  req,
  open,
  onOpenChange,
}: {
  req: Requirement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounts each time it opens, so it starts from the saved rule. */}
        {open && <EditForm req={req} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ req, onDone }: { req: Requirement; onDone: () => void }) {
  const { data, updateRequirement } = useCohort();
  const [name, setName] = useState(req.name);
  const [params, setParams] = useState(req.params as Record<string, unknown>);
  const [error, setError] = useState<string>();
  const set = (patch: Record<string, unknown>) =>
    setParams((p) => ({ ...p, ...patch }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter a name.");
    const cleaned = { ...params };
    if (cleaned.description === "") delete cleaned.description;
    if (cleaned.filter === undefined) delete cleaned.filter;
    updateRequirement({
      ...req,
      name: name.trim(),
      params: cleaned,
    } as Requirement);
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Edit requirement</DialogTitle>
        <DialogDescription>
          Statuses update as soon as you save.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="edit-req-name">Name</Label>
        <Input
          id="edit-req-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {req.type === "attendance_min" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-cat">Event category</Label>
            <NativeSelect
              id="edit-cat"
              value={String(params.category)}
              onChange={(e) => set({ category: e.target.value })}
              className="w-full"
            >
              {EVENT_CATEGORIES.filter((c) => c !== "deadline").map((c) => (
                <option key={c} value={c}>
                  {EVENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <NumberField
            id="edit-min"
            label="At least"
            value={Number(params.minCount)}
            onChange={(v) => set({ minCount: v })}
          />
        </div>
      )}

      {req.type === "team_min_size" && (
        <NumberField
          id="edit-min-active"
          label="Minimum active members"
          value={Number(params.minActive)}
          onChange={(v) => set({ minActive: v })}
        />
      )}

      {(req.type === "complete_by" || req.type === "record_by") && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-due">Due date</Label>
              <Input
                id="edit-due"
                type="date"
                value={String(params.dueDate)}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </div>
            {req.type === "record_by" && (
              <NumberField
                id="edit-min-records"
                label="At least"
                value={Number(params.minCount)}
                onChange={(v) => set({ minCount: v })}
              />
            )}
          </div>
          {req.type === "record_by" && (
            <RecordFilterFields
              data={data}
              typeId={req.params.typeId}
              filter={params.filter as Condition | undefined}
              onChange={(filter) => set({ filter })}
            />
          )}
          <DescriptionField
            value={String(params.description ?? "")}
            onChange={(v) => set({ description: v })}
          />
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
