"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { countedEvents, dueDateOf, ruleRows } from "@/lib/requirement-insights";
import { inProgramOn } from "@/lib/requirements";
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
}

/**
 * The two things the program runs on: people turning up to workshops, and
 * teams handing work in. One bar per workshop and per deadline that has
 * passed; what's next is already in Coming up.
 */
export function TermProgress() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const statuses = { participantStatuses, teamStatuses };

  // Every event an attendance rule counts.
  const counted = new Map<string, (typeof data.events)[number]>();
  for (const req of data.requirements)
    countedEvents(data, req).forEach((e) => counted.set(e.id, e));
  const workshops: Row[] = [...counted.values()]
    .filter((e) => e.date < data.today)
    .map((e) => {
      // Counted against who was in the program that day.
      const active = inProgramOn(data, e.date);
      return {
        id: e.id,
        href: `/admin/events/${e.id}`,
        label: e.title.split(":")[0],
        date: e.date,
        done: data.attendance.filter(
          (a) => a.eventId === e.id && active.has(a.enrollmentId),
        ).length,
        of: active.size,
      };
    });

  const handIns: Row[] = data.requirements.flatMap((req) => {
    const due = dueDateOf(req);
    if (!due || due >= data.today) return [];
    const rows = ruleRows(data, req, statuses);
    return [
      {
        id: req.id,
        href: `/admin/requirements?rule=${req.id}`,
        label: req.name.replace(/ Meeting Report$/, " report"),
        date: due,
        done: rows.filter((r) => r.result.status === "met").length,
        of: rows.length,
      },
    ];
  });

  return (
    <Card className="grid gap-5 rounded-2xl p-5 sm:grid-cols-2 md:col-span-2 xl:col-span-1 xl:grid-cols-1">
      <Section
        title="Workshop turnout"
        unit="people came"
        rows={recent(workshops)}
      />
      <Section title="Hand-ins" unit="teams in" rows={recent(handIns)} />
    </Card>
  );
}

/** The last few that happened, oldest first. */
function recent(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-PAST);
}

function Section({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: Row[];
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
                    <span className="font-semibold">{r.done}</span>
                    <span className="text-xs"> / {r.of}</span>
                  </span>
                </div>
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
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
