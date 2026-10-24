"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, Upload } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FieldInput } from "@/components/field-input";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { ParticipantPanel } from "@/components/participant-panel";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { attendanceSummary, currentTeamId, worstStatus } from "@/lib/requirements";
import { participantOwner, staffName } from "@/lib/staff";
import { activeFields, formatFieldValue, validateFields } from "@/lib/fields";
import { useUrlParam } from "@/lib/url-param";
import { cn } from "@/lib/utils";
import type { FieldValue, Status } from "@/lib/types";

const FILTERS: { value: "all" | Status | "attention"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "missing", label: "Missing" },
  { value: "at_risk", label: "At risk" },
  { value: "on_track", label: "On track" },
];

export default function ParticipantsPage() {
  const { data, participantStatuses } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [openId, setOpenId] = useState<string>();
  const closePanel = useCallback(() => setOpenId(undefined), []);

  useUrlParam(
    "status",
    useCallback((value) => {
      const found = FILTERS.find((f) => f.value === value);
      if (found) setFilter(found.value);
    }, []),
  );
  // Filters for pick-one / pick-several columns, keyed by field id.
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({});

  const columns = useMemo(() => activeFields(data).filter((f) => f.showInList), [data]);
  const filterable = useMemo(
    () => columns.filter((f) => f.type === "select" || f.type === "multi_select"),
    [columns],
  );

  const rows = useMemo(() => {
    return data.enrollments
      .filter((e) => e.status === "active")
      .map((e) => {
        const person = personFor(e.id)!;
        const teamId = currentTeamId(data, e.id);
        const status = participantStatuses.get(e.id);
        return { enrollment: e, person, teamId, status };
      })
      .filter(({ enrollment, person, teamId, status }) => {
        const q = query.trim().toLowerCase();
        if (q && !person.name.toLowerCase().includes(q) && !person.email.toLowerCase().includes(q)) {
          return false;
        }
        if (teamFilter !== "all" && teamId !== teamFilter) return false;
        // Only filter on fields still shown, so hiding a column clears its filter.
        for (const f of filterable) {
          const wanted = fieldFilters[f.id];
          if (!wanted) continue;
          const v = enrollment.fields?.[f.id];
          if (Array.isArray(v) ? !v.includes(wanted) : v !== wanted) return false;
        }
        if (filter === "all") return true;
        const s = status?.status;
        if (filter === "attention") return s === "missing" || s === "at_risk";
        if (filter === "on_track") return s === "on_track" || s === "met";
        return s === filter;
      })
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [
    data,
    personFor,
    participantStatuses,
    query,
    filter,
    teamFilter,
    filterable,
    fieldFilters,
  ]);

  // Attendance requirements share one column; anything else keeps its own.
  const attendanceIds = new Set(data.requirements.filter((r) => r.type === "attendance_min").map((r) => r.id));
  const participantReqs = data.requirements.filter((r) => r.scope === "participant" && !attendanceIds.has(r.id));

  // With a profile open there's only room for the columns that identify someone.
  const narrow = openId ? "xl:max-[110rem]:hidden" : undefined;
  const narrowField = (id: string) => (id !== "field-role" ? narrow : openId ? "xl:max-[90rem]:hidden" : undefined);

  return (
    // Centered in the page. On wide screens it slides left when a profile opens,
    // into the space beside the panel (40rem wide).
    <div
      className={cn(
        "ml-[max(0px,calc((100%-72rem)/2))] max-w-6xl transition-[margin,max-width] duration-200 ease-out motion-reduce:transition-none",
        openId && "xl:ml-0 xl:max-w-[calc(100%-41.5rem)]",
      )}
    >
      <PageHeader
        title="Participants"
        description={`${data.enrollments.filter((e) => e.status === "active").length} active in ${data.cohort.name}`}
        actions={
          <>
            <Link
              href="/admin/participants/fields"
              className={buttonVariants({ variant: "outline" })}
            >
              <SlidersHorizontal />
              Manage fields
            </Link>
            <Link href="/admin/import" className={buttonVariants({ variant: "outline" })}>
              <Upload />
              Import spreadsheet
            </Link>
            <AddParticipantDialog />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="w-64 pl-8"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filter === f.value
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <NativeSelect value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          <option value="all">All teams</option>
          {data.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        {filterable.map((f) => (
          <NativeSelect
            key={f.id}
            value={fieldFilters[f.id] ?? ""}
            onChange={(e) => setFieldFilters({ ...fieldFilters, [f.id]: e.target.value })}
          >
            <option value="">Any {f.label.toLowerCase()}</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className={narrow}>Assigned to</TableHead>
              {columns.map((f) => (
                <TableHead key={f.id} className={narrowField(f.id)}>
                  {f.label}
                </TableHead>
              ))}
              <TableHead className={narrow}>Attendance</TableHead>
              {participantReqs.map((r) => (
                <TableHead key={r.id} className={narrow}>
                  {r.name}
                </TableHead>
              ))}
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ enrollment, person, teamId, status }) => (
              <TableRow
                key={enrollment.id}
                onClick={() => setOpenId(enrollment.id)}
                data-state={openId === enrollment.id ? "selected" : undefined}
                className="cursor-pointer"
              >
                <TableCell className="pl-4">
                  <button type="button" className="text-left font-medium hover:underline">
                    {person.name}
                  </button>
                  <div className="text-xs text-muted-foreground">{person.email}</div>
                </TableCell>
                <TableCell>
                  {teamId ? (
                    <Link
                      href={`/admin/teams/${teamId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:underline"
                    >
                      {teamById.get(teamId)?.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={narrow}>{staffName(data, participantOwner(data, enrollment.id))}</TableCell>
                {columns.map((f) => (
                  <TableCell key={f.id} className={cn("max-w-48 truncate", narrowField(f.id))}>
                    {formatFieldValue(f, enrollment.fields?.[f.id])}
                  </TableCell>
                ))}
                <TableCell className={narrow}>
                  <AttendanceCell
                    {...attendanceSummary(data, enrollment.id)}
                    status={worstStatus(
                      (status?.results ?? []).filter((r) => attendanceIds.has(r.requirementId)).map((r) => r.status),
                    )}
                  />
                </TableCell>
                {participantReqs.map((r) => {
                  const result = status?.results.find((x) => x.requirementId === r.id);
                  return (
                    <TableCell key={r.id} className={narrow}>
                      {result ? <StatusBadge status={result.status} /> : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="pr-4">
                  {status && <StatusBadge status={status.status} overall />}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5 + columns.length + participantReqs.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  No participants match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {openId && <ParticipantPanel enrollmentId={openId} onClose={closePanel} />}
    </div>
  );
}

/** Events attended so far, with a dot when it's putting a requirement at risk. */
function AttendanceCell({ attended, total, status }: { attended: number; total: number; status: Status }) {
  const flagged = status === "at_risk" || status === "missing";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="tabular-nums">
        {attended}/{total}
      </span>
      {flagged && <StatusBadge status={status} />}
    </span>
  );
}

function AddParticipantDialog() {
  const { data, addParticipants } = useCohort();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState("");
  const fields = activeFields(data);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a name and a valid email.");
      return;
    }
    const fieldError = validateFields(fields, values);
    if (fieldError) {
      setError(fieldError);
      return;
    }
    let added: number;
    try {
      added = await addParticipants([{ name: name.trim(), email: email.trim(), fields: values }]);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (added === 0) {
      setError("This person is already in the cohort.");
      return;
    }
    setOpen(false);
    setName("");
    setEmail("");
    setValues({});
    setError("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add participant
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={`add-${f.id}`}>
                {f.label}
                {!f.required && (
                  <span className="font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              <FieldInput
                id={`add-${f.id}`}
                field={f}
                value={values[f.id]}
                onChange={(v) => setValues({ ...values, [f.id]: v })}
              />
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
