"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notes } from "@/components/notes";
import { OwnerSelect } from "@/components/owner-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatusCard } from "@/components/status-card";
import { Timeline } from "@/components/timeline";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { formatEventTime, takesAttendance } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";
import { partnerOfTeam } from "@/lib/partners";
import { teamTimeline } from "@/lib/timeline";

export default function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, teamStatuses, participantStatuses, setTeamOwner } = useCohort();
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
        actions={
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Assigned to
            <OwnerSelect
              value={team.ownerId}
              onChange={(ownerId) => setTeamOwner(id, ownerId)}
            />
          </label>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* The project and the people on it, side by side. */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card size="sm" className="gap-2 px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-semibold">
                  {project?.title ?? "No project assigned"}
                </h2>
                {partner && (
                  <Link
                    href={`/admin/partners/${partner.id}`}
                    className="text-sm hover:underline"
                  >
                    {partner.name}
                  </Link>
                )}
              </div>
              {project?.description && (
                <p className="text-sm leading-relaxed">{project.description}</p>
              )}
            </Card>
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
                            <div className="text-sm font-medium">
                              {person.name}
                            </div>
                            {s?.flags.map((flag) => (
                              <div
                                key={flag}
                                className="text-xs text-muted-foreground"
                              >
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
          </div>

          <StatusCard subjectId={id} status={status} />

          <LinkedRecords target="team" id={id} />
        </div>

        <div className="space-y-6">
          <TrackedNumbers on="team" id={id} />

          <TeamEvents teamId={id} />

          <Notes subjectType="team" subjectId={id} />

          <Timeline entries={teamTimeline(data, id)} />
        </div>
      </div>
    </>
  );
}

const RECENT = 4;
const UPCOMING = 3;

/** What's coming up for this team, and how many of its members made it to recent events. */
function TeamEvents({ teamId }: { teamId: string }) {
  const { data } = useCohort();
  const members = new Set(activeMembers(data, teamId).map((m) => m.id));
  const events = data.events.filter(takesAttendance);
  const upcoming = events
    .filter((e) => e.date >= data.today)
    .slice(0, UPCOMING);
  const recent = events
    .filter((e) => e.date < data.today)
    .slice(-RECENT)
    .reverse();
  const present = (eventId: string) =>
    data.attendance.filter(
      (a) => a.eventId === eventId && members.has(a.enrollmentId),
    ).length;
  const groups = [
    { title: "Coming up", events: upcoming, past: false },
    { title: "Recent attendance", events: recent, past: true },
  ].filter((g) => g.events.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        )}
        {groups.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-xs text-muted-foreground">
              {group.title}
            </h3>
            <ul className="space-y-2">
              {group.events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="group min-w-0"
                  >
                    <div className="truncate font-medium group-hover:underline">
                      {e.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(e.date, { weekday: true })}
                      {!group.past && ` · ${formatEventTime(e)}`}
                    </div>
                  </Link>
                  {group.past && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {present(e.id)}/{members.size}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
