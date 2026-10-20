"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TeamNotes } from "@/components/team-notes";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";
import { partnerOfTeam } from "@/lib/partners";

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, teamStatuses, participantStatuses } = useCohort();
  const { teamById, projectById, personFor } = usePeopleIndex();

  const team = teamById.get(id);
  if (!team) return <p className="text-muted-foreground">Team not found.</p>;

  const status = teamStatuses.get(id)!;
  const project = team.projectId ? projectById.get(team.projectId) : undefined;
  const partner = partnerOfTeam(data, team);
  const members = activeMembers(data, id);

  return (
    <>
      <Link
        href="/admin/teams"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Teams
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Team {team.name}
            <StatusBadge status={status.status} overall />
          </span>
        }
        description={
          project ? (
            <>
              {project.title}
              {partner && (
                <>
                  {" · "}
                  <Link href={`/admin/partners/${partner.id}`} className="hover:text-foreground hover:underline">
                    {partner.name}
                  </Link>
                </>
              )}
            </>
          ) : (
            "No project assigned"
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Members ({members.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {members.map((m) => {
                  const person = personFor(m.id)!;
                  const s = participantStatuses.get(m.id);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/admin/participants/${m.id}`}
                        className="flex items-start justify-between gap-4 px-4 py-2.5 hover:bg-muted/50"
                      >
                        <div>
                          <div className="text-sm font-medium">{person.name}</div>
                          {s?.flags.map((flag) => (
                            <div key={flag} className="text-xs text-muted-foreground">
                              {flag}
                            </div>
                          ))}
                        </div>
                        {s && <StatusBadge status={s.status} overall />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <LinkedRecords target="team" id={id} />
        </div>

        <div className="space-y-6">
          <TrackedNumbers on="team" id={id} />

          <TeamNotes teamId={id} />
        </div>
      </div>
    </>
  );
}
