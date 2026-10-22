"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Donut, type DonutSlice } from "@/components/charts/donut";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId, needsAttention, recordProgress, type RecordProgress } from "@/lib/requirements";
import { cohortWeek, formatDate } from "@/lib/format";
import { noteSubject, openFollowUps } from "@/lib/notes";
import { useProfile } from "@/lib/profile";
import { linkedIds } from "@/lib/records";
import { noteOwner, participantOwner } from "@/lib/staff";
import type { CohortData, RecordType, Requirement, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecordRequirement = Extract<Requirement, { type: "record_by" }>;

const SEVERITY: Record<Status, number> = { missing: 0, at_risk: 1, on_track: 2, met: 3 };

// Whether Today shows everything or just your own teams is a per-person
// preference, so it lives in this browser rather than in the cohort data.
const VIEW_KEY = "program-ops-crm:today-view";

export default function DashboardPage() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const { profile } = useProfile();
  const [mineOnly, setMineOnly] = useState(false);

  // Read after mount to avoid a server/client mismatch.
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "mine") setMineOnly(true);
    } catch {
      // Unreadable storage: show everything.
    }
  }, []);

  function showMine(next: boolean) {
    setMineOnly(next);
    try {
      localStorage.setItem(VIEW_KEY, next ? "mine" : "all");
    } catch {
      // Storage unavailable: the choice lasts until the page reloads.
    }
  }

  const me = data.staff.find((s) => s.id === profile?.id)?.id;
  const mine = (ownerId: string | undefined) => !mineOnly || !me || ownerId === me;
  const active = data.enrollments.filter((e) => e.status === "active" && mine(participantOwner(data, e.id)));
  const flaggedPeople = active
    .map((e) => ({ enrollment: e, status: participantStatuses.get(e.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);
  const flaggedTeams = data.teams
    .filter((team) => mine(team.ownerId))
    .map((team) => ({ team, status: teamStatuses.get(team.id)! }))
    .filter(({ status }) => needsAttention(status.status))
    .sort((a, b) => SEVERITY[a.status.status] - SEVERITY[b.status.status]);
  const followUps = openFollowUps(data).filter((n) => mine(noteOwner(data, n)));
  const emptyFor = mineOnly && me ? " for your teams" : "";

  return (
    <>
      <PageHeader
        title="Today"
        description={`Week ${cohortWeek(data.cohort.startDate, data.today)} · ${formatDate(data.today, { weekday: true })} · ${data.program.name}, ${data.cohort.name}`}
        actions={
          me && (
            <div role="radiogroup" aria-label="Show" className="flex h-8 rounded-lg border p-0.5 text-sm">
              {[false, true].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={mineOnly === value}
                  onClick={() => showMine(value)}
                  className={cn(
                    "rounded-md px-2.5 text-muted-foreground",
                    mineOnly === value && "bg-muted font-medium text-foreground",
                  )}
                >
                  {value ? "Mine" : "Everyone"}
                </button>
              ))}
            </div>
          )
        }
      />

      <ProgramCharts />

      <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-2 2xl:grid-cols-3">
        <Section title="Follow-ups" count={followUps.length}>
          {followUps.length === 0 ? (
            <Empty text={`No follow-ups due${emptyFor}.`} />
          ) : (
            <FollowUps notes={followUps} />
          )}
        </Section>

        <Section title="People to follow up with" count={flaggedPeople.length}>
          {flaggedPeople.length === 0 ? (
            <Empty text={`Everyone is on track${emptyFor}.`} />
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
            <Empty text={`All teams are on track${emptyFor}.`} />
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
const PENDING = { fill: "bg-muted-foreground/40", stroke: "stroke-muted-foreground/40" };

/** Each slice opens the list it counts, already filtered. */
function healthSlices(statuses: Status[], href: string): DonutSlice[] {
  const count = (...wanted: Status[]) => statuses.filter((s) => wanted.includes(s)).length;
  return [
    { label: "On track", value: count("on_track", "met"), href: `${href}?status=on_track`, ...ON_TRACK },
    { label: "At risk", value: count("at_risk"), href: `${href}?status=at_risk`, ...AT_RISK },
    { label: "Missing", value: count("missing"), href: `${href}?status=missing`, ...MISSING },
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
    <section>
      <h2 className="mb-3 text-sm font-semibold">
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
  const excused = new Set(data.exemptions.filter((x) => x.requirementId === req.id).map((x) => x.subjectId));
  const progress = data.teams.filter((t) => !excused.has(t.id)).map((t) => recordProgress(data, req, t.id));
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

/** Record types that teams are expected to keep up with: a requirement or a "days since" check uses them. */
function trackedTypes(data: CohortData): { type: RecordType; teamFieldId: string; dateFieldId?: string }[] {
  return data.recordTypes.flatMap((type) => {
    const teamField = type.fields.find((f) => f.type === "link" && f.linkTo === "team");
    if (!teamField) return [];
    const tracked =
      data.requirements.some((r) => r.type === "record_by" && r.scope === "team" && r.params.typeId === type.id) ||
      data.calculations.some((c) => c.on === "team" && c.kind === "days_since" && c.sourceTypeId === type.id);
    if (!tracked) return [];
    return [{ type, teamFieldId: teamField.id, dateFieldId: type.fields.find((f) => f.type === "date")?.id }];
  });
}

/** How many teams have logged each tracked kind of record this calendar month. */
function LoggedThisMonth() {
  const { data } = useCohort();
  const month = data.today.slice(0, 7);
  const rows = trackedTypes(data).map(({ type, teamFieldId, dateFieldId }) => {
    const teams = new Set(
      data.records
        .filter((r) => {
          if (r.typeId !== type.id) return false;
          const date = dateFieldId ? r.values[dateFieldId] : undefined;
          return String(typeof date === "string" && date ? date : r.createdAt).startsWith(month);
        })
        .flatMap((r) => linkedIds(r.values[teamFieldId])),
    );
    return { type, done: teams.size };
  });
  if (rows.length === 0) return null;

  return (
    <ChartPanel title="Logged this month">
      <div className="space-y-3.5">
        {rows.map(({ type, done }) => (
          <div key={type.id}>
            <div className="flex justify-between gap-2 text-sm">
              <Link href={`/admin/records/${type.id}`} className="hover:underline">
                {type.name}
              </Link>
              <span className="text-muted-foreground tabular-nums">
                {done}/{data.teams.length} teams
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-2"
                style={{ width: `${(done / Math.max(data.teams.length, 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartPanel>
  );
}

/** How the program is doing at a glance. */
function ProgramCharts() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const statusesOf = (map: Map<string, { status: Status }>) => [...map.values()].map((s) => s.status);
  const latest = data.requirements
    .filter((r): r is RecordRequirement => r.type === "record_by" && r.scope === "team")
    .sort((a, b) => a.params.dueDate.localeCompare(b.params.dueDate))
    .at(-1);

  return (
    <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
      <ChartPanel title="Team health" href="/admin/teams">
        <Donut slices={healthSlices(statusesOf(teamStatuses), "/admin/teams")} unit="teams" />
      </ChartPanel>
      <ChartPanel title="Participant health" href="/admin/participants">
        <Donut slices={healthSlices(statusesOf(participantStatuses), "/admin/participants")} unit="people" />
      </ChartPanel>
      {latest && <RecordRequirementChart requirement={latest} />}
      <LoggedThisMonth />
    </div>
  );
}

function FollowUps({ notes }: { notes: ReturnType<typeof openFollowUps> }) {
  const { data, updateNote } = useCohort();
  return (
    <ul className="divide-y">
      {notes.map((note) => {
        const subject = noteSubject(data, note);
        const overdue = note.followUpDate < data.today;
        return (
          <li key={note.id} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-3">
            <Checkbox
              className="mt-0.5"
              checked={false}
              onCheckedChange={() => updateNote(note.id, { followUpDone: true })}
              aria-label={`Mark follow-up with ${subject.label} done`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={subject.href} className="min-w-0 truncate font-medium hover:underline">
                  {subject.label}
                </Link>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    overdue ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {overdue && <span className="mr-1.5 inline-block size-1.5 rounded-full bg-red-500 align-middle" />}
                  {formatDate(note.followUpDate)}
                </span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{note.body}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{text}</p>;
}
