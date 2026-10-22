"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatEventTime, takesAttendance } from "@/lib/events";
import { formatDate, initials } from "@/lib/format";
import type { ProgramEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "day" | "week" | "month";

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_HEIGHT = 64; // px
const MIN_BLOCK_HEIGHT = 48; // px, enough for a title and a time

/** "2026-10" for any date in October 2026. */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

function mondayOf(iso: string): string {
  return addDays(iso, -((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7));
}

/** Every day shown for the month, from the Monday before the 1st to the Sunday after the last day. */
function gridDays(month: string): string[] {
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days: string[] = [];
  for (let d = mondayOf(`${month}-01`); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

function onDay(event: ProgramEvent, day: string): boolean {
  return event.date <= day && day <= (event.endDate ?? event.date);
}

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Timed, single-day events go in the hour grid; the rest run along the top. */
function isTimed(event: ProgramEvent): boolean {
  return !!event.startTime && !event.endDate;
}

function span(event: ProgramEvent): { start: number; end: number } {
  const start = minutes(event.startTime!);
  return { start, end: event.endTime ? minutes(event.endTime) : Math.min(start + 60, 24 * 60) };
}

function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function rangeLabel(view: View, anchor: string): string {
  if (view === "day") return formatDate(anchor, { weekday: true });
  if (view === "month") return monthLabel(monthOf(anchor));
  const monday = mondayOf(anchor);
  return `${formatDate(monday)} – ${formatDate(addDays(monday, 6))}, ${monday.slice(0, 4)}`;
}

export function EventCalendar({ events, today }: { events: ProgramEvent[]; today: string }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);

  function move(by: number) {
    if (view === "day") setAnchor(addDays(anchor, by));
    else if (view === "week") setAnchor(addDays(anchor, by * 7));
    else setAnchor(`${shiftMonth(monthOf(anchor), by)}-01`);
  }

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    const monday = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [view, anchor]);

  const thisWeek = mondayOf(today);
  const eventsThisWeek = events.filter((e) => e.date >= thisWeek && e.date <= addDays(thisWeek, 6)).length;
  const nextDeadline = events.find((e) => !takesAttendance(e) && e.date >= today);

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#6677b0] to-[#4a5b94] p-4 text-white shadow-[0_24px_60px_-34px_rgb(30_45_90/0.8)] sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div role="radiogroup" aria-label="Calendar view" className="flex gap-1.5">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={view === id}
              onClick={() => setView(id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                view === id ? "bg-[#1b2b57] text-white" : "bg-white/15 text-white/85 hover:bg-white/25",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="text-xs text-white/75">Events this week</dt>
            <dd className="text-2xl font-semibold tabular-nums">{eventsThisWeek}</dd>
          </div>
          {nextDeadline && (
            <div className="border-l border-white/25 pl-8">
              <dt className="text-xs text-white/75">Next deadline</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {daysUntil(today, nextDeadline.date)}{" "}
                <span className="text-sm font-medium">days</span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="order-2 space-y-4 lg:order-1">
          <MiniMonth anchor={anchor} today={today} view={view} events={events} onPick={setAnchor} />
          <ComingUp events={events} today={today} />
          <Deadlines events={events} today={today} />
        </aside>

        <section className="order-1 min-w-0 rounded-2xl bg-white/15 p-2 sm:p-3 lg:order-2">
          <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-3">
            <h2 className="font-semibold">{rangeLabel(view, anchor)}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAnchor(today)}
                className="rounded-md px-2 py-0.5 text-sm font-medium underline underline-offset-4 hover:bg-white/15"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Previous"
                onClick={() => move(-1)}
                className="flex size-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => move(1)}
                className="flex size-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl bg-card text-card-foreground">
            {view === "month" ? (
              <MonthGrid month={monthOf(anchor)} events={events} today={today} />
            ) : (
              <TimeGrid days={days} events={events} today={today} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniMonth({
  anchor,
  today,
  view,
  events,
  onPick,
}: {
  anchor: string;
  today: string;
  view: View;
  events: ProgramEvent[];
  onPick: (day: string) => void;
}) {
  const [month, setMonth] = useState(monthOf(anchor));
  const [syncedAnchor, setSyncedAnchor] = useState(anchor);
  // Follow the big calendar when it moves to another month.
  if (anchor !== syncedAnchor) {
    setSyncedAnchor(anchor);
    setMonth(monthOf(anchor));
  }
  const selectedWeek = mondayOf(anchor);

  return (
    <div className="rounded-2xl bg-white/15 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{monthLabel(month)}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex size-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex size-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-white/75">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d.slice(0, 2)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
        {gridDays(month).map((day) => {
          const inWeek = view === "week" && mondayOf(day) === selectedWeek;
          const picked = view === "day" && day === anchor;
          const hasEvent = events.some((e) => onDay(e, day));
          return (
            <button
              key={day}
              type="button"
              aria-label={formatDate(day, { weekday: true })}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onPick(day)}
              className={cn(
                "relative flex h-7 items-center justify-center tabular-nums hover:bg-white/20",
                inWeek || picked ? "bg-white/20" : "rounded-full",
                inWeek && day === selectedWeek && "rounded-l-full",
                inWeek && day === addDays(selectedWeek, 6) && "rounded-r-full",
                picked && "rounded-full",
                monthOf(day) !== month && "text-white/50",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  day === today && "bg-white font-semibold text-[#1b2b57]",
                )}
              >
                {Number(day.slice(8))}
              </span>
              {hasEvent && day !== today && (
                <span className="absolute bottom-0.5 size-1 rounded-full bg-white/90" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SideList({ title, editHref, children }: { title: string; editHref?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3.5 text-card-foreground">
      <h3 className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold">
        {title}
        {editHref && (
          <Link href={editHref} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
            Edit
          </Link>
        )}
      </h3>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function ComingUp({ events, today }: { events: ProgramEvent[]; today: string }) {
  const coming = events.filter((e) => takesAttendance(e) && e.date >= today).slice(0, 3);
  return (
    <SideList title="Coming up">
      {coming.map((event) => (
        <li key={event.id}>
          <Link href={`/admin/events/${event.id}`} className="group block py-2 text-sm">
            <div className="truncate font-medium group-hover:underline">{event.title}</div>
            <div className="text-xs text-muted-foreground">
              {[formatDate(event.date, { weekday: true }), formatEventTime(event)].filter(Boolean).join(" · ")}
            </div>
          </Link>
        </li>
      ))}
      {coming.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nothing scheduled.</li>}
    </SideList>
  );
}

/** Every deadline in order; ones that have passed are ticked and crossed out. */
function Deadlines({ events, today }: { events: ProgramEvent[]; today: string }) {
  return (
    <SideList title="Deadlines" editHref="/admin/deadlines">
      {events
        .filter((e) => !takesAttendance(e))
        .map((event) => {
          const passed = event.date < today;
          return (
            <li key={event.id}>
              <Link href={`/admin/events/${event.id}`} className="group flex items-center gap-2.5 py-2 text-sm">
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                    passed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {passed && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "line-clamp-2 group-hover:underline",
                      passed && "text-muted-foreground line-through",
                    )}
                  >
                    {event.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{formatDate(event.date)}</span>
                </span>
              </Link>
            </li>
          );
        })}
    </SideList>
  );
}

/** Names in an event's host, leaving out groups like "CCP team". */
function hostPeople(event: ProgramEvent): string[] {
  return (event.host ?? "")
    .split(/,|&|\band\b/)
    .map((name) => name.trim())
    .filter((name) => name.includes(" ") && !/\b(team|organi[sz]ations?|partners?|staff)\b/i.test(name));
}

/** The people on an event, as overlapping circles with their initials. */
function People({ event }: { event: ProgramEvent }) {
  const people = hostPeople(event);
  if (people.length === 0) return null;
  return (
    <span className="flex shrink-0 -space-x-1.5" aria-label={`Hosted by ${people.join(", ")}`}>
      {people.slice(0, 3).map((name) => (
        <span
          key={name}
          title={name}
          className="flex size-6 items-center justify-center rounded-full bg-card text-[10px] font-semibold text-card-foreground ring-2 ring-primary"
        >
          {initials(name)}
        </span>
      ))}
    </span>
  );
}

/** Lays overlapping events side by side: each gets a lane, and shares the width. */
function withLanes(events: ProgramEvent[]) {
  const sorted = [...events].sort((a, b) => span(a).start - span(b).start);
  const laneEnds: number[] = [];
  const placed = sorted.map((event) => {
    const { start, end } = span(event);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    return { event, lane };
  });
  return placed.map((p) => ({ ...p, lanes: laneEnds.length }));
}

function TimeGrid({ days, events, today }: { days: string[]; events: ProgramEvent[]; today: string }) {
  const [now, setNow] = useState<number>();

  useEffect(() => {
    const tick = () => {
      const date = new Date();
      setNow(date.getHours() * 60 + date.getMinutes());
    };
    tick();
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);

  const shown = events.filter((e) => days.some((d) => onDay(e, d)));
  const timed = shown.filter(isTimed);
  const allDay = shown.filter((e) => !isTimed(e));
  // The working day, stretched to fit whatever is on this week.
  const firstHour = Math.min(9, ...timed.map((e) => Math.floor(span(e).start / 60)));
  const lastHour = Math.max(18, ...timed.map((e) => Math.ceil(span(e).end / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const columns = { gridTemplateColumns: `3.75rem repeat(${days.length}, minmax(0, 1fr))` };
  const nowTop = now !== undefined && now >= firstHour * 60 && now < lastHour * 60
    ? ((now - firstHour * 60) / 60) * HOUR_HEIGHT
    : undefined;

  return (
    <div className={cn(days.length > 1 && "min-w-[46rem]")}>
      <div className="grid border-b" style={columns}>
        <div />
        {days.map((day) => (
          <div key={day} className="border-l py-2.5 text-center first-of-type:border-l-0">
            <div className={cn("text-xl font-semibold tabular-nums", day !== today && "text-muted-foreground")}>
              {day.slice(8)}
            </div>
            <div className={cn("text-xs", day === today ? "font-semibold" : "text-muted-foreground")}>
              {WEEKDAYS[(new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7]}
            </div>
          </div>
        ))}
      </div>

      {allDay.length > 0 && (
        <div className="grid border-b" style={columns}>
          <div className="px-2 py-2 text-right text-[11px] text-muted-foreground">All day</div>
          {days.map((day) => (
            <div key={day} className="min-w-0 space-y-1 border-l p-1">
              {allDay
                .filter((e) => onDay(e, day))
                .map((event) => (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    title={event.title}
                    className="block truncate rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
                  >
                    {event.title}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid" style={columns}>
        <div>
          {hours.map((hour) => (
            <div key={hour} className="pr-2 pt-1 text-right text-[11px] text-muted-foreground" style={{ height: HOUR_HEIGHT }}>
              {hour % 12 || 12} {hour < 12 ? "AM" : "PM"}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="relative min-w-0 border-l" style={{ height: hours.length * HOUR_HEIGHT }}>
            {hours.slice(1).map((hour, i) => (
              <div key={hour} className="absolute inset-x-0 border-t" style={{ top: (i + 1) * HOUR_HEIGHT }} />
            ))}
            {withLanes(timed.filter((e) => e.date === day)).map(({ event, lane, lanes }) => {
              const { start, end } = span(event);
              return (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  title={event.title}
                  style={{
                    top: ((start - firstHour * 60) / 60) * HOUR_HEIGHT + 2,
                    height: Math.max(((end - start) / 60) * HOUR_HEIGHT - 4, MIN_BLOCK_HEIGHT),
                    left: `calc(${(lane / lanes) * 100}% + 3px)`,
                    width: `calc(${100 / lanes}% - 6px)`,
                  }}
                  className="absolute overflow-hidden rounded-xl bg-primary px-2 py-1.5 text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  <span className="flex items-start justify-between gap-1">
                    <span className="line-clamp-2 min-w-0 text-xs leading-snug font-semibold">{event.title}</span>
                    <People event={event} />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-primary-foreground/80">
                    {formatEventTime(event)}
                  </span>
                </Link>
              );
            })}
            {day === today && nowTop !== undefined && (
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-[#4a5b94]" style={{ top: nowTop }}>
                <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-[#4a5b94]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ month, events, today }: { month: string; events: ProgramEvent[]; today: string }) {
  return (
    <div className="min-w-[46rem]">
      <div className="grid grid-cols-7 border-b text-xs font-medium">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {gridDays(month).map((day, i) => (
          <div
            key={day}
            className={cn("min-h-28 min-w-0 border-b p-1.5", i % 7 !== 6 && "border-r", monthOf(day) !== month && "bg-muted/40")}
          >
            <div
              className={cn(
                "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                monthOf(day) !== month && "text-muted-foreground",
                day === today && "bg-primary text-primary-foreground",
              )}
            >
              {Number(day.slice(8))}
            </div>
            <div className="space-y-1">
              {events
                .filter((e) => onDay(e, day))
                .map((event) => (
                  <Link
                    key={event.id}
                    href={`/admin/events/${event.id}`}
                    title={event.title}
                    className="flex items-center justify-between gap-1 rounded-lg bg-primary px-2 py-1.5 text-primary-foreground hover:bg-primary/85"
                  >
                    <span className="line-clamp-3 min-w-0 text-xs leading-snug font-semibold break-words">
                      {event.title}
                    </span>
                    <People event={event} />
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
