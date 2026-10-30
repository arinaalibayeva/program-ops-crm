"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { partnersOf } from "@/lib/partners";
import { bucketOf, worstBucket } from "@/lib/requirement-insights";
import { activeMembers } from "@/lib/requirements";
import { useCohort } from "@/lib/store";

/** The people you manage, in a plain table, then everyone else on staff. */
export function InternsPanel({ you }: { you?: string }) {
  const { data, teamStatuses, participantStatuses } = useCohort();
  const partners = partnersOf(data);
  const interns = data.staff.filter(
    (s) => s.id !== you && data.teams.some((t) => t.ownerId === s.id),
  );
  const others = data.staff.filter((s) => s.id !== you && !interns.includes(s));

  const rows = interns.map((s) => {
    const teams = data.teams.filter((t) => t.ownerId === s.id);
    const toCheck = teams.filter((t) => {
      const buckets = [
        ...(teamStatuses.get(t.id)?.results ?? []),
        ...(teamStatuses.get(t.id)?.ruleResults ?? []),
        ...activeMembers(data, t.id).flatMap(
          (e) => participantStatuses.get(e.id)?.results ?? [],
        ),
      ].map((r) => bucketOf(r.status));
      return worstBucket(buckets) !== "ok";
    });
    return {
      staff: s,
      teams: teams.length,
      people: teams.reduce((n, t) => n + activeMembers(data, t.id).length, 0),
      partners: partners.filter((p) => p.ownerId === s.id).length,
      followUps: data.notes.filter(
        (n) => n.author === s.name && n.followUpDate && !n.followUpDone,
      ).length,
      toCheck,
    };
  });

  const th = "px-4 py-2.5 text-left text-xs font-semibold";
  const num = "px-4 py-3 text-right tabular-nums";

  return (
    <div className="min-w-0 space-y-5">
      <Card className="gap-0 p-0">
        <h2 className="px-4 pt-4 pb-2 font-semibold">Your interns</h2>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-sm">
            Nobody looks after teams yet. Invite someone from Team access, then
            assign them teams.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-y">
                <tr>
                  <th className={th}>Name</th>
                  <th className={`${th} text-right`}>Teams</th>
                  <th className={`${th} text-right`}>Participants</th>
                  <th className={`${th} text-right`}>Partners</th>
                  <th className={`${th} text-right`}>Open follow-ups</th>
                  <th className={th}>Teams to check</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.staff.id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.staff.name}</div>
                      <a
                        href={`mailto:${r.staff.email}`}
                        className="text-xs hover:underline"
                      >
                        {r.staff.email}
                      </a>
                    </td>
                    <td className={num}>
                      <Link
                        href={`/admin/teams?owner=${r.staff.id}`}
                        className="hover:underline"
                      >
                        {r.teams}
                      </Link>
                    </td>
                    <td className={num}>{r.people}</td>
                    <td className={num}>
                      <Link
                        href={`/admin/partners?owner=${r.staff.id}`}
                        className="hover:underline"
                      >
                        {r.partners}
                      </Link>
                    </td>
                    <td className={num}>{r.followUps}</td>
                    <td className="px-4 py-3">
                      {r.toCheck.length === 0
                        ? "None"
                        : r.toCheck.map((t, i) => (
                            <Fragment key={t.id}>
                              {i > 0 && ", "}
                              <Link
                                href={`/admin/teams/${t.id}`}
                                className="hover:underline"
                              >
                                {t.name}
                              </Link>
                            </Fragment>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {others.length > 0 && (
        <Card className="gap-0 p-0">
          <h2 className="px-4 pt-4 pb-2 font-semibold">Other staff</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y border-t">
              {others.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-medium">{s.name}</td>
                  <td className="px-4 py-2.5">{s.jobTitle ?? "Staff"}</td>
                  <td className="px-4 py-2.5">
                    <a href={`mailto:${s.email}`} className="hover:underline">
                      {s.email}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
