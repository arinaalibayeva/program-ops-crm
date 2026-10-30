"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { validateRecord } from "@/lib/records";
import { useCohort } from "@/lib/store";
import type { CustomRecord, FieldValue, RecordType } from "@/lib/types";
import { RecordInput } from "./record-input";

/**
 * Creates a record, or edits one when `record` is given. `preset` fills in
 * values for a new record, such as the team it's being added from.
 */
export function RecordDialog({
  type,
  record,
  preset,
  open,
  onOpenChange,
  onSaved,
}: {
  type: RecordType;
  record?: CustomRecord;
  preset?: Record<string, FieldValue>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {/* Mounted only while open, so each opening starts fresh. */}
        <RecordForm
          type={type}
          record={record}
          preset={preset}
          onDone={(id) => {
            onOpenChange(false);
            if (id) onSaved?.(id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function RecordForm({
  type,
  record,
  preset,
  onDone,
}: {
  type: RecordType;
  record?: CustomRecord;
  preset?: Record<string, FieldValue>;
  onDone: (id?: string) => void;
}) {
  const { addRecord, updateRecord } = useCohort();
  const [values, setValues] = useState<Record<string, FieldValue>>(record?.values ?? preset ?? {});
  const [error, setError] = useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateRecord(type, values);
    if (problem) return setError(problem);
    if (record) {
      updateRecord(record.id, values);
      onDone(record.id);
    } else {
      onDone(addRecord(type.id, values));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{record ? `Edit ${type.singular.toLowerCase()}` : `New ${type.singular.toLowerCase()}`}</DialogTitle>
      </DialogHeader>
      {type.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">This type has no fields yet. Add some in Customize.</p>
      )}
      {type.fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          <Label htmlFor={`rec-${f.id}`}>
            {f.label}
          </Label>
          <RecordInput
            id={`rec-${f.id}`}
            field={f}
            value={values[f.id]}
            onChange={(v) => setValues({ ...values, [f.id]: v })}
          />
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit">{record ? "Save" : `Add ${type.singular.toLowerCase()}`}</Button>
      </DialogFooter>
    </form>
  );
}
