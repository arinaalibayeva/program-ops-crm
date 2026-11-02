"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bucketOf, ruleRows, type Bucket } from "@/lib/requirement-insights";
import { activeMembers } from "@/lib/requirements";
import { staffName } from "@/lib/staff";
import { useCohort } from "@/lib/store";
import type { CohortData, Requirement } from "@/lib/types";
import { Pill, LABEL } from "@/components/requirements/status-styles";

const SHOWN = 8;

interface Problem {
  key: string;
  bucket: Bucket;
  /** Who it's about, when that isn't the team itself. */
  person?: string;
  reason: string;
  req?: Requirement;
  subjectId: string;
  emails: string[];
}

function emailOf(data: CohortData, enrollmentId: string): string | undefined {
  const personId = data.enrollments.find(
    (e) => e.id === enrollmentId,
  )?.personId;
  return data.people.find((p) => p.id === personId)?.email;
}

/** Every problem the rules found, grouped by team, worst teams first, each with a next step. */
export function Attention({ className }: { className?: string }) {
  const {
    data,
    participantStatuses,
    teamStatuses,
    toggleCompletion,
    addNudge,
  } = useCohort();
  // The latest reminder for each problem, so it shows "Reminder opened Oct 17".
  const lastNudge = new Map<string, string>();
  for (const n of data.nudges ?? []) {
    const key = `${n.requirementId ?? ""}:${n.subjectId}`;
    if ((lastNudge.get(key) ?? "") < n.sentOn) lastNudge.set(key, n.sentOn);
  }
  const [showAll, setShowAll] = useState(false);
  const statuses = { participantStatuses, teamStatuses };

  const byTeam = new Map<string, Problem[]>();
  const add = (teamId: string | undefined, p: Problem) => {
    if (!teamId) return;
    byTeam.set(teamId, [...(byTeam.get(teamId) ?? []), p]);
  };
  for (const req of data.requirements) {
    for (const row of ruleRows(data, req, statuses)) {
      if (row.bucket === "ok") continue;
      const teamEmails = activeMembers(data, row.teamId ?? "").flatMap(
        (e) => emailOf(data, e.id) ?? [],
      );
      add(row.teamId, {
        key: `${req.id}-${row.id}`,
        bucket: row.bucket,
        person: req.scope === "participant" ? row.name : undefined,
        reason: row.result.reason,
        req,
        subjectId: row.id,
        emails:
          req.scope === "participant"
            ? [emailOf(data, row.id) ?? ""].filter(Boolean)
            : teamEmails,
      });
    }
  }
  // Flags from tracked numbers, like "No partner meeting in over 2 weeks".
  for (const [teamId, s] of teamStatuses) {
    for (const r of s.ruleResults ?? []) {
      add(teamId, {
        key: `${r.ruleId}-${teamId}`,
        bucket: bucketOf(r.status),
        reason: r.reason,
        subjectId: teamId,
        emails: activeMembers(data, teamId).flatMap(
          (e) => emailOf(data, e.id) ?? [],
        ),
      });
    }
  }

  const nudged = (p: Problem) =>
    lastNudge.get(`${p.req?.id ?? ""}:${p.subjectId}`);

  const teams = [...byTeam]
    .map(([teamId, problems]) => ({
      team: data.teams.find((t) => t.id === teamId)!,
      problems: problems.sort((a, b) => rank(a.bucket) - rank(b.bucket)),
    }))
    .filter((t) => t.team)
    .sort(
      (a, b) =>
        rank(a.problems[0].bucket) - rank(b.problems[0].bucket) ||
        b.problems.length - a.problems.length ||
        a.team.name.localeCompare(b.team.name),
    );
  const shown = showAll ? teams : teams.slice(0, SHOWN);

  return (
    <Card className={cn("gap-1 rounded-2xl px-5", className)}>
      <div className="flex items-baseline justify-between gap-2 pb-2">
        <h2 className="font-semibold">Needs attention</h2>
        <span className="text-xs text-muted-foreground">
          {teams.length} teams
        </span>
      </div>
      {teams.length === 0 && (
        <p className="text-sm text-ocean-700">✓ Every team is on track.</p>
      )}
      <ul className="space-y-2">
        {shown.map(({ team, problems }) => (
          <li key={team.id} className="rounded-xl bg-muted px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                href={`/admin/teams/${team.id}`}
                className="text-sm font-semibold hover:underline"
              >
                Team {team.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {staffName(data, team.ownerId).split(" ")[0]}
              </span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {problems.map((p) => (
                <li
                  key={p.key}
                  className="flex items-baseline gap-2 text-[13px]"
                >
                  <span className="w-20 shrink-0">
                    <Pill bucket={p.bucket}>{LABEL[p.bucket]}</Pill>
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.person && (
                      <span className="font-medium">{p.person}: </span>
                    )}
                    <span className="text-muted-foreground">{p.reason}</span>
                  </span>
                  {p.req?.type === "complete_by" ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => toggleCompletion(p.req!.id, p.subjectId)}
                    >
                      Mark done
                    </Button>
                  ) : p.emails.length > 0 ? (
                    <span className="flex shrink-0 items-center gap-2">
                      {nudged(p) && (
                        <span className="text-xs whitespace-nowrap">
                          Reminder opened {formatDate(nudged(p)!)}
                        </span>
                      )}
                      <a
                        href={`mailto:${p.emails.length === 1 ? p.emails[0] : `?bcc=${p.emails.join(",")}`}${
                          p.emails.length === 1 ? "?" : "&"
                        }subject=${encodeURIComponent(`Reminder: ${p.req?.name ?? "CCP"}`)}&body=${encodeURIComponent(p.reason)}`}
                        onClick={() => addNudge(p.subjectId, p.req?.id)}
                        className={buttonVariants({
                          size: "xs",
                          variant: "outline",
                        })}
                      >
                        {nudged(p) ? "Nudge again" : "Nudge"}
                      </a>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {teams.length > SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="pt-2 text-left text-xs font-medium text-ocean-600 hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${teams.length} teams`}
        </button>
      )}
    </Card>
  );
}

function rank(b: Bucket): number {
  return b === "missing" ? 0 : b === "at_risk" ? 1 : 2;
}
