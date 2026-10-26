"use client";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  bucketOf,
  countOf,
  dueDateOf,
  relativeDay,
  ruleRows,
  type Statuses,
  type WeekPoint,
} from "@/lib/requirement-insights";
import type { CohortData } from "@/lib/types";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function names(list: string[], max = 4): string {
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} and ${list.length - max} more`;
}

function Sparkline({ points }: { points: number[] }) {
  const w = 200;
  const h = 30;
  const lo = Math.min(...points, 0.8);
  const x = (i: number) => 3 + (i / Math.max(points.length - 1, 1)) * (w - 6);
  const y = (v: number) =>
    3 + (1 - (v - lo) / Math.max(1 - lo, 0.01)) * (h - 6);
  const line = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = points.length - 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-8 w-full"
      role="img"
      aria-label={`Weekly share fully on track: ${points.map((p) => `${Math.round(p * 100)}%`).join(", ")}`}
    >
      <polyline
        points={line}
        fill="none"
        className="stroke-ocean-600"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle
        cx={x(last)}
        cy={y(points[last])}
        r={3}
        className="fill-ocean-700"
      />
    </svg>
  );
}

export function SummaryBand({
  data,
  statuses,
  history,
}: {
  data: CohortData;
  statuses: Statuses;
  history: WeekPoint[];
}) {
  const people = [...statuses.participantStatuses];
  const teams = [...statuses.teamStatuses];
  const worst = (results: { status: Parameters<typeof bucketOf>[0] }[]) => {
    const b = results.map((r) => bucketOf(r.status));
    return b.includes("missing")
      ? "missing"
      : b.includes("at_risk")
        ? "at_risk"
        : "ok";
  };
  const personName = (id: string) =>
    data.people.find(
      (p) => p.id === data.enrollments.find((e) => e.id === id)?.personId,
    )?.name ?? id;
  const teamName = (id: string) =>
    data.teams.find((t) => t.id === id)?.name ?? id;

  const fine = people.filter(([, s]) => worst(s.results) === "ok").length;
  const share = people.length ? Math.round((fine / people.length) * 100) : 100;

  const missingPeople = people
    .filter(([, s]) => worst(s.results) === "missing")
    .map(([id]) => personName(id));
  const missingTeams = teams
    .filter(([, s]) => worst(s.results) === "missing")
    .map(([id]) => teamName(id));
  const riskPeople = people
    .filter(([, s]) => worst(s.results) === "at_risk")
    .map(([id]) => personName(id));
  const riskTeams = teams
    .filter(([, s]) => worst(s.results) === "at_risk")
    .map(([id]) => teamName(id));

  const next = data.requirements
    .filter((r) => (dueDateOf(r) ?? "") >= data.today)
    .sort((a, b) => dueDateOf(a)!.localeCompare(dueDateOf(b)!))[0];
  const nextRows = next ? ruleRows(data, next, statuses) : [];
  const notIn = nextRows.filter((r) => r.result.status !== "met").length;

  const split = (p: number, t: number) =>
    [
      p && `${p} ${p === 1 ? "person" : "people"}`,
      t && `${t} ${t === 1 ? "team" : "teams"}`,
    ]
      .filter(Boolean)
      .join(" · ");

  const cards: React.ReactNode[] = [
    <Card key="fine" size="sm" className="gap-1.5 rounded-2xl px-4">
      <Label>Fully on track</Label>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">{share}%</span>
        <span className="text-xs text-muted-foreground">
          {fine} of {people.length} people
        </span>
      </div>
      {history.length > 1 && (
        <Sparkline points={history.map((p) => p.peopleOnTrack)} />
      )}
    </Card>,
    <Card key="missing" size="sm" className="gap-1.5 rounded-2xl px-4">
      <Label>Can no longer meet a rule</Label>
      {missingPeople.length + missingTeams.length === 0 ? (
        <div className="text-2xl font-bold text-ocean-700">✓ None</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ocean-900 tabular-nums">
              {missingPeople.length + missingTeams.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {split(missingPeople.length, missingTeams.length)}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {names([...missingPeople, ...missingTeams])}
          </p>
        </>
      )}
    </Card>,
    <Card key="risk" size="sm" className="gap-1.5 rounded-2xl px-4">
      <Label>At risk</Label>
      {riskPeople.length + riskTeams.length === 0 ? (
        <div className="text-2xl font-bold text-ocean-700">✓ None</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ocean-600 tabular-nums">
              {riskPeople.length + riskTeams.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {split(riskPeople.length, riskTeams.length)}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {names([...riskPeople, ...riskTeams])}
          </p>
        </>
      )}
    </Card>,
    <Card key="next" size="sm" className="gap-1.5 rounded-2xl px-4">
      <Label>Next deadline</Label>
      {next ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">
              {formatDate(dueDateOf(next)!, { weekday: true })}
            </span>
            <span className="text-xs text-muted-foreground">
              {relativeDay(data.today, dueDateOf(next)!)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {next.name} ·{" "}
            {notIn === 0
              ? "everyone is in"
              : `${countOf(next, notIn)} of ${nextRows.length} not in yet`}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No deadlines left this term.
        </p>
      )}
    </Card>,
  ];
  if (data.exemptions.length > 0) {
    cards.push(
      <Card key="ex" size="sm" className="gap-1.5 rounded-2xl px-4">
        <Label>Exceptions</Label>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {data.exemptions.length}
          </span>
          <span className="text-xs text-muted-foreground">excused</span>
        </div>
      </Card>,
    );
  }

  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 ${cards.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}
    >
      {cards}
    </div>
  );
}
