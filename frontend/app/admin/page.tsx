"use client";

import Link from "next/link";
import { Donut, type DonutSlice } from "@/components/charts/donut";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId, needsAttention } from "@/lib/requirements";
import { cohortWeek, formatDate } from "@/lib/format";
import { SAMPLE_MEETINGS, SAMPLE_REPORTS } from "@/lib/sample-metrics";
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

  return (
    <>
      <PageHeader
        title="Today"
        description={`Week ${cohortWeek(data.cohort.startDate, data.today)} · ${formatDate(data.today, { weekday: true })} · ${data.program.name}, ${data.cohort.name}`}
      />

      <ProgramCharts />

      <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2">
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

const ON_TRACK = { fill: "bg-chart-2", stroke: "stroke-chart-2" };
const AT_RISK = { fill: "bg-amber-500", stroke: "stroke-amber-500" };
const MISSING = { fill: "bg-red-600", stroke: "stroke-red-600" };

function healthSlices(statuses: Status[]): DonutSlice[] {
  const count = (...wanted: Status[]) => statuses.filter((s) => wanted.includes(s)).length;
  return [
    { label: "On track", value: count("on_track", "met"), ...ON_TRACK },
    { label: "At risk", value: count("at_risk"), ...AT_RISK },
    { label: "Missing", value: count("missing"), ...MISSING },
  ];
}

function ChartPanel({
  title,
  href,
  sample,
  children,
}: {
  title: string;
  href?: string;
  sample?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline justify-between gap-2 text-sm font-semibold">
        {href ? (
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        {sample && <span className="text-xs font-normal text-muted-foreground">Sample</span>}
      </h2>
      {children}
    </section>
  );
}

/** How the program is doing at a glance. */
function ProgramCharts() {
  const { participantStatuses, teamStatuses } = useCohort();
  // The meeting figures are sample data, so their denominator must be too.
  const teamCount = SAMPLE_REPORTS.onTime + SAMPLE_REPORTS.late + SAMPLE_REPORTS.missing;
  const statusesOf = (map: Map<string, { status: Status }>) => [...map.values()].map((s) => s.status);

  return (
    <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
      <ChartPanel title="Team health" href="/admin/teams">
        <Donut slices={healthSlices(statusesOf(teamStatuses))} unit="teams" />
      </ChartPanel>
      <ChartPanel title="Participant health" href="/admin/participants">
        <Donut slices={healthSlices(statusesOf(participantStatuses))} unit="people" />
      </ChartPanel>
      <ChartPanel title="October Meeting Reports" sample>
        <Donut
          unit="reports"
          slices={[
            { label: "On time", value: SAMPLE_REPORTS.onTime, ...ON_TRACK },
            { label: "Late", value: SAMPLE_REPORTS.late, ...AT_RISK },
            { label: "Missing", value: SAMPLE_REPORTS.missing, ...MISSING },
          ]}
        />
      </ChartPanel>
      <ChartPanel title="Required meetings this month" sample>
        <div className="space-y-3.5">
          {SAMPLE_MEETINGS.map((meeting) => (
            <div key={meeting.label}>
              <div className="flex justify-between gap-2 text-sm">
                <span>{meeting.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {meeting.done}/{teamCount} teams
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-2"
                  style={{ width: `${(meeting.done / teamCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </ChartPanel>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{text}</p>;
}
