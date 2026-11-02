"use client";

import { inProgramOn } from "@/lib/requirements";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  countedEvents,
  dueDateOf,
  relativeDay,
  weekOf,
  type SubjectRow,
} from "@/lib/requirement-insights";
import type { CohortData, Requirement } from "@/lib/types";

/** How many past checks show before "Show earlier". */
const PAST = 4;

interface Check {
  key: string;
  date: string;
  what: string;
  rule: Requirement;
  /** What happened, for checks that are done. */
  result: string;
}

/**
 * Every date a rule gets checked, in order: deadlines and the events
 * attendance rules count. Past ones say how it went; upcoming ones say when.
 */
export function RuleTimeline({
  data,
  rules,
  rowsById,
  onSelect,
}: {
  data: CohortData;
  rules: Requirement[];
  rowsById: Map<string, SubjectRow[]>;
  onSelect?: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const checks: Check[] = [];
  const always: Requirement[] = [];
  for (const rule of rules) {
    const due = dueDateOf(rule);
    const events = countedEvents(data, rule);
    if (due) {
      const rows = rowsById.get(rule.id) ?? [];
      const met = rows.filter((r) => r.result.status === "met").length;
      checks.push({
        key: rule.id,
        date: due,
        what: `${rule.name} due`,
        rule,
        result: `${met} of ${rows.length} ${rule.scope === "team" ? "teams" : "people"} in`,
      });
    } else if (events.length > 0) {
      for (const e of events) {
        const inProgram = inProgramOn(data, e.date);
        const came = data.attendance.filter(
          (a) => a.eventId === e.id && inProgram.has(a.enrollmentId),
        ).length;
        checks.push({
          key: `${rule.id}-${e.id}`,
          date: e.date,
          what: `${e.title.split(":")[0]} (${rule.name})`,
          rule,
          result: `${came} of ${inProgram.size} came`,
        });
      }
    } else {
      always.push(rule);
    }
  }
  checks.sort((a, b) => a.date.localeCompare(b.date));

  const past = checks.filter((c) => c.date < data.today);
  const upcoming = checks.filter((c) => c.date >= data.today);
  const shownPast = showAll ? past : past.slice(-PAST);

  const row = (c: Check, done: boolean) => (
    <tr
      key={c.key}
      onClick={() => {
        onSelect?.(c.rule.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="cursor-pointer hover:bg-muted"
    >
      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
        {formatDate(c.date)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
        Week {weekOf(data, c.date)}
      </td>
      <td className="px-3 py-2 font-medium">{c.what}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
        {done ? c.result : relativeDay(data.today, c.date)}
      </td>
    </tr>
  );

  return (
    <Card className="gap-3 rounded-2xl px-5">
      <h2 className="font-semibold">Checks by date</h2>
      <div className="-mx-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="border-b">
            <tr className="text-left text-xs font-semibold">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Week</th>
              <th className="px-3 py-2">What&apos;s checked</th>
              <th className="px-3 py-2 text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {past.length > PAST && (
              <tr>
                <td colSpan={4} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="text-xs font-medium text-ocean-600 hover:underline"
                  >
                    {showAll
                      ? "Show fewer"
                      : `Show ${past.length - PAST} earlier`}
                  </button>
                </td>
              </tr>
            )}
            {shownPast.map((c) => row(c, true))}
            <tr>
              <td
                colSpan={4}
                className="bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                Today, {formatDate(data.today)}
              </td>
            </tr>
            {upcoming.map((c) => row(c, false))}
          </tbody>
        </table>
      </div>
      {always.length > 0 && (
        <p className="text-xs">
          Checked all the time: {always.map((r) => r.name).join(", ")}.
        </p>
      )}
    </Card>
  );
}
