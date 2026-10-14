"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Upload } from "lucide-react";
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
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId } from "@/lib/requirements";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const FILTERS: { value: "all" | Status | "attention"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "missing", label: "Missing" },
  { value: "at_risk", label: "At risk" },
  { value: "on_track", label: "On track" },
];

export default function ParticipantsPage() {
  const router = useRouter();
  const { data, participantStatuses } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  const rows = useMemo(() => {
    return data.enrollments
      .filter((e) => showWithdrawn || e.status === "active")
      .map((e) => {
        const person = personFor(e.id)!;
        const teamId = currentTeamId(data, e.id);
        const status = participantStatuses.get(e.id);
        return { enrollment: e, person, teamId, status };
      })
      .filter(({ person, teamId, status }) => {
        const q = query.trim().toLowerCase();
        if (q && !person.name.toLowerCase().includes(q) && !person.email.includes(q)) {
          return false;
        }
        if (teamFilter !== "all" && teamId !== teamFilter) return false;
        if (filter === "all") return true;
        const s = status?.status;
        if (filter === "attention") return s === "missing" || s === "at_risk";
        if (filter === "on_track") return s === "on_track" || s === "met";
        return s === filter;
      })
      .sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [data, personFor, participantStatuses, query, filter, teamFilter, showWithdrawn]);

  const participantReqs = data.requirements.filter((r) => r.scope === "participant");

  return (
    <>
      <PageHeader
        title="Participants"
        description={`${data.enrollments.filter((e) => e.status === "active").length} active in ${data.cohort.name}`}
        actions={
          <>
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
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showWithdrawn}
            onChange={(e) => setShowWithdrawn(e.target.checked)}
          />
          Show withdrawn
        </label>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Team</TableHead>
              {participantReqs.map((r) => (
                <TableHead key={r.id}>{r.name}</TableHead>
              ))}
              <TableHead className="pr-4">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ enrollment, person, teamId, status }) => (
              <TableRow
                key={enrollment.id}
                onClick={() => router.push(`/admin/participants/${enrollment.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="pl-4">
                  <div className="font-medium">{person.name}</div>
                  <div className="text-xs text-muted-foreground">{person.email}</div>
                </TableCell>
                <TableCell>{teamId ? teamById.get(teamId)?.name : "—"}</TableCell>
                {participantReqs.map((r) => {
                  const result = status?.results.find((x) => x.requirementId === r.id);
                  return (
                    <TableCell key={r.id}>
                      {result ? <StatusBadge status={result.status} /> : "—"}
                    </TableCell>
                  );
                })}
                <TableCell className="pr-4">
                  {enrollment.status === "withdrawn" ? (
                    <span className="text-xs text-muted-foreground">Withdrawn</span>
                  ) : (
                    status && <StatusBadge status={status.status} overall />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3 + participantReqs.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  No participants match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function AddParticipantDialog() {
  const { data, addParticipants } = useCohort();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a name and a valid email.");
      return;
    }
    const added = addParticipants([{ name: name.trim(), email: email.trim(), team }]);
    if (added === 0) {
      setError("This person is already in the cohort.");
      return;
    }
    setOpen(false);
    setName("");
    setEmail("");
    setTeam("");
    setError("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        Add participant
      </DialogTrigger>
      <DialogContent>
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
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team">Team</Label>
            <NativeSelect
              id="team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full"
            >
              <option value="">No team yet</option>
              {data.teams.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
