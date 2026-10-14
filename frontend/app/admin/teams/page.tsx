"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";
import { initials } from "@/lib/format";

export default function TeamsPage() {
  const { data, teamStatuses, participantStatuses } = useCohort();
  const { personFor, projectById } = usePeopleIndex();

  return (
    <>
      <PageHeader title="Teams" description={`${data.teams.length} teams in ${data.cohort.name}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.teams.map((team) => {
          const status = teamStatuses.get(team.id)!;
          const members = activeMembers(data, team.id);
          const project = team.projectId ? projectById.get(team.projectId) : undefined;
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
                  {project?.partner && (
                    <div className="text-xs text-muted-foreground">
                      Partner: {project.partner}
                    </div>
                  )}
                  <div className="flex -space-x-1.5">
                    {members.map((m) => {
                      const s = participantStatuses.get(m.id)?.status;
                      const ring =
                        s === "missing"
                          ? "ring-red-400"
                          : s === "at_risk"
                            ? "ring-amber-400"
                            : "ring-background";
                      return (
                        <div
                          key={m.id}
                          title={personFor(m.id)?.name}
                          className={`flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ${ring}`}
                        >
                          {initials(personFor(m.id)?.name ?? "?")}
                        </div>
                      );
                    })}
                  </div>
                  {status.flags.length > 0 && (
                    <ul className="mt-auto space-y-0.5 border-t pt-2">
                      {status.flags.map((flag) => (
                        <li key={flag} className="text-xs text-foreground/80">
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
