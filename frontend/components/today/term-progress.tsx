"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import {
  countedEvents,
  dueDateOf,
  relativeDay,
  ruleRows,
} from "@/lib/requirement-insights";
import { useCohort } from "@/lib/store";

/** How many to show in each list: everything so far would get long by December. */
const PAST = 4;

interface Row {
  id: string;
  href: string;
  label: string;
  date: string;
  done: number;
  of: number;
  upcoming: boolean;
  /** For upcoming rows, what to say instead of a count. */
  note?: string;
}

/**
 * The two things the program runs on: people turning up to workshops, and
 * teams handing work in. One bar per workshop and per deadline, oldest first,
 * ending with what's next.
 */
export function TermProgress() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const statuses = { participantStatuses, teamStatuses };
  const active = new Set(
    data.enrollments.filter((e) => e.status === "active").map((e) => e.id),
  );

  // Every event an attendance rule counts, with how many must attend the next one.
  const mustAttend = new Map<string, number>();
  const counted = new Map<string, (typeof data.events)[number]>();
  for (const req of data.requirements) {
    const events = countedEvents(data, req);
    events.forEach((e) => counted.set(e.id, e));
    const next = events.find((e) => e.date >= data.today);
    if (next) {
      const n = ruleRows(data, req, statuses).filter(
        (r) => r.bucket === "at_risk",
      ).length;
      mustAttend.set(next.id, (mustAttend.get(next.id) ?? 0) + n);
    }
  }
  const workshops: Row[] = [...counted.values()].map((e) => {
    const upcoming = e.date >= data.today;
    const n = mustAttend.get(e.id);
    return {
      id: e.id,
      href: `/admin/events/${e.id}`,
      label: e.title.split(":")[0],
      date: e.date,
      done: upcoming
        ? 0
        : data.attendance.filter(
            (a) => a.eventId === e.id && active.has(a.enrollmentId),
          ).length,
      of: active.size,
      upcoming,
      note: n ? `${n} must attend` : undefined,
    };
  });

  const handIns: Row[] = data.requirements.flatMap((req) => {
    const due = dueDateOf(req);
    if (!due) return [];
    const rows = ruleRows(data, req, statuses);
    return [
      {
        id: req.id,
        href: `/admin/requirements?rule=${req.id}`,
        label: req.name.replace(/ Meeting Report$/, " report"),
        date: due,
        done: rows.filter((r) => r.result.status === "met").length,
        of: rows.length,
        upcoming: due >= data.today,
      },
    ];
  });

  return (
    <Card className="grid gap-5 rounded-2xl p-5 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
      <Section
        title="Workshop turnout"
        unit="people came"
        rows={recentAndNext(workshops)}
        today={data.today}
      />
      <Section
        title="Hand-ins"
        unit="teams in"
        rows={recentAndNext(handIns)}
        today={data.today}
      />
    </Card>
  );
}

/** The last few that happened, then the next one coming. */
function recentAndNext(rows: Row[]): Row[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const past = sorted.filter((r) => !r.upcoming).slice(-PAST);
  const next = sorted.find((r) => r.upcoming);
  return next ? [...past, next] : past;
}

function Section({
  title,
  unit,
  rows,
  today,
}: {
  title: string;
  unit: string;
  rows: Row[];
  today: string;
}) {
  return (
    <section className="min-w-0 space-y-2.5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 && <p className="text-sm">Nothing yet.</p>}
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const share = r.of ? r.done / r.of : 0;
          return (
            <li key={r.id}>
              <Link href={r.href} className="group block space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate font-medium group-hover:underline">
                    {r.label}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {r.upcoming ? (
                      <span className="text-xs">
                        {formatDate(r.date)} · {relativeDay(today, r.date)}
                      </span>
                    ) : (
                      <>
                        <span className="font-semibold">{r.done}</span>
                        <span className="text-xs"> / {r.of}</span>
                      </>
                    )}
                  </span>
                </div>
                {r.upcoming ? (
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full border border-dashed border-neutral-300" />
                    {r.note && (
                      <span className="shrink-0 text-xs font-semibold">
                        {r.note}
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className="h-2 overflow-hidden rounded-full bg-neutral-200"
                    role="img"
                    aria-label={`${r.done} of ${r.of} ${unit}`}
                  >
                    <div
                      className="h-full rounded-full bg-neutral-500"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
