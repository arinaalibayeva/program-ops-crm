"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  WEEKDAYS,
  gridDays,
  monthLabel,
  monthOf,
  onDay,
  shiftMonth,
} from "@/components/event-calendar";
import { formatEventTime } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { eventHref, useCalendarEvents } from "@/lib/calendar";
import { useCohort } from "@/lib/store";
import { cn } from "@/lib/utils";

const arrow =
  "flex size-7 items-center justify-center rounded-full bg-ocean-50 text-ocean-600 hover:bg-ocean-100";

/** A small month with dots on busy days. Picking a day lists what's on it. */
export function MiniCalendar() {
  const { data } = useCohort();
  const [month, setMonth] = useState(monthOf(data.today));
  const [picked, setPicked] = useState(data.today);
  const events = useCalendarEvents();
  const onPicked = events.filter((e) => onDay(e, picked) && e.derived !== "records");

  return (
    <Card className="gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{monthLabel(month)}</h2>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className={arrow}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className={arrow}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground uppercase">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="-mt-2 grid grid-cols-7 gap-y-1 text-center text-sm">
        {gridDays(month).map((day) => {
          const busy = events.some((e) => onDay(e, day) && e.derived !== "records");
          return (
            <button
              key={day}
              type="button"
              aria-label={formatDate(day, { weekday: true })}
              aria-pressed={day === picked}
              onClick={() => setPicked(day)}
              className="relative flex h-9 items-center justify-center"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full tabular-nums transition-colors hover:bg-ocean-50",
                  // Busy days are blue, like links; today is the one filled circle.
                  busy && "font-semibold text-ocean-600",
                  monthOf(day) !== month && "font-normal text-muted-foreground/50",
                  day === picked && "bg-ocean-100",
                  day === data.today && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {Number(day.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t pt-3">
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          {picked === data.today
            ? "Today"
            : formatDate(picked, { weekday: true })}
        </div>
        {onPicked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-1.5">
            {onPicked.map((event) => (
              <li key={event.id}>
                <Link
                  href={eventHref(event)}
                  className="group flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate font-medium group-hover:underline">
                    {event.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {event.derived ? "Due" : formatEventTime(event)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
