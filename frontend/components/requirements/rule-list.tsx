"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  countBuckets,
  ruleTiming,
  type SubjectRow,
} from "@/lib/requirement-insights";
import type { CohortData, Requirement } from "@/lib/types";
import { CHIP, SQUARE } from "./status-styles";

const MAX_SQUARES = 60;
const MAX_CHIPS = 6;

export function RuleList({
  data,
  rules,
  rowsById,
  selectedId,
  onSelect,
  className,
}: {
  data: CohortData;
  /** Already sorted by problems. */
  rules: Requirement[];
  rowsById: Map<string, SubjectRow[]>;
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const groups = [
    {
      scope: "participant" as const,
      label: "Participants",
      n: data.enrollments.filter((e) => e.status === "active").length,
    },
    { scope: "team" as const, label: "Teams", n: data.teams.length },
  ];

  return (
    <Card className={cn("gap-1 rounded-2xl px-3", className)}>
      <div className="flex items-baseline justify-between px-1 pb-1">
        <h2 className="font-semibold">Rules</h2>
      </div>
      {groups.map(({ scope, label, n }) => {
        const list = rules.filter((r) => r.scope === scope);
        if (list.length === 0) return null;
        return (
          <section key={scope} className="space-y-1">
            <h3 className="px-1 pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
              {n ? ` · ${n}` : ""}
            </h3>
            {list.map((req) => (
              <RuleRow
                key={req.id}
                data={data}
                req={req}
                rows={rowsById.get(req.id) ?? []}
                selected={req.id === selectedId}
                onSelect={() => onSelect(req.id)}
              />
            ))}
          </section>
        );
      })}
      {rules.length === 0 && (
        <p className="px-1 py-3 text-sm text-muted-foreground">
          No rules here yet.
        </p>
      )}
    </Card>
  );
}

function RuleRow({
  data,
  req,
  rows,
  selected,
  onSelect,
}: {
  data: CohortData;
  req: Requirement;
  rows: SubjectRow[];
  selected: boolean;
  onSelect: () => void;
}) {
  const c = countBuckets(rows);
  const clean = c.missing + c.atRisk === 0;
  const squares = rows.slice(
    0,
    req.scope === "participant" ? MAX_SQUARES : rows.length,
  );
  const failing = rows.filter((r) => r.bucket !== "ok");

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "block w-full rounded-xl border px-2.5 py-2 text-left transition-colors",
        selected
          ? "border-primary bg-ocean-50"
          : "border-transparent hover:bg-muted/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold">{req.name}</span>
        {clean ? (
          <span className="shrink-0 text-xs font-semibold text-ocean-700 tabular-nums">
            ✓ {c.total}
          </span>
        ) : (
          <span className="shrink-0 text-xs tabular-nums">
            {c.missing > 0 && (
              <span className="font-semibold">{c.missing} can&apos;t meet</span>
            )}
            {c.missing > 0 && c.atRisk > 0 && " · "}
            {c.atRisk > 0 && <span>{c.atRisk} at risk</span>}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {ruleTiming(data, req, rows)}
      </div>
      {!clean && (
        <>
          <div
            className="mt-1.5 flex flex-wrap items-center gap-0.5"
            aria-hidden
          >
            {squares.map((r) => (
              <i
                key={r.id}
                className={cn(
                  "block",
                  req.scope === "participant"
                    ? "size-[7px] rounded-[2px]"
                    : "size-3 rounded-[3px]",
                  SQUARE[r.bucket],
                )}
              />
            ))}
            {rows.length > squares.length && (
              <span className="ml-1 text-[11px] text-muted-foreground">
                +{rows.length - squares.length}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs">
            {failing.slice(0, MAX_CHIPS).map((r, i) => (
              <span key={r.id} className={CHIP[r.bucket]}>
                {i > 0 && ", "}
                {r.name}
              </span>
            ))}
            {failing.length > MAX_CHIPS && (
              <span> and {failing.length - MAX_CHIPS} more</span>
            )}
          </div>
        </>
      )}
    </button>
  );
}
