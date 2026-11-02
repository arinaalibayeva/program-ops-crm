"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { bucketOf, worstBucket, type Bucket } from "@/lib/requirement-insights";
import { activeMembers } from "@/lib/requirements";
import { useCohort } from "@/lib/store";
import { addDays } from "@/lib/events";
import { partnersOf } from "@/lib/partners";
import { recordDate } from "@/lib/records";

/** One row per person who looks after teams: their workload and how it is going, in plain numbers. */
export function Interns() {
  const { data, teamStatuses, participantStatuses } = useCohort();
  const owners = data.staff.filter((s) =>
    data.teams.some((t) => t.ownerId === s.id),
  );
  if (owners.length === 0) return null;

  const partners = partnersOf(data);
  const weekAgo = addDays(data.today, -7);

  const rows = owners.map((staff) => {
    const teams = data.teams.filter((t) => t.ownerId === staff.id);
    const teamIds = new Set(teams.map((t) => t.id));
    // A team's own rules, plus any member who can't meet theirs.
    const buckets = teams.map((t) =>
      worstBucket(
        [
          ...(teamStatuses.get(t.id)?.results ?? []),
          ...(teamStatuses.get(t.id)?.ruleResults ?? []),
          ...activeMembers(data, t.id).flatMap(
            (e) => participantStatuses.get(e.id)?.results ?? [],
          ),
        ].map((r) => bucketOf(r.status)),
      ),
    );
    const count = (b: Bucket) => buckets.filter((x) => x === b).length;
    return {
      staff,
      teams: teams.length,
      people: teams.reduce((n, t) => n + activeMembers(data, t.id).length, 0),
      partners: partners.filter((p) => p.ownerId === staff.id).length,
      // Anything their teams logged for the last 7 days, by the date on the
      // record (a meeting's date), not the day someone typed it in.
      logged: data.records.filter(
        (r) =>
          recordDate(data, r) > weekAgo &&
          recordDate(data, r) <= data.today &&
          Object.values(r.values).some(
            (v) =>
              (typeof v === "string" && teamIds.has(v)) ||
              (Array.isArray(v) && v.some((x) => teamIds.has(String(x)))),
          ),
      ).length,
      followUps: data.notes.filter(
        (n) => n.author === staff.name && n.followUpDate && !n.followUpDone,
      ).length,
      missing: count("missing"),
      atRisk: count("at_risk"),
      ok: count("ok"),
    };
  });

  const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;

  // One short summary per intern, side by side. Which teams need what lives
  // in Needs attention below.
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Your interns</h2>
        <Link
          href="/admin/teams"
          className="text-xs font-medium text-ocean-600 hover:underline"
        >
          All teams
        </Link>
      </div>
      <ul className="grid divide-y border-t sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {rows.map((r) => (
          <li
            key={r.staff.id}
            className="space-y-1 py-3 text-[13px] leading-snug sm:px-4 sm:first:pl-0 lg:last:pr-0"
          >
            <Link
              href={`/admin/teams?owner=${r.staff.id}`}
              className="block text-sm font-semibold hover:underline"
            >
              {r.staff.name}
            </Link>
            <p>
              {plural(r.teams, "team")} · {plural(r.people, "person", "people")}{" "}
              ·{" "}
              <Link
                href={`/admin/partners?owner=${r.staff.id}`}
                className="hover:underline"
              >
                {plural(r.partners, "partner")}
              </Link>
            </p>
            <p>
              {r.logged} logged this week · {plural(r.followUps, "follow-up")}
            </p>
            <p>
              {r.missing > 0 && (
                <span className="font-semibold">
                  {r.missing} can&apos;t meet a rule ·{" "}
                </span>
              )}
              {r.atRisk > 0 && <>{r.atRisk} at risk · </>}
              {r.ok} on track
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
