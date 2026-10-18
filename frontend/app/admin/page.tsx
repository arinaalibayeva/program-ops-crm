"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId, needsAttention } from "@/lib/requirements";
import { EVENT_CATEGORY_LABELS, formatEventTime } from "@/lib/events";
import { cohortWeek, formatDate } from "@/lib/format";
import type { ProgramEvent, Status } from "@/lib/types";

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

  const pastEvents = data.events.filter((e) => e.date < data.today);
  const upcoming = data.events.filter((e) => e.date >= data.today).slice(0, 4);
  const next = upcoming[0];
  const attendanceRate = (eventId: string) => {
    const count = data.attendance.filter(
      (a) => a.eventId === eventId && active.some((e) => e.id === a.enrollmentId),
    ).length;
    return { count, pct: Math.round((count / active.length) * 100) };
  };

  return (
    <>
      <PageHeader
        title="Today"
        description={`Week ${cohortWeek(data.cohort.startDate, data.today)} · ${formatDate(data.today, { weekday: true })} · ${data.program.name}, ${data.cohort.name}`}
      />

      {next && <NextEvent event={next} later={upcoming.slice(1)} />}

      <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-3">
        <Section title="People to follow up with" count={flaggedPeople.length}>
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
                      className="-mx-2 flex items-start justify-between gap-4 rounded-md px-2 py-3 hover:bg-muted/60"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {person.name}
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {teamId ? `Team ${teamById.get(teamId)?.name}` : "No team"}
                          </span>
                        </div>
                        {status.flags.map((flag) => (
                          <div key={flag} className="mt-0.5 text-sm text-muted-foreground">
                            {flag}
                          </div>
                        ))}
                      </div>
                      <StatusBadge status={status.status} overall />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Teams to check in on" count={flaggedTeams.length}>
          {flaggedTeams.length === 0 ? (
            <Empty text="All teams are on track." />
          ) : (
            <ul className="divide-y">
              {flaggedTeams.map(({ team, status }) => (
                <li key={team.id}>
                  <Link
                    href={`/admin/teams/${team.id}`}
                    className="-mx-2 flex items-start justify-between gap-4 rounded-md px-2 py-3 hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Team {team.name}</div>
                      {status.flags.map((flag) => (
                        <div key={flag} className="mt-0.5 text-sm text-muted-foreground">
                          {flag}
                        </div>
                      ))}
                    </div>
                    <StatusBadge status={status.status} overall />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Attendance so far">
          <div className="space-y-4">
            {pastEvents.map((event) => {
              const { count, pct } = attendanceRate(event.id);
              return (
                <Link key={event.id} href={`/admin/events/${event.id}`} className="group block">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate group-hover:underline">
                      {event.title}
                      {!event.isRequired && (
                        <span className="text-muted-foreground"> · optional</span>
                      )}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {count}/{active.length}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${event.isRequired ? "bg-primary" : "bg-muted-foreground/40"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        {title}
        {count !== undefined && (
          <span className="ml-2 font-normal text-muted-foreground tabular-nums">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

/** The one highlighted card on the page: what's happening next. */
function NextEvent({ event, later }: { event: ProgramEvent; later: ProgramEvent[] }) {
  const { data } = useCohort();
  const days = Math.round((Date.parse(event.date) - Date.parse(data.today)) / 86_400_000);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  const intro = event.description?.split(/\n\s*\n/)[0];

  return (
    <Card>
      <CardContent className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="text-sm font-medium text-primary">Next up · {when}</div>
          <div>
            <h2 className="text-2xl font-semibold">{event.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                formatDate(event.date, { weekday: true }),
                formatEventTime(event),
                event.location,
                EVENT_CATEGORY_LABELS[event.category],
                event.isRequired ? "Required" : "Optional",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {intro && <p className="line-clamp-2 max-w-prose text-sm">{intro}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/admin/events/${event.id}`} className={buttonVariants()}>
              Open event
            </Link>
            <CopyLinkButton path={`/checkin/${event.checkinToken}`} />
          </div>
        </div>
        {later.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">After that</div>
            <ul className="space-y-2">
              {later.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className="flex justify-between gap-3 text-sm hover:underline"
                  >
                    <span className="truncate">{e.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDate(e.date, { weekday: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{text}</p>;
}
