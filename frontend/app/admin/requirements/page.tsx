"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { describeRequirement } from "@/lib/requirements";
import { EVENT_CATEGORY_LABELS } from "@/lib/events";
import {
  EVENT_CATEGORIES,
  type EventCategory,
  type Requirement,
  type RequirementType,
  type Status,
} from "@/lib/types";

const COUNT_STYLES: {
  status: Status[];
  label: string;
  className: string;
  bar: string;
}[] = [
  {
    status: ["met", "on_track"],
    label: "on track",
    className: "text-primary",
    bar: "bg-primary",
  },
  {
    status: ["at_risk"],
    label: "at risk",
    className: "text-amber-700 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  {
    status: ["missing"],
    label: "missing",
    className: "text-red-700 dark:text-red-400",
    bar: "bg-red-500",
  },
];

export default function RequirementsPage() {
  const { data, participantStatuses, teamStatuses, deleteRequirement } =
    useCohort();

  function counts(req: Requirement) {
    const source =
      req.scope === "participant" ? participantStatuses : teamStatuses;
    const statuses: Status[] = [];
    for (const s of source.values()) {
      const r = s.results.find((x) => x.requirementId === req.id);
      if (r) statuses.push(r.status);
    }
    return statuses;
  }

  return (
    <>
      <PageHeader
        title="Requirements"
        description="Define the rules once. Status is calculated automatically from attendance, completions and logged records."
        actions={<NewRequirementDialog />}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {data.requirements.map((req) => {
          const statuses = counts(req);
          return (
            <Card key={req.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/admin/requirements/${req.id}`}
                      className="font-semibold hover:underline"
                    >
                      {req.name}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {describeRequirement(req, data)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground capitalize">
                      {req.scope}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${req.name}`}
                      onClick={() => {
                        if (confirm(`Delete "${req.name}"?`))
                          deleteRequirement(req.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {COUNT_STYLES.map(({ status, bar }) => {
                    const n = statuses.filter((s) => status.includes(s)).length;
                    return (
                      <div
                        key={status.join()}
                        className={bar}
                        style={{
                          width: `${(n / Math.max(statuses.length, 1)) * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-4 text-xs">
                  {COUNT_STYLES.map(({ status, label, className }) => (
                    <span key={label} className={className}>
                      <span className="font-semibold tabular-nums">
                        {statuses.filter((s) => status.includes(s)).length}
                      </span>{" "}
                      {label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

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

function NewRequirementDialog() {
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
      addRequirement({ name: name.trim(), scope, type, params: { dueDate } });
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
                  {EVENT_CATEGORIES.map((c) => (
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
                  onChange={(e) =>
                    setScope(e.target.value as "participant" | "team")
                  }
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
                  onChange={(e) => setRecordTypeId(e.target.value)}
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
