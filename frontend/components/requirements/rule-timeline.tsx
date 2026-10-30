"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  countedEvents,
  daysUntil,
  dueDateOf,
  totalWeeks,
  weekOf,
  type SubjectRow,
} from "@/lib/requirement-insights";
import type { CohortData, Requirement } from "@/lib/types";

/** When each rule is checked across the term. */
export function RuleTimeline({
  data,
  rules,
  rowsById,
}: {
  data: CohortData;
  rules: Requirement[];
  rowsById: Map<string, SubjectRow[]>;
}) {
  const weeks = Array.from({ length: totalWeeks(data) }, (_, i) => i + 1);
  const now = weekOf(data, data.today);
  const template = `minmax(7rem,10rem) repeat(${weeks.length}, minmax(1.1rem,1fr))`;

  return (
    <Card className="gap-3 rounded-2xl px-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">When each rule is checked</h2>
        <span className="text-xs text-muted-foreground">
          Weeks 1–{weeks.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div
          className="relative grid min-w-[34rem] items-center gap-x-[3px] gap-y-2"
          style={{ gridTemplateColumns: template }}
        >
          {/* The current week, behind everything. */}
          {now >= 1 && now <= weeks.length && (
            <span
              aria-hidden
              className="-z-0 rounded-md bg-ocean-100"
              style={{
                gridColumn: now + 1,
                gridRow: `1 / span ${rules.length + 1}`,
                alignSelf: "stretch",
              }}
            />
          )}
          <span style={{ gridRow: 1, gridColumn: 1 }} />
          {weeks.map((w) => (
            <span
              key={w}
              style={{ gridRow: 1, gridColumn: w + 1 }}
              className={cn(
                "relative text-center text-[10px] tabular-nums",
                w === now ? "font-bold text-primary" : "text-muted-foreground",
              )}
            >
              W{w}
            </span>
          ))}

          {rules.map((req, i) => {
            const row = i + 2;
            const rows = rowsById.get(req.id) ?? [];
            const due = dueDateOf(req);
            const marks: React.ReactNode[] = [];

            if (req.type === "team_min_size") {
              marks.push(
                <span
                  key="line"
                  title="Checked all the time"
                  style={{
                    gridRow: row,
                    gridColumn: `2 / span ${weeks.length}`,
                  }}
                  className="relative h-1 rounded-full bg-ocean-300"
                />,
              );
            }
            // One block per week; a number when several events share it.
            const byWeek = new Map<number, ReturnType<typeof countedEvents>>();
            for (const e of countedEvents(data, req)) {
              const w = weekOf(data, e.date);
              if (w >= 1 && w <= weeks.length)
                byWeek.set(w, [...(byWeek.get(w) ?? []), e]);
            }
            for (const [w, events] of byWeek) {
              const held = events.every((e) => e.date < data.today);
              marks.push(
                <span
                  key={`w${w}`}
                  title={events
                    .map(
                      (e) =>
                        `${e.title} · ${formatDate(e.date, { weekday: true })}${e.date < data.today ? "" : " (upcoming)"}`,
                    )
                    .join("\n")}
                  style={{ gridRow: row, gridColumn: w + 1 }}
                  className={cn(
                    "relative flex h-3.5 items-center justify-center rounded-[3px] text-[9px] leading-none font-bold",
                    held
                      ? "bg-primary text-primary-foreground"
                      : "border-[1.5px] border-dashed border-primary text-primary",
                  )}
                >
                  {events.length > 1 ? events.length : null}
                </span>,
              );
            }
            if (due) {
              const w = weekOf(data, due);
              const closed = due < data.today;
              const misses = rows.filter((r) => r.bucket === "missing").length;
              const soon = !closed && daysUntil(data.today, due) <= 7;
              marks.push(
                <span
                  key="due"
                  title={`Due ${formatDate(due, { weekday: true })}${closed && misses ? ` · ${misses} missed` : ""}`}
                  style={{
                    gridRow: row,
                    gridColumn: Math.min(Math.max(w, 1), weeks.length) + 1,
                  }}
                  className={cn(
                    "relative size-3 rotate-45 justify-self-center",
                    closed
                      ? misses
                        ? "bg-ocean-900"
                        : "bg-ocean-300"
                      : soon
                        ? "border-2 border-ocean-500 bg-ocean-100"
                        : "border-2 border-ocean-300",
                  )}
                />,
              );
            }

            return (
              <div key={req.id} className="contents">
                <span
                  style={{ gridRow: row, gridColumn: 1 }}
                  className="relative truncate text-[13px] font-medium"
                >
                  {req.name}
                </span>
                {marks}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="block h-2.5 w-3.5 rounded-[3px] bg-primary" /> held
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-dashed border-primary" />{" "}
          upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2.5 rotate-45 bg-ocean-900" /> closed with
          misses
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2.5 rotate-45 bg-ocean-300" /> closed, all in
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block size-2.5 rotate-45 border-2 border-ocean-500 bg-ocean-100" />{" "}
          due within a week
        </span>
        <span className="flex items-center gap-1.5">
          <i className="block h-1 w-4 rounded-full bg-ocean-300" /> checked all
          the time
        </span>
      </div>
    </Card>
  );
}
