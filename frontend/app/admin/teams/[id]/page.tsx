"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TeamNotes } from "@/components/team-notes";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";
import { formatDate } from "@/lib/format";

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, teamStatuses, participantStatuses, toggleCompletion } = useCohort();
  const { teamById, projectById, personFor } = usePeopleIndex();

  const team = teamById.get(id);
  if (!team) return <p className="text-muted-foreground">Team not found.</p>;

  const status = teamStatuses.get(id)!;
  const project = team.projectId ? projectById.get(team.projectId) : undefined;
  const members = activeMembers(data, id);
  const changes = data.memberships
    .filter((m) => m.teamId === id && (m.startDate > data.cohort.startDate || m.endDate))
    .flatMap((m) => {
      const name = personFor(m.enrollmentId)?.name ?? "Unknown";
      const items = [];
      if (m.startDate > data.cohort.startDate) {
        items.push({ date: m.startDate, text: `${name} joined` });
      }
      if (m.endDate) {
        const withdrew =
          data.enrollments.find((e) => e.id === m.enrollmentId)?.leftAt === m.endDate;
        items.push({ date: m.endDate, text: `${name} ${withdrew ? "withdrew" : "left the team"}` });
      }
      return items;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

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
        description={project ? `${project.title} · ${project.partner}` : "No project assigned"}
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

          <Card>
            <CardHeader>
              <CardTitle>Team requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status.results.map((result) => {
                const req = data.requirements.find((r) => r.id === result.requirementId)!;
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{req.name}</div>
                      <div className="text-xs text-muted-foreground">{result.reason}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {req.type === "complete_by" && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={result.status === "met"}
                            onCheckedChange={() => toggleCompletion(req.id, id)}
                          />
                          Done
                        </label>
                      )}
                      <StatusBadge status={result.status} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <TeamNotes teamId={id} />

          <Card>
            <CardHeader>
              <CardTitle>Membership changes</CardTitle>
            </CardHeader>
            <CardContent>
              {changes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes since the cohort started.</p>
              ) : (
                <ol className="space-y-2 border-l pl-3">
                  {changes.map((c) => (
                    <li key={c.date + c.text} className="text-xs">
                      <div className="text-muted-foreground">{formatDate(c.date)}</div>
                      <div>{c.text}</div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed bg-transparent shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareText className="size-4" /> Weekly check-ins
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Coming next: the team&apos;s weekly progress check-ins and a timeline of
              this team&apos;s history.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
