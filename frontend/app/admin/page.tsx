"use client";

import Link from "next/link";
import { Donut, type DonutSlice } from "@/components/charts/donut";
import { Card } from "@/components/ui/card";
import { MiniCalendar } from "@/components/mini-calendar";
import { ComingUpList, DeadlineChecklist } from "@/components/event-calendar";
import { MyListCard, TabbedCard } from "@/components/today-cards";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId, needsAttention, recordProgress, type RecordProgress } from "@/lib/requirements";
import { takesAttendance } from "@/lib/events";
import { cohortWeek, formatDate } from "@/lib/format";
import { followUpsOf } from "@/lib/notes";
import { usePersonalItems } from "@/lib/personal";
import { useProfile } from "@/lib/profile";
import type { Requirement, Status } from "@/lib/types";

type RecordRequirement = Extract<Requirement, { type: "record_by" }>;

const SEVERITY: Record<Status, number> = {
  missing: 0,
  at_risk: 1,
  on_track: 2,
  met: 3,
};

export default function DashboardPage() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const { profile } = useProfile();
  const personal = usePersonalItems();

  const active = data.enrollments.filter((e) => e.status === "active");
  const flaggedPeople = active
    .map((e) => ({ enrollment: e, status: participantStatuses.get(e.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);
  const flaggedTeams = data.teams
    .map((team) => ({ team, status: teamStatuses.get(team.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);
  const followUps = followUpsOf(data);

  return (
    <>
      <PageHeader
        title={profile ? `Hi, ${profile.name.split(" ")[0]}` : "Hi"}
        description={`Week ${cohortWeek(data.cohort.startDate, data.today)} · ${formatDate(data.today, { weekday: true })} · ${data.program.name}, ${data.cohort.name}`}
      />

      {/* Each column stacks on its own, so a short card never leaves a hole beside it. */}
      <div className="grid items-start gap-5 md:grid-cols-[repeat(2,minmax(0,22rem))] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-5">
          <MyListCard personal={personal} followUps={followUps} />
          <TabbedCard
            title="Needs attention"
            tabs={[
              {
                label: "People",
                count: flaggedPeople.length,
                content:
                  flaggedPeople.length === 0 ? (
                    <Empty text="Everyone is on track." />
                  ) : (
                    <ul className="-mx-2 max-h-[30rem] divide-y overflow-y-auto px-2">
                      {flaggedPeople.map(({ enrollment, status }) => {
                        const teamId = currentTeamId(data, enrollment.id);
                        return (
                          <FlaggedRow
                            key={enrollment.id}
                            href={`/admin/participants/${enrollment.id}`}
                            name={personFor(enrollment.id)!.name}
                            detail={teamId ? `Team ${teamById.get(teamId)?.name}` : "No team"}
                            status={status}
                          />
                        );
                      })}
                    </ul>
                  ),
              },
              {
                label: "Teams",
                count: flaggedTeams.length,
                content:
                  flaggedTeams.length === 0 ? (
                    <Empty text="All teams are on track." />
                  ) : (
                    <ul className="-mx-2 max-h-[30rem] divide-y overflow-y-auto px-2">
                      {flaggedTeams.map(({ team, status }) => (
                        <FlaggedRow
                          key={team.id}
                          href={`/admin/teams/${team.id}`}
                          name={`Team ${team.name}`}
                          status={status}
                        />
                      ))}
                    </ul>
                  ),
              },
            ]}
          />
        </div>
        {/* The calendar and metrics sit on the right; the space between stays empty. */}
        <div className="min-w-0 space-y-5 xl:col-start-3">
          <MiniCalendar />
          <ProgramCharts />
          <TabbedCard
            tabs={[
              { label: "Coming up", content: <ComingUpList events={data.events} today={data.today} /> },
              {
                label: "Deadlines",
                count: data.events.filter((e) => !takesAttendance(e) && !e.completed).length,
                content: <DeadlineChecklist events={data.events} />,
              },
            ]}
          />
        </div>
      </div>
    </>
  );
}

function FlaggedRow({
  href,
  name,
  detail,
  status,
}: {
  href: string;
  name: string;
  detail?: string;
  status: { status: Status; flags: string[] };
}) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex items-start justify-between gap-4 rounded-md px-2 py-3 hover:bg-muted/60"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {name}
            {detail && <span className="font-normal text-muted-foreground"> · {detail}</span>}
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
}

// Darker means more serious, so the rings read as one blue scale.
const ON_TRACK = { fill: "bg-ocean-300", stroke: "stroke-ocean-300" };
const AT_RISK = { fill: "bg-ocean-500", stroke: "stroke-ocean-500" };
const MISSING = { fill: "bg-ocean-900", stroke: "stroke-ocean-900" };
const PENDING = { fill: "bg-ocean-100", stroke: "stroke-ocean-100" };

/** Each slice opens the list it counts, already filtered. */
function healthSlices(statuses: Status[], href: string): DonutSlice[] {
  const count = (...wanted: Status[]) =>
    statuses.filter((s) => wanted.includes(s)).length;
  return [
    {
      label: "On track",
      value: count("on_track", "met"),
      href: `${href}?status=on_track`,
      ...ON_TRACK,
    },
    {
      label: "At risk",
      value: count("at_risk"),
      href: `${href}?status=at_risk`,
      ...AT_RISK,
    },
    {
      label: "Missing",
      value: count("missing"),
      href: `${href}?status=missing`,
      ...MISSING,
    },
  ];
}

function ChartPanel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <h2 className="mb-2 text-sm font-semibold">
        {href ? (
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>
      {children}
    </section>
  );
}

/** How teams are doing on the latest requirement met by logging records. */
function RecordRequirementChart({ requirement: req }: { requirement: RecordRequirement }) {
  const { data } = useCohort();
  const href = `/admin/requirements/${req.id}`;
  const excused = new Set(
    data.exemptions.filter((x) => x.requirementId === req.id).map((x) => x.subjectId),
  );
  const progress = data.teams
    .filter((t) => !excused.has(t.id))
    .map((t) => recordProgress(data, req, t.id));
  const count = (wanted: RecordProgress) => progress.filter((p) => p === wanted).length;
  const pending = count("pending");

  return (
    <ChartPanel title={req.name} href={href}>
      <Donut
        unit="teams"
        slices={[
          { label: "On time", value: count("on_time"), href, ...ON_TRACK },
          { label: "Late", value: count("late"), href, ...AT_RISK },
          { label: "Missing", value: count("missing"), href, ...MISSING },
          ...(pending > 0 ? [{ label: "Not due yet", value: pending, href, ...PENDING }] : []),
        ]}
      />
    </ChartPanel>
  );
}

/** How the program is doing at a glance. */
function ProgramCharts() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const statusesOf = (map: Map<string, { status: Status }>) =>
    [...map.values()].map((s) => s.status);
  const latest = data.requirements
    .filter((r): r is RecordRequirement => r.type === "record_by" && r.scope === "team")
    .sort((a, b) => a.params.dueDate.localeCompare(b.params.dueDate))
    .at(-1);

  return (
    <Card className="gap-5 rounded-2xl p-4">
      <ChartPanel title="Teams" href="/admin/teams">
        <Donut slices={healthSlices(statusesOf(teamStatuses), "/admin/teams")} unit="teams" />
      </ChartPanel>
      <ChartPanel title="Participants" href="/admin/participants">
        <Donut
          slices={healthSlices(statusesOf(participantStatuses), "/admin/participants")}
          unit="people"
        />
      </ChartPanel>
      {latest && <RecordRequirementChart requirement={latest} />}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{text}</p>;
}
