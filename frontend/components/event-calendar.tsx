"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, formatTime } from "@/lib/events";
import type { ProgramEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "2026-10" for any date in October 2026. */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Every day shown for the month, from the Monday before the 1st to the Sunday after the last day. */
function gridDays(month: string): string[] {
  const first = `${month}-01`;
  const mondayOffset = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(first, -mondayOffset);
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days: string[] = [];
  for (let d = start; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

function onDay(event: ProgramEvent, day: string): boolean {
  return event.date <= day && day <= (event.endDate ?? event.date);
}

export function EventCalendar({ events, today }: { events: ProgramEvent[]; today: string }) {
  const [month, setMonth] = useState(monthOf(today));
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-medium">{label}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setMonth(monthOf(today))}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-xs font-medium">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {gridDays(month).map((day, i) => {
          const inMonth = monthOf(day) === month;
          const dayEvents = events.filter((e) => onDay(e, day));
          return (
            <div
              key={day}
              className={cn(
                "min-h-32 min-w-0 border-b p-1.5",
                i % 7 !== 6 && "border-r",
                !inMonth && "bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  !inMonth && "text-muted-foreground",
                  day === today && "bg-primary text-primary-foreground",
                )}
              >
                {Number(day.slice(8))}
              </div>
              <div className="space-y-1.5">
                {dayEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    title={event.title}
                    className="block rounded-lg bg-primary px-2 py-1.5 text-primary-foreground transition-colors hover:bg-primary/85"
                  >
                    <span className="line-clamp-2 text-xs leading-snug font-semibold break-words">{event.title}</span>
                    {event.startTime && event.date === day && (
                      <span className="mt-0.5 block text-[11px] leading-none text-primary-foreground/75 tabular-nums">
                        {formatTime(event.startTime)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
