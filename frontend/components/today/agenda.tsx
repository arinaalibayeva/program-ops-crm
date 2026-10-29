"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { eventHref, useCalendarEvents } from "@/lib/calendar";
import { addDays, formatEventTime } from "@/lib/events";
import { relativeDay } from "@/lib/requirement-insights";
import { useCohort } from "@/lib/store";

const DAYS_AHEAD = 14;
/** On a quiet fortnight, keep going until there's this much to show. */
const AT_LEAST = 8;

/**
 * Events and deadlines for the next two weeks (or the next few), one row
 * each: the date, what it is, and how far off it is.
 */
export function Agenda({ className }: { className?: string }) {
  const { data } = useCohort();
  const events = useCalendarEvents();
  const end = addDays(data.today, DAYS_AHEAD);
  const items = events
    .filter((e) => !e.derived || e.derived === "requirement")
    .filter((e) => e.date >= data.today)
    .filter((e, i) => e.date <= end || i < AT_LEAST);

  return (
    <Card className={cn("gap-2 rounded-2xl px-5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Coming up</h2>
        <Link
          href="/admin/events"
          className="text-xs font-medium text-ocean-600 hover:underline"
        >
          Calendar
        </Link>
      </div>
      {items.length === 0 && <p className="text-sm">Nothing coming up.</p>}
      <ol className="divide-y border-t">
        {items.map((e) => {
          const deadline = e.derived === "requirement";
          const d = new Date(`${e.date}T00:00:00`);
          return (
            <li key={e.id}>
              <Link
                href={eventHref(e)}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted"
              >
                <span className="w-10 shrink-0 text-center leading-none">
                  <span className="block text-[10px] font-semibold uppercase">
                    {d.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="block text-lg font-semibold tabular-nums">
                    {d.getDate()}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {e.title}
                  </span>
                  <span className="block truncate text-xs">
                    {deadline
                      ? `Due · ${e.description?.split(".")[0]}`
                      : formatEventTime(e)}
                  </span>
                </span>
                <span className="shrink-0 text-xs">
                  {e.date === data.today
                    ? "Today"
                    : relativeDay(data.today, e.date)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
