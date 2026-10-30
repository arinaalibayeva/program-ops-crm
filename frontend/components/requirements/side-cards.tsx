"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  countBuckets,
  type SubjectRow,
  type WeekPoint,
} from "@/lib/requirement-insights";
import { linkLabel } from "@/lib/records";
import { staffName, UNASSIGNED } from "@/lib/staff";
import type { CohortData, Requirement } from "@/lib/types";

/** Cards about the selected rule. Each hides itself when it has nothing real to show. */
export function SideCards({
  data,
  req,
  rows,
  history,
  className,
}: {
  data: CohortData;
  req: Requirement;
  rows: SubjectRow[];
  history: WeekPoint[];
  className?: string;
}) {
  // Side by side under the rule; cards in a row share its height.
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <ByOwner data={data} rows={rows} />
      <Trend req={req} history={history} />
      <Excusals data={data} req={req} />
    </div>
  );
}

function ByOwner({ data, rows }: { data: CohortData; rows: SubjectRow[] }) {
  if (!rows.some((r) => r.ownerId)) return null;
  const owners = [...new Set(rows.map((r) => r.ownerId))].sort((a, b) =>
    !a ? 1 : !b ? -1 : staffName(data, a).localeCompare(staffName(data, b)),
  );
  return (
    <Card size="sm" className="gap-2.5 rounded-2xl px-4">
      <h2 className="font-semibold">By staff member</h2>
      <ul className="space-y-2">
        {owners.map((owner) => {
          const c = countBuckets(rows.filter((r) => r.ownerId === owner));
          const pct = (n: number) => `${(n / Math.max(c.total, 1)) * 100}%`;
          const name = owner
            ? staffName(data, owner).split(" ")[0]
            : UNASSIGNED;
          const problems = [
            c.missing && `${c.missing} can't meet`,
            c.atRisk && `${c.atRisk} at risk`,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={owner ?? "none"}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 text-[13px]"
            >
              <span className="truncate">{name}</span>
              <div
                className="flex h-2.5 gap-px overflow-hidden rounded-[3px]"
                role="img"
                aria-label={`${name}: ${c.ok} on track${problems ? `, ${problems}` : ""}`}
              >
                <i
                  className="block h-full bg-ocean-200"
                  style={{ width: pct(c.ok) }}
                />
                {c.atRisk > 0 && (
                  <i
                    className="block h-full bg-ocean-500"
                    style={{ width: pct(c.atRisk) }}
                  />
                )}
                {c.missing > 0 && (
                  <i
                    className="block h-full bg-ocean-900"
                    style={{ width: pct(c.missing) }}
                  />
                )}
              </div>
              <span />
              <span className="text-[11px] text-muted-foreground">
                {problems || (
                  <span className="text-ocean-700">✓ all {c.total} fine</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Trend({ req, history }: { req: Requirement; history: WeekPoint[] }) {
  const points = history.map((p) => ({
    week: p.week,
    date: p.date,
    v: p.rules.get(req.id) ?? 1,
  }));
  if (points.length < 2) return null;

  const w = 260;
  const h = 120;
  const left = 34;
  const bottom = 104;
  const lo = Math.min(
    0.9,
    Math.floor(Math.min(...points.map((p) => p.v)) * 10) / 10,
  );
  const x = (i: number) =>
    left + 6 + (i / (points.length - 1)) * (w - left - 14);
  const y = (v: number) => 10 + (1 - (v - lo) / (1 - lo || 1)) * (bottom - 10);
  const line = points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
  const last = points[points.length - 1];
  const ticks = [1, (1 + lo) / 2, lo];

  return (
    <Card size="sm" className="gap-2 rounded-2xl px-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">On track over time</h2>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        // Keep the drawing its own size when the card is wide.
        className="mx-auto w-full max-w-80"
        role="img"
        aria-label={`${req.name}, share on track by week: ${points.map((p) => `W${p.week} ${Math.round(p.v * 100)}%`).join(", ")}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={w - 4}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
            />
            <text
              x={left - 4}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[9px]"
            >
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || points.length <= 8 ? (
            <text
              key={p.week}
              x={x(i)}
              y={h - 2}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              W{p.week}
            </text>
          ) : null,
        )}
        <polyline
          points={line}
          fill="none"
          className="stroke-ocean-600"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={p.week}>
            <circle
              cx={x(i)}
              cy={y(p.v)}
              r={i === points.length - 1 ? 3.5 : 2}
              className="fill-ocean-700"
            />
            {/* A bigger invisible target for the hover label. */}
            <circle cx={x(i)} cy={y(p.v)} r={9} fill="transparent">
              <title>{`Week ${p.week} (${formatDate(p.date)}): ${Math.round(p.v * 100)}% on track`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground">
        {Math.round(last.v * 100)}% on track now. Worked out from attendance and
        hand-in dates.
      </p>
    </Card>
  );
}

function Excusals({ data, req }: { data: CohortData; req: Requirement }) {
  const list = data.exemptions.filter((x) => x.requirementId === req.id);
  if (list.length === 0) return null;
  return (
    <Card size="sm" className="gap-2 rounded-2xl px-4 sm:col-span-2">
      <h2 className="font-semibold">Excused</h2>
      <ul className="space-y-1.5 text-[13px]">
        {list.map((x) => (
          <li key={x.subjectId}>
            <span className="font-medium">
              {linkLabel(data, req.scope, x.subjectId)}
            </span>
            {x.reason && (
              <span className="text-muted-foreground"> · {x.reason}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
