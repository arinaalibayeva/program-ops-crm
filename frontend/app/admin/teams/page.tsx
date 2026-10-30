"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";
import { initials } from "@/lib/format";
import { staffName, UNASSIGNED } from "@/lib/staff";
import { useUrlParam } from "@/lib/url-param";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const FILTERS: { value: "all" | Status; label: string }[] = [
  { value: "all", label: "All" },
  { value: "missing", label: "Missing" },
  { value: "at_risk", label: "At risk" },
  { value: "on_track", label: "On track" },
];

export default function TeamsPage() {
  const { data, teamStatuses, participantStatuses } = useCohort();
  const { personFor, projectById, partnerById } = usePeopleIndex();
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]["value"]>("all");
  const [owner, setOwner] = useState("all");

  useUrlParam(
    "status",
    useCallback((value) => {
      const found = FILTERS.find((f) => f.value === value);
      if (found) setFilter(found.value);
    }, []),
  );
  useUrlParam("owner", setOwner);

  const shown = data.teams.filter((team) => {
    if (
      owner === "none"
        ? team.ownerId
        : owner !== "all" && team.ownerId !== owner
    )
      return false;
    const s = teamStatuses.get(team.id)?.status;
    if (filter === "all") return true;
    return filter === "on_track"
      ? s === "on_track" || s === "met"
      : s === filter;
  });

  return (
    <>
      <PageHeader title="Teams" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
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
        <NativeSelect
          aria-label="Assigned to"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="all">Anyone</option>
          <option value="none">{UNASSIGNED}</option>
          {data.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {shown.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No teams match these filters.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((team) => {
          const status = teamStatuses.get(team.id)!;
          const members = activeMembers(data, team.id);
          const project = team.projectId
            ? projectById.get(team.projectId)
            : undefined;
          return (
            <Link key={team.id} href={`/admin/teams/${team.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">Team {team.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {project ? project.title : "No project assigned"}
                      </div>
                    </div>
                    <StatusBadge status={status.status} overall />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {project?.partnerId &&
                      `${partnerById.get(project.partnerId)?.name} · `}
                    {staffName(data, team.ownerId)}
                  </div>
                  <div className="flex -space-x-1.5">
                    {members.map((m) => {
                      const s = participantStatuses.get(m.id)?.status;
                      const ring =
                        s === "missing"
                          ? "ring-ocean-900"
                          : s === "at_risk"
                            ? "ring-ocean-500"
                            : "ring-background";
                      return (
                        <div
                          key={m.id}
                          title={personFor(m.id)?.name}
                          className={`flex size-7 items-center justify-center rounded-full bg-ocean-100 text-[10px] font-medium text-ocean-800 ring-2 ${ring}`}
                        >
                          {initials(personFor(m.id)?.name ?? "?")}
                        </div>
                      );
                    })}
                  </div>
                  {status.flags.length > 0 && (
                    <ul className="mt-auto space-y-0.5 border-t pt-2">
                      {status.flags.map((flag) => (
                        <li key={flag} className="text-xs text-foreground">
                          {flag}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
