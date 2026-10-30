"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  describeRule,
  linkLabel,
  ruleMatches,
  targetHref,
  targetName,
  typeById,
} from "@/lib/records";
import { describeRequirement } from "@/lib/requirements";
import { useCohort } from "@/lib/store";
import type { Requirement, Rule, Status } from "@/lib/types";

const SEVERITY: Record<Status, number> = {
  missing: 0,
  at_risk: 1,
  on_track: 2,
  met: 3,
};

export default function RequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data } = useCohort();
  const requirement = data.requirements.find((r) => r.id === id);
  const rule = data.rules.find((r) => r.id === id);

  return (
    <>
      <Link
        href="/admin/requirements"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Requirements
      </Link>
      {requirement ? (
        <RequirementDetail requirement={requirement} />
      ) : rule ? (
        <RuleDetail rule={rule} />
      ) : (
        <p className="text-muted-foreground">Requirement not found.</p>
      )}
    </>
  );
}

function RequirementDetail({ requirement: req }: { requirement: Requirement }) {
  const { data, participantStatuses, teamStatuses, toggleCompletion } =
    useCohort();
  const statuses =
    req.scope === "participant" ? participantStatuses : teamStatuses;
  const rows = [...statuses]
    .flatMap(([id, status]) => {
      const result = status.results.find((r) => r.requirementId === req.id);
      return result
        ? [{ id, result, label: linkLabel(data, req.scope, id) }]
        : [];
    })
    .sort(
      (a, b) =>
        SEVERITY[a.result.status] - SEVERITY[b.result.status] ||
        a.label.localeCompare(b.label),
    );

  return (
    <>
      <PageHeader
        title={req.name}
        description={describeRequirement(req, data)}
        actions={
          req.type === "record_by" && (
            <Link
              href={`/admin/records/${req.params.typeId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              See{" "}
              {typeById(data, req.params.typeId)?.name.toLowerCase() ??
                "records"}
            </Link>
          )
        }
      />
      <Card className="py-0">
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nobody to check yet.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ id, result, label }) => {
                const done = data.completions.some(
                  (c) => c.requirementId === req.id && c.subjectId === id,
                );
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-4 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={targetHref(req.scope, id)}
                        className="text-sm font-medium hover:underline"
                      >
                        {label}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {result.reason}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {req.type === "complete_by" && !result.excused && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={done}
                            onCheckedChange={() => toggleCompletion(req.id, id)}
                            aria-label={`${req.name} done for ${label}`}
                          />
                          {!done && "Mark done"}
                        </label>
                      )}
                      <StatusBadge status={result.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function RuleDetail({ rule }: { rule: Rule }) {
  const { data } = useCohort();
  const calc = data.calculations.find((c) => c.id === rule.calculationId);
  const flagged = ruleMatches(data, rule);

  return (
    <>
      <PageHeader
        title={rule.message}
        description={`${describeRule(rule, calc)}${calc ? ` · ${targetName(data, calc.on)}` : ""}`}
        actions={
          calc && (
            <Link
              href={`/admin/customize/${calc.sourceTypeId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Change this flag
            </Link>
          )
        }
      />
      <Card className="py-0">
        <CardContent className="px-0">
          {flagged.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Nothing is flagged right now.
            </p>
          ) : (
            <ul className="divide-y">
              {flagged.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <Link
                    href={row.href}
                    className="min-w-0 text-sm font-medium hover:underline"
                  >
                    {row.label}
                  </Link>
                  <StatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
