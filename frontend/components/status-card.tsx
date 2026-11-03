"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { useCohort } from "@/lib/store";
import type { Status, SubjectStatus } from "@/lib/types";

function Row({
  href,
  name,
  reason,
  status,
  children,
}: {
  href: string;
  name: string;
  reason: string;
  status: Status;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <Link href={href} className="text-sm font-medium hover:underline">
          {name}
        </Link>
        <div className="text-xs text-muted-foreground">{reason}</div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        <StatusBadge status={status} />
      </div>
    </li>
  );
}

/** Why a participant or team has the status it has, with a way to tick off what's done. */
export function StatusCard({
  subjectId,
  status,
}: {
  subjectId: string;
  status: SubjectStatus;
}) {
  const { data, toggleCompletion } = useCohort();
  const rules = status.ruleResults ?? [];
  const explained = new Set([
    ...status.results.map((r) => r.reason),
    ...rules.map((r) => r.reason),
  ]);
  // Worked out from the team's members rather than one requirement of its own.
  const others = status.flags.filter((flag) => !explained.has(flag));
  const empty =
    status.results.length === 0 && rules.length === 0 && others.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirements</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {empty ? (
          <p className="px-4 text-sm text-muted-foreground">
            Nothing to meet yet.{" "}
            <Link href="/admin/requirements" className="underline">
              Add a requirement
            </Link>
          </p>
        ) : (
          <ul className="divide-y">
            {status.results.map((result) => {
              const req = data.requirements.find(
                (r) => r.id === result.requirementId,
              );
              if (!req) return null;
              const done = data.completions.some(
                (c) => c.requirementId === req.id && c.subjectId === subjectId,
              );
              return (
                <Row
                  key={req.id}
                  href={`/admin/requirements/${req.id}`}
                  name={req.name}
                  reason={result.reason}
                  status={result.status}
                >
                  {/* One control: mark it done, or take it back if it was ticked by mistake. */}
                  {req.type === "complete_by" &&
                    !result.excused &&
                    (done ? (
                      <button
                        type="button"
                        onClick={() => toggleCompletion(req.id, subjectId)}
                        className="text-xs underline-offset-2 hover:underline"
                      >
                        Undo
                      </button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => toggleCompletion(req.id, subjectId)}
                      >
                        Mark done
                      </Button>
                    ))}
                </Row>
              );
            })}
            {rules.map((rule) => {
              const calculationId = data.rules.find(
                (r) => r.id === rule.ruleId,
              )?.calculationId;
              return (
                <Row
                  key={rule.ruleId}
                  href={`/admin/requirements/${rule.ruleId}`}
                  name={
                    data.calculations.find((c) => c.id === calculationId)
                      ?.label ?? "Flag"
                  }
                  reason={rule.reason}
                  status={rule.status}
                />
              );
            })}
            {others.map((flag) => (
              <li key={flag} className="px-4 py-2.5 text-sm">
                {flag}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
