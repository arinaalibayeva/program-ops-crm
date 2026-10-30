"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { bucketOf, worstBucket, type Bucket } from "@/lib/requirement-insights";
import { activeMembers } from "@/lib/requirements";
import { useCohort } from "@/lib/store";

/** One row per person who looks after teams: how their teams are doing, in plain numbers. */
export function Interns() {
  const { data, teamStatuses, participantStatuses } = useCohort();
  const owners = data.staff.filter((s) =>
    data.teams.some((t) => t.ownerId === s.id),
  );
  if (owners.length === 0) return null;

  const rows = owners.map((staff) => {
    const teams = data.teams
      .filter((t) => t.ownerId === staff.id)
      .map((t) => {
        // A team's own rules, plus any member who can't meet theirs.
        const results = [
          ...[
            ...(teamStatuses.get(t.id)?.results ?? []),
            ...(teamStatuses.get(t.id)?.ruleResults ?? []),
          ].map((r) => ({ status: r.status, reason: r.reason, who: "" })),
          ...activeMembers(data, t.id).flatMap((e) =>
            (participantStatuses.get(e.id)?.results ?? []).map((r) => ({
              status: r.status,
              reason: r.reason,
              who: data.people.find((p) => p.id === e.personId)?.name ?? "",
            })),
          ),
        ].map((x) => ({ ...x, bucket: bucketOf(x.status) }));
        const bucket = worstBucket(results.map((x) => x.bucket));
        // The worst problem, to say why the team needs a look.
        const worst = results.find(
          (x) => x.bucket === bucket && bucket !== "ok",
        );
        const more = results.filter((x) => x.bucket !== "ok").length - 1;
        return {
          team: t,
          bucket,
          why: worst
            ? `${worst.who ? `${worst.who}: ` : ""}${worst.reason}${more > 0 ? ` (+${more} more)` : ""}`
            : "",
        };
      });
    const count = (b: Bucket) => teams.filter((t) => t.bucket === b).length;
    return {
      staff,
      teams,
      people: teams.reduce(
        (n, t) => n + activeMembers(data, t.team.id).length,
        0,
      ),
      missing: count("missing"),
      atRisk: count("at_risk"),
      ok: count("ok"),
      // Worst first, so the first name is the one to look at.
      toCheck: teams
        .filter((t) => t.bucket !== "ok")
        .sort(
          (a, b) =>
            (a.bucket === "missing" ? 0 : 1) - (b.bucket === "missing" ? 0 : 1),
        ),
    };
  });

  const th = "px-3 py-2 text-left text-xs font-semibold whitespace-nowrap";
  const num = "px-3 py-2.5 text-right tabular-nums";

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
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="border-b">
            <tr>
              {/* Narrow, fixed columns; the team list takes what's left. */}
              <th className={`${th} w-40`}>Intern</th>
              <th className={`${th} w-16 text-right`}>Teams</th>
              <th className={`${th} w-16 text-right`}>People</th>
              <th className={`${th} w-24 text-right`}>Can&apos;t meet</th>
              <th className={`${th} w-16 text-right`}>At risk</th>
              <th className={`${th} w-20 text-right`}>On track</th>
              <th className={`${th} pl-6`}>Teams to check, and why</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.staff.id} className="align-top">
                <td className="px-3 py-2.5">
                  <Link
                    href={`/admin/teams?owner=${r.staff.id}`}
                    className="font-medium hover:underline"
                  >
                    {r.staff.name}
                  </Link>
                </td>
                <td className={num}>{r.teams.length}</td>
                <td className={num}>{r.people}</td>
                <td className={`${num} ${r.missing ? "font-semibold" : ""}`}>
                  {r.missing}
                </td>
                <td className={num}>{r.atRisk}</td>
                <td className={num}>{r.ok}</td>
                <td className="py-2.5 pr-3 pl-6">
                  {r.toCheck.length === 0 ? (
                    "All on track"
                  ) : (
                    <ul className="space-y-1">
                      {r.toCheck.map(({ team, bucket, why }) => (
                        <li key={team.id} className="leading-snug">
                          <Link
                            href={`/admin/teams/${team.id}`}
                            className={`hover:underline ${bucket === "missing" ? "font-semibold" : "font-medium"}`}
                          >
                            {team.name}
                          </Link>
                          <span> · {why}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
