"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { useCohort } from "@/lib/store";
import { EVENT_CATEGORY_LABELS } from "@/lib/events";
import {
  EVENT_CATEGORIES,
  type Condition,
  type EventCategory,
  type RequirementType,
} from "@/lib/types";
import { DescriptionField, RecordFilterFields } from "./requirement-fields";

const TYPE_OPTIONS: { value: RequirementType; label: string; hint: string }[] =
  [
    {
      value: "attendance_min",
      label: "Attend a minimum number of events",
      hint: 'e.g. "attend at least 3 workshops"',
    },
    {
      value: "complete_by",
      label: "Complete something by a date",
      hint: 'e.g. "project brief by Week 4" or "final report by Dec 11"',
    },
    {
      value: "team_min_size",
      label: "Team keeps a minimum size",
      hint: 'e.g. "every team has at least 3 active members"',
    },
    {
      value: "record_by",
      label: "Log records by a date",
      hint: 'e.g. "one meeting report per team by Oct 31". Logging the record meets it, with no box to tick.',
    },
  ];

export function NewRequirementDialog() {
  const { data, addRequirement } = useCohort();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RequirementType>("attendance_min");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EventCategory>("workshop");
  const [minCount, setMinCount] = useState(3);
  const [scope, setScope] = useState<"participant" | "team">("participant");
  const [dueDate, setDueDate] = useState(data.today);
  const [minActive, setMinActive] = useState(3);
  const [recordTypeId, setRecordTypeId] = useState("");
  const [minRecords, setMinRecords] = useState(1);
  const [filter, setFilter] = useState<Condition>();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();

  // Only record types that link to what the requirement applies to can count.
  const recordTypes = data.recordTypes.filter((t) =>
    t.fields.some((f) => f.type === "link" && f.linkTo === scope),
  );
  const recordType =
    recordTypes.find((t) => t.id === recordTypeId) ?? recordTypes[0];

  const categoryTotal = data.events.filter(
    (e) => e.category === category,
  ).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === "attendance_min") {
      addRequirement({
        name: name.trim(),
        scope: "participant",
        type,
        params: { category, minCount },
      });
    } else if (type === "complete_by") {
      addRequirement({
        name: name.trim(),
        scope,
        type,
        params: {
          dueDate,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      });
    } else if (type === "record_by") {
      const via = recordType?.fields.find(
        (f) => f.type === "link" && f.linkTo === scope,
      );
      if (!recordType || !via)
        return setError(`No record type links to each ${scope} yet.`);
      addRequirement({
        name: name.trim(),
        scope,
        type,
        params: {
          typeId: recordType.id,
          viaFieldId: via.id,
          minCount: minRecords,
          dueDate,
          dateFieldId: recordType.fields.find((f) => f.type === "date")?.id,
          ...(filter ? { filter } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      });
    } else {
      addRequirement({
        name: name.trim(),
        scope: "team",
        type,
        params: { minActive },
      });
    }
    setOpen(false);
    setName("");
    setError(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New requirement
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New requirement</DialogTitle>
            <DialogDescription>
              {TYPE_OPTIONS.find((t) => t.value === type)?.hint}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <NativeSelect
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as RequirementType)}
              className="w-full"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-name">Name</Label>
            <Input
              id="req-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shown on the dashboard"
            />
          </div>

          {type === "attendance_min" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat">Event category</Label>
                <NativeSelect
                  id="cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full"
                >
                  {EVENT_CATEGORIES.filter((c) => c !== "deadline").map((c) => (
                    <option key={c} value={c}>
                      {EVENT_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min">At least</Label>
                <Input
                  id="min"
                  type="number"
                  min={1}
                  value={minCount}
                  onChange={(e) => setMinCount(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  of {categoryTotal} {category} events scheduled
                </p>
              </div>
            </div>
          )}

          {(type === "complete_by" || type === "record_by") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scope">Applies to</Label>
                <NativeSelect
                  id="scope"
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as "participant" | "team");
                    setFilter(undefined);
                  }}
                  className="w-full"
                >
                  <option value="participant">Each participant</option>
                  <option value="team">Each team</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Due date</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {type === "record_by" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="record-type">Records</Label>
                <NativeSelect
                  id="record-type"
                  value={recordType?.id ?? ""}
                  onChange={(e) => {
                    setRecordTypeId(e.target.value);
                    setFilter(undefined);
                  }}
                  className="w-full"
                >
                  {recordTypes.length === 0 && (
                    <option value="">None link here</option>
                  )}
                  {recordTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min-records">At least</Label>
                <Input
                  id="min-records"
                  type="number"
                  min={1}
                  value={minRecords}
                  onChange={(e) => setMinRecords(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {type === "record_by" && (
            <RecordFilterFields
              data={data}
              typeId={recordType?.id}
              filter={filter}
              onChange={setFilter}
            />
          )}

          {(type === "complete_by" || type === "record_by") && (
            <DescriptionField value={description} onChange={setDescription} />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {type === "team_min_size" && (
            <div className="space-y-1.5">
              <Label htmlFor="min-active">Minimum active members</Label>
              <Input
                id="min-active"
                type="number"
                min={1}
                value={minActive}
                onChange={(e) => setMinActive(Number(e.target.value))}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit">Create requirement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
