"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, Users, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId, needsAttention } from "@/lib/requirements";
import { cohortWeek, formatDate } from "@/lib/format";
import type { Status } from "@/lib/types";

const SEVERITY: Record<Status, number> = { missing: 0, at_risk: 1, on_track: 2, met: 3 };

export default function DashboardPage() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const { personFor, teamById } = usePeopleIndex();

  const active = data.enrollments.filter((e) => e.status === "active");
  const flaggedPeople = active
    .map((e) => ({ enrollment: e, status: participantStatuses.get(e.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);
  const flaggedTeams = data.teams
    .map((team) => ({ team, status: teamStatuses.get(team.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);

  const missingCount = flaggedPeople.filter((p) => p.status.status === "missing").length;
  const atRiskCount = flaggedPeople.length - missingCount;

  const pastEvents = data.events.filter((e) => e.date < data.today);
  const upcoming = data.events.filter((e) => e.date >= data.today).slice(0, 3);
  const lastRequired = [...pastEvents].reverse().find((e) => e.isRequired);
  const attendanceRate = (eventId: string) => {
    const count = data.attendance.filter(
      (a) => a.eventId === eventId && active.some((e) => e.id === a.enrollmentId),
    ).length;
    return { count, pct: Math.round((count / active.length) * 100) };
  };
  const lastRate = lastRequired ? attendanceRate(lastRequired.id) : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Week ${cohortWeek(data.cohort.startDate, data.today)} · ${formatDate(data.today, { weekday: true })} · ${data.program.name}, ${data.cohort.name}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Active participants"
          value={active.length}
          sub={`${data.enrollments.length - active.length} withdrawn`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Participants needing attention"
          value={flaggedPeople.length}
          sub={`${missingCount} missing · ${atRiskCount} at risk`}
          tone={flaggedPeople.length ? "warn" : undefined}
        />
        <StatCard
          icon={UsersRound}
          label="Teams needing attention"
          value={flaggedTeams.length}
          sub={`of ${data.teams.length} teams`}
          tone={flaggedTeams.length ? "warn" : undefined}
        />
        <StatCard
          icon={CalendarDays}
          label="Last required event"
          value={lastRate ? `${lastRate.pct}%` : "—"}
          sub={lastRequired ? `${lastRequired.title} attendance` : "No events yet"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Participants needing attention</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {flaggedPeople.length === 0 ? (
              <Empty text="Everyone is on track." />
            ) : (
              <ul className="divide-y">
                {flaggedPeople.map(({ enrollment, status }) => {
                  const person = personFor(enrollment.id)!;
                  const teamId = currentTeamId(data, enrollment.id);
                  return (
                    <li key={enrollment.id}>
                      <Link
                        href={`/admin/participants/${enrollment.id}`}
                        className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{person.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {teamId ? `Team ${teamById.get(teamId)?.name}` : "No team"}
                          </div>
                          <ul className="mt-1 space-y-0.5">
                            {status.flags.map((flag) => (
                              <li key={flag} className="text-xs text-foreground/80">
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <StatusBadge status={status.status} overall />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Teams needing attention</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {flaggedTeams.length === 0 ? (
                <Empty text="All teams are on track." />
              ) : (
                <ul className="divide-y">
                  {flaggedTeams.map(({ team, status }) => (
                    <li key={team.id}>
                      <Link
                        href={`/admin/teams/${team.id}`}
                        className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                      >
                        <div>
                          <div className="text-sm font-medium">Team {team.name}</div>
                          <ul className="mt-1 space-y-0.5">
                            {status.flags.map((flag) => (
                              <li key={flag} className="text-xs text-foreground/80">
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <StatusBadge status={status.status} overall />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance at past events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pastEvents.map((event) => {
                const { count, pct } = attendanceRate(event.id);
                return (
                  <Link key={event.id} href={`/admin/events/${event.id}`} className="block">
                    <div className="flex justify-between text-xs">
                      <span className="truncate pr-2">
                        {event.title}
                        {!event.isRequired && (
                          <span className="text-muted-foreground"> · optional</span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {count}/{active.length}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${event.isRequired ? "bg-primary" : "bg-muted-foreground/40"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coming up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center justify-between text-sm hover:underline"
                >
                  <span>{event.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(event.date, { weekday: true })}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub: string;
  tone?: "warn";
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {label}
          <Icon className={`size-4 ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`} />
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}
