"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { Mail, MoreHorizontal, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { linkedIds, matches, targetHref } from "@/lib/records";
import {
  countedEvents,
  relativeDay,
  type SubjectRow,
} from "@/lib/requirement-insights";
import { activeMembers, inProgramOn } from "@/lib/requirements";
import { staffName } from "@/lib/staff";
import { useCohort } from "@/lib/store";
import type { CohortData, Requirement } from "@/lib/types";
import { EditRequirementDialog } from "./edit-requirement-dialog";
import { CHIP, LABEL, Pill } from "./status-styles";

function emailsFor(
  data: CohortData,
  req: Requirement,
  rows: SubjectRow[],
): string[] {
  const enrollmentIds =
    req.scope === "participant"
      ? rows.map((r) => r.id)
      : rows.flatMap((r) => activeMembers(data, r.id).map((e) => e.id));
  return enrollmentIds.flatMap((id) => {
    const personId = data.enrollments.find((e) => e.id === id)?.personId;
    const email = data.people.find((p) => p.id === personId)?.email;
    return email ? [email] : [];
  });
}

function mailto(req: Requirement, emails: string[], note?: string): string {
  const subject = encodeURIComponent(`Reminder: ${req.name}`);
  const body = note ? `&body=${encodeURIComponent(note)}` : "";
  return emails.length === 1
    ? `mailto:${emails[0]}?subject=${subject}${body}`
    : `mailto:?bcc=${emails.join(",")}&subject=${subject}${body}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

export function RuleDetail({
  data,
  req,
  rows,
}: {
  data: CohortData;
  req: Requirement;
  rows: SubjectRow[];
}) {
  const router = useRouter();
  const { deleteRequirement, toggleCompletion, addNudge } = useCohort();
  // When each person or team was last reminded about this rule.
  const lastNudge = new Map<string, string>();
  for (const n of data.nudges ?? []) {
    if (n.requirementId !== req.id) continue;
    if ((lastNudge.get(n.subjectId) ?? "") < n.sentOn)
      lastNudge.set(n.subjectId, n.sentOn);
  }
  const [editing, setEditing] = useState(false);
  const affected = rows.filter((r) => r.bucket !== "ok");
  const allEmails = emailsFor(data, req, affected);

  return (
    <Card className="gap-4 rounded-2xl px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{req.name}</h2>
          <span className="text-xs">
            {req.scope === "participant" ? "Participant rule" : "Team rule"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Edit
          </Button>
          <EditRequirementDialog
            req={req}
            open={editing}
            onOpenChange={setEditing}
          />
          <Menu.Root>
            <Menu.Trigger
              render={
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`More for ${req.name}`}
                />
              }
            >
              <MoreHorizontal />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={4} align="end" className="z-50">
                <Menu.Popup className="min-w-40 rounded-xl bg-popover p-1 text-sm shadow-lg ring-1 ring-border">
                  <Menu.Item
                    className="cursor-default rounded-lg px-2.5 py-1.5 data-highlighted:bg-muted"
                    onClick={() => router.push(`/admin/requirements/${req.id}`)}
                  >
                    Open full list
                  </Menu.Item>
                  <Menu.Item
                    className="cursor-default rounded-lg px-2.5 py-1.5 text-destructive data-highlighted:bg-red-50"
                    onClick={() => {
                      if (confirm(`Delete "${req.name}"?`))
                        deleteRequirement(req.id);
                    }}
                  >
                    Delete rule
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Who&apos;s affected · {affected.length}</SectionLabel>
          {allEmails.length > 0 && (
            <a
              href={mailto(req, allEmails)}
              onClick={() => affected.forEach((r) => addNudge(r.id, req.id))}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Mail /> Nudge all {affected.length}
            </a>
          )}
        </div>
        {affected.length === 0 ? (
          <p className="text-sm text-ocean-700">
            ✓ Nobody needs attention for this rule.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-1 pb-1 font-medium">Name</th>
                  {req.scope === "participant" && (
                    <th className="px-1 pb-1 font-medium">Team</th>
                  )}
                  <th className="px-1 pb-1 font-medium">Why</th>
                  <th className="px-1 pb-1 font-medium">Status</th>
                  <th className="px-1 pb-1 font-medium">Owner</th>
                  <th className="px-1 pb-1" />
                </tr>
              </thead>
              <tbody>
                {affected.map((r) => {
                  const emails = emailsFor(data, req, [r]);
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-1 py-1.5 font-medium whitespace-nowrap">
                        <Link
                          href={targetHref(req.scope, r.id)}
                          className="hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      {req.scope === "participant" && (
                        <td className="px-1 py-1.5 whitespace-nowrap text-muted-foreground">
                          {r.teamName ?? "No team"}
                        </td>
                      )}
                      <td className="px-1 py-1.5 text-muted-foreground">
                        {r.result.reason}
                      </td>
                      <td className="px-1 py-1.5">
                        <Pill bucket={r.bucket}>{LABEL[r.bucket]}</Pill>
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap text-muted-foreground">
                        {r.ownerId
                          ? staffName(data, r.ownerId).split(" ")[0]
                          : "—"}
                      </td>
                      <td className="px-1 py-1.5 text-right whitespace-nowrap">
                        {req.type === "complete_by" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => toggleCompletion(req.id, r.id)}
                          >
                            Mark done
                          </Button>
                        ) : (
                          emails.length > 0 && (
                            <span className="inline-flex items-center gap-2">
                              {lastNudge.has(r.id) && (
                                <span className="text-xs">
                                  Reminder opened {formatDate(lastNudge.get(r.id)!)}
                                </span>
                              )}
                              <a
                                href={mailto(req, emails, r.result.reason)}
                                onClick={() => addNudge(r.id, req.id)}
                                className={buttonVariants({
                                  size: "xs",
                                  variant: "outline",
                                })}
                              >
                                {lastNudge.has(r.id) ? "Again" : "Nudge"}
                              </a>
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Counted data={data} req={req} rows={rows} />
    </Card>
  );
}

/** What the rule looks at: events for attendance, hand-ins for deadlines, sizes for teams. */
function Counted({
  data,
  req,
  rows,
}: {
  data: CohortData;
  req: Requirement;
  rows: SubjectRow[];
}) {
  if (req.type === "attendance_min") {
    const events = countedEvents(data, req);
    const next = events.find((e) => e.date >= data.today);
    const mustAttend = rows.filter((r) => r.bucket === "at_risk").length;
    return (
      <div className="space-y-2">
        <SectionLabel>Events this rule counts</SectionLabel>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
          {events.map((e) => {
            const upcoming = e.date >= data.today;
            // Counted against who was in the program that day.
            const active = inProgramOn(data, upcoming ? data.today : e.date);
            const came = data.attendance.filter(
              (a) => a.eventId === e.id && active.has(a.enrollmentId),
            ).length;
            return (
              <div
                key={e.id}
                className={cn(
                  "space-y-1 rounded-xl px-3 py-2",
                  upcoming
                    ? "border border-dashed border-ocean-300"
                    : "bg-ocean-50",
                )}
              >
                <div
                  className="truncate text-[13px] font-semibold"
                  title={e.title}
                >
                  {e.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(e.date, { weekday: true })}
                </div>
                {upcoming ? (
                  <div className="text-xs text-muted-foreground">
                    {relativeDay(data.today, e.date)}
                    {e.id === next?.id && mustAttend > 0 && (
                      <span className="font-medium text-ocean-700">
                        {" "}
                        · {mustAttend} must attend
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {came} of {active.size} came
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ocean-100">
                      <div
                        className="h-full bg-ocean-600"
                        style={{
                          width: `${(came / Math.max(active.size, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (req.type === "team_min_size") {
    const sizes = data.teams
      .map((t) => ({
        id: t.id,
        name: t.name,
        n: activeMembers(data, t.id).length,
      }))
      .sort((a, b) => a.n - b.n || a.name.localeCompare(b.name));
    return (
      <div className="space-y-2">
        <SectionLabel>Active members per team</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((t) => (
            <span
              key={t.id}
              className={cn(
                "rounded-md bg-muted px-2 py-0.5 text-xs",
                t.n < req.params.minActive && CHIP.missing,
              )}
            >
              {t.name} <span className="font-semibold tabular-nums">{t.n}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Deadlines: who handed in, and when.
  const dateFor = (subjectId: string): string | undefined => {
    if (req.type === "complete_by") {
      return data.completions.find(
        (x) => x.requirementId === req.id && x.subjectId === subjectId,
      )?.completedAt;
    }
    const { typeId, viaFieldId, dateFieldId, filter } = req.params;
    const dates = data.records
      .filter(
        (r) =>
          r.typeId === typeId &&
          linkedIds(r.values[viaFieldId]).includes(subjectId) &&
          (!filter || matches(data, r, filter)),
      )
      .map((r) => {
        const v = dateFieldId ? r.values[dateFieldId] : undefined;
        return typeof v === "string" && v ? v : r.createdAt.slice(0, 10);
      })
      .sort();
    return dates[0];
  };
  const submitted = rows.filter(
    (r) => r.result.status === "met" && !r.result.excused,
  );
  const waiting = rows.filter((r) => r.result.status !== "met");

  return (
    <div className="space-y-2">
      <SectionLabel>
        Handed in · {submitted.length} of {rows.length}
      </SectionLabel>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
        {waiting.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-md bg-muted px-2.5 py-1 text-xs",
              CHIP[r.bucket],
            )}
          >
            <span className="font-semibold">{r.name}</span> ·{" "}
            {r.bucket === "missing" ? "missed" : "not in yet"}
          </div>
        ))}
        {submitted
          .map((r) => ({ r, date: dateFor(r.id) }))
          .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
          .map(({ r, date }) => (
            <div
              key={r.id}
              className="rounded-lg bg-ocean-50 px-2.5 py-1 text-xs"
            >
              <span className="font-semibold">{r.name}</span>
              {date && (
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDate(date)}
                </span>
              )}
              {date && date > req.params.dueDate && (
                <span className="font-medium text-ocean-700"> late</span>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
