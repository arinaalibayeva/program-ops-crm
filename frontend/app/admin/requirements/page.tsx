"use client";

import { useCallback, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { NewRequirementDialog } from "@/components/requirements/new-requirement-dialog";
import { RuleDetail } from "@/components/requirements/rule-detail";
import { RuleList } from "@/components/requirements/rule-list";
import { RuleTimeline } from "@/components/requirements/rule-timeline";
import { SideCards } from "@/components/requirements/side-cards";
import { StatusChanges } from "@/components/requirements/status-changes";
import { cn } from "@/lib/utils";
import {
  problemScore,
  ruleRows,
  statusChanges,
  weeklyHistory,
  type SubjectRow,
} from "@/lib/requirement-insights";
import { useCohort } from "@/lib/store";
import { useUrlParam } from "@/lib/url-param";
import type { CohortData, Requirement } from "@/lib/types";

type Filter = "all" | "participant" | "team";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "participant", label: "Participant" },
  { value: "team", label: "Team" },
];

function exportCsv(
  data: CohortData,
  rules: Requirement[],
  rowsById: Map<string, SubjectRow[]>,
) {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const lines = [
    ["Rule", "Applies to", "Name", "Team", "Status", "Why"].join(","),
  ];
  for (const req of rules) {
    for (const r of rowsById.get(req.id) ?? []) {
      lines.push(
        [
          req.name,
          req.scope,
          r.name,
          r.teamName ?? "",
          r.result.status.replace("_", " "),
          r.result.reason,
        ]
          .map(quote)
          .join(","),
      );
    }
  }
  const url = URL.createObjectURL(
    new Blob([lines.join("\n")], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `requirements-${data.today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RequirementsPage() {
  const { data, participantStatuses, teamStatuses } = useCohort();
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<string>();
  // Calendar deadlines link here with ?rule=, opening that rule.
  useUrlParam(
    "rule",
    useCallback((id: string) => setPicked(id), []),
  );

  const statuses = useMemo(
    () => ({ participantStatuses, teamStatuses }),
    [participantStatuses, teamStatuses],
  );
  const rowsById = useMemo(
    () =>
      new Map(
        data.requirements.map((r) => [r.id, ruleRows(data, r, statuses)]),
      ),
    [data, statuses],
  );
  const history = useMemo(() => weeklyHistory(data), [data]);
  const changes = useMemo(() => statusChanges(data), [data]);

  const sorted = [...data.requirements].sort(
    (a, b) =>
      problemScore(rowsById.get(b.id) ?? []) -
      problemScore(rowsById.get(a.id) ?? []),
  );
  const shown = sorted.filter((r) => filter === "all" || r.scope === filter);
  const selected = shown.find((r) => r.id === picked) ?? shown[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Requirements"
        actions={
          <>
            <div
              className="flex rounded-lg bg-card p-0.5 ring-1 ring-border"
              role="group"
              aria-label="Show rules for"
            >
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    filter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={() => exportCsv(data, shown, rowsById)}
            >
              <Download /> Export
            </Button>
            <NewRequirementDialog />
          </>
        }
      />

      {/*
        The rules on the left; the chosen rule and its breakdown on the right.
        The right side sets the height; on wide screens the list scrolls
        inside it, so neither side leaves empty space.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] 2xl:grid-cols-[24.5rem_minmax(0,1fr)]">
        <div className="relative min-w-0 lg:min-h-[28rem]">
          <RuleList
            data={data}
            rules={shown}
            rowsById={rowsById}
            selectedId={selected?.id}
            onSelect={setPicked}
            className="lg:absolute lg:inset-0 lg:overflow-y-auto"
          />
        </div>
        {selected ? (
          <div className="flex min-w-0 flex-col gap-4">
            <RuleDetail
              data={data}
              req={selected}
              rows={rowsById.get(selected.id) ?? []}
            />
            <SideCards
              data={data}
              req={selected}
              rows={rowsById.get(selected.id) ?? []}
              history={history}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a requirement to see who meets it.
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <RuleTimeline
          data={data}
          rules={shown}
          rowsById={rowsById}
          onSelect={setPicked}
        />
        <StatusChanges data={data} changes={changes} />
      </div>
    </div>
  );
}
