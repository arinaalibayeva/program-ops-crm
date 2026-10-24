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
import { useCohort } from "@/lib/store";
import { cn } from "@/lib/utils";

const arrow =
  "flex size-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25";

/** A small month with dots on busy days. Picking a day lists what's on it. */
export function MiniCalendar() {
  const { data } = useCohort();
  const [month, setMonth] = useState(monthOf(data.today));
  const [picked, setPicked] = useState(data.today);
  const onPicked = data.events.filter((e) => onDay(e, picked));

  return (
    <Card className="gap-3 rounded-2xl bg-gradient-to-br from-ocean-700 to-ocean-900 p-4 text-white ring-0">
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

      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ocean-200">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="-mt-2 grid grid-cols-7 gap-y-1 text-center text-sm">
        {gridDays(month).map((day) => {
          const busy = data.events.some((e) => onDay(e, day));
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
                  "flex size-8 items-center justify-center rounded-full tabular-nums transition-colors hover:bg-white/15",
                  monthOf(day) !== month && "text-white/45",
                  day === picked && "bg-white/20 font-semibold",
                  day === data.today &&
                    "bg-white font-semibold text-ocean-800 hover:bg-white",
                )}
              >
                {Number(day.slice(8))}
              </span>
              {busy && day !== data.today && (
                <span
                  className="absolute bottom-0 size-1 rounded-full bg-ocean-300"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/20 pt-3">
        <div className="mb-1.5 text-xs font-medium text-ocean-200">
          {picked === data.today
            ? "Today"
            : formatDate(picked, { weekday: true })}
        </div>
        {onPicked.length === 0 ? (
          <p className="text-sm text-ocean-200">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-1.5">
            {onPicked.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/admin/events/${event.id}`}
                  className="group flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate font-medium group-hover:underline">
                    {event.title}
                  </span>
                  <span className="shrink-0 text-xs text-ocean-200">
                    {formatEventTime(event)}
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
