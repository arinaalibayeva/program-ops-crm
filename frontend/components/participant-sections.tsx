"use client";

// The parts of a participant's profile, shared by their page and the side
// panel on the Participants list.

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FieldInput } from "@/components/field-input";
import { NativeSelect } from "@/components/native-select";
import { StatusBadge } from "@/components/status-badge";
import { StatusCard } from "@/components/status-card";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { EVENT_CATEGORY_LABELS, takesAttendance } from "@/lib/events";
import { activeFields, formatFieldValue } from "@/lib/fields";
import { formatDate } from "@/lib/format";
import type { ParticipantDraft } from "@/lib/participant-draft";
import { partnerOfTeam } from "@/lib/partners";
import { evaluateRules, incomingLinks, withRules } from "@/lib/records";
import { attendanceSummary, currentTeamId, participantStatus } from "@/lib/requirements";
import { staffName } from "@/lib/staff";
import { useCohort } from "@/lib/store";
import type { CohortData, Enrollment } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Requirements and flags together, so this page agrees with Today. */
export function fullStatus(view: CohortData, enrollmentId: string) {
  return withRules(participantStatus(view, enrollmentId), evaluateRules(view, "participant", enrollmentId));
}

/** What each section needs. `draft` is only set in edit mode. */
export interface SectionProps {
  view: CohortData;
  enrollment: Enrollment;
  draft?: ParticipantDraft;
  update: (patch: Partial<ParticipantDraft>) => void;
}

export function RequirementsSection({ view, enrollment, draft, update }: SectionProps) {
  if (enrollment.status !== "active") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Withdrawn participants aren&apos;t tracked.</p>
        </CardContent>
      </Card>
    );
  }
  const status = fullStatus(view, enrollment.id);
  if (!draft) return <StatusCard subjectId={enrollment.id} status={status} />;

  function setCompleted(requirementId: string, date: string | undefined) {
    const completions = { ...draft!.completions };
    if (date) completions[requirementId] = date;
    else delete completions[requirementId];
    update({ completions });
  }

  function setExcused(requirementId: string, reason: string | undefined) {
    const exemptions = { ...draft!.exemptions };
    if (reason === undefined) delete exemptions[requirementId];
    else exemptions[requirementId] = reason;
    update({ exemptions });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirements</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {view.requirements
            .filter((r) => r.scope === "participant")
            .map((req) => {
              const result = status.results.find((r) => r.requirementId === req.id);
              const completedAt = draft.completions[req.id];
              const reason = draft.exemptions[req.id];
              return (
                <li key={req.id} className="space-y-2 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{req.name}</div>
                      <div className="text-xs text-muted-foreground">{result?.reason}</div>
                    </div>
                    {result && <StatusBadge status={result.status} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    {req.type === "complete_by" && (
                      <label className="flex items-center gap-1.5">
                        <Checkbox
                          checked={!!completedAt}
                          onCheckedChange={() => setCompleted(req.id, completedAt ? undefined : view.today)}
                        />
                        Done
                      </label>
                    )}
                    {req.type === "complete_by" && completedAt && (
                      <Input
                        type="date"
                        aria-label={`${req.name} done on`}
                        value={completedAt}
                        onChange={(e) => setCompleted(req.id, e.target.value || undefined)}
                        className="h-7 w-36"
                      />
                    )}
                    <label className="flex items-center gap-1.5">
                      <Checkbox
                        checked={reason !== undefined}
                        onCheckedChange={() => setExcused(req.id, reason === undefined ? "" : undefined)}
                      />
                      Excused
                    </label>
                    {reason !== undefined && (
                      <Input
                        aria-label={`Why ${req.name} is excused`}
                        placeholder="Why (optional)"
                        value={reason}
                        onChange={(e) => setExcused(req.id, e.target.value)}
                        className="h-7 w-48"
                      />
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AttendanceSection({ view, enrollment, draft, update }: SectionProps) {
  const { toggleAttendance } = useCohort();
  const attended = new Set(
    view.attendance.filter((a) => a.enrollmentId === enrollment.id).map((a) => a.eventId),
  );
  const summary = attendanceSummary(view, enrollment.id);
  // Today's events can be recorded while editing; future ones can't.
  const events = view.events.filter(takesAttendance);
  const recordable = events.filter((e) => e.date <= view.today);

  function toggle(eventId: string) {
    if (!draft) return;
    const ids = new Set(draft.attendedEventIds);
    if (ids.has(eventId)) ids.delete(eventId);
    else ids.add(eventId);
    update({ attendedEventIds: [...ids] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Attendance</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Attended {summary.attended} of {summary.total} events so far
          </p>
        </div>
        {draft && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => update({ attendedEventIds: recordable.map((e) => e.id) })}
            >
              Select all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => update({ attendedEventIds: [] })}>
              Clear
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {events.map((event) => {
            const isFuture = event.date > view.today;
            const isUpcoming = event.date >= view.today;
            const didAttend = attended.has(event.id);
            const details = (
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {draft ? (
                    event.title
                  ) : (
                    <Link href={`/admin/events/${event.id}`} className="hover:underline">
                      {event.title}
                    </Link>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(event.date, { weekday: true })} · {EVENT_CATEGORY_LABELS[event.category]}
                </div>
              </div>
            );

            if (draft) {
              return (
                <li key={event.id}>
                  <label
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5",
                      isFuture ? "opacity-50" : "cursor-pointer hover:bg-muted/50",
                    )}
                  >
                    <Checkbox
                      checked={didAttend}
                      disabled={isFuture}
                      onCheckedChange={() => toggle(event.id)}
                    />
                    {details}
                    {isFuture && (
                      <span className="text-xs text-muted-foreground">Hasn&apos;t happened yet</span>
                    )}
                  </label>
                </li>
              );
            }

            return (
              <li
                key={event.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  isUpcoming && "text-muted-foreground",
                )}
              >
                {details}
                {isUpcoming ? (
                  <span className="text-xs">Upcoming</span>
                ) : (
                  // Quick edit outside edit mode: saved as soon as it's clicked.
                  <div
                    role="radiogroup"
                    aria-label={`Attendance for ${event.title}`}
                    className="inline-flex rounded-md border p-0.5 text-xs"
                  >
                    {[true, false].map((present) => {
                      const selected = present === didAttend;
                      return (
                        <button
                          key={String(present)}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => !selected && toggleAttendance(event.id, enrollment.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded px-2 py-0.5 transition-colors",
                            selected
                              ? "bg-muted font-medium text-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {!present && selected && (
                            <span className="size-1.5 rounded-full bg-red-500" />
                          )}
                          {present ? "Present" : "Absent"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ProfileSection({ view, enrollment, draft, update }: SectionProps) {
  const fields = activeFields(view);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {draft ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="profile-name" className="text-xs text-muted-foreground">
                Name *
              </label>
              <Input
                id="profile-name"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="profile-email" className="text-xs text-muted-foreground">
                Email *
              </label>
              <Input
                id="profile-email"
                type="email"
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            </div>
            {fields.map((f) => (
              <div key={f.id} className="space-y-1">
                <label htmlFor={`profile-${f.id}`} className="text-xs text-muted-foreground">
                  {f.label}
                  {f.required && " *"}
                </label>
                <FieldInput
                  id={`profile-${f.id}`}
                  field={f}
                  value={draft.fields[f.id]}
                  onChange={(v) => update({ fields: { ...draft.fields, [f.id]: v } })}
                />
              </div>
            ))}
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No profile fields yet.{" "}
            <Link href="/admin/participants/fields" className="underline">
              Add fields
            </Link>
          </p>
        ) : (
          <dl className="space-y-2.5">
            {fields.map((f) => {
              const value = enrollment.fields?.[f.id];
              return (
                <div key={f.id}>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="text-sm break-words whitespace-pre-wrap">
                    {/* Only link http(s) so a pasted "javascript:" value can't run. */}
                    {f.type === "url" && typeof value === "string" && /^https?:\/\//i.test(value) ? (
                      <a href={value} target="_blank" rel="noreferrer" className="underline">
                        {value}
                      </a>
                    ) : (
                      formatFieldValue(f, value)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamSection({ view, enrollment, draft, update }: SectionProps) {
  const teamId = currentTeamId(view, enrollment.id);
  const team = view.teams.find((t) => t.id === teamId);
  const project = view.projects.find((p) => p.id === team?.projectId);
  const partner = team && partnerOfTeam(view, team);
  const history = view.memberships
    .filter((m) => m.enrollmentId === enrollment.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft && enrollment.status === "active" ? (
          <NativeSelect
            aria-label="Team"
            value={draft.teamId ?? ""}
            onChange={(e) => update({ teamId: e.target.value || undefined })}
            className="w-full"
          >
            <option value="">No team</option>
            {view.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        ) : team ? (
          <div>
            <Link href={`/admin/teams/${team.id}`} className="font-medium hover:underline">
              Team {team.name}
            </Link>
            <div className="text-xs text-muted-foreground">Assigned to {staffName(view, team.ownerId)}</div>
            {project && (
              <div className="text-xs text-muted-foreground">
                {project.title}
                {partner && (
                  <>
                    {" · "}
                    <Link href={`/admin/partners/${partner.id}`} className="hover:text-foreground hover:underline">
                      {partner.name}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not on a team.</p>
        )}
        {history.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">Team history</div>
            <ol className="space-y-1.5 border-l pl-3">
              {history.map((m) => (
                <li key={m.teamId + m.startDate} className="text-xs">
                  <Link href={`/admin/teams/${m.teamId}`} className="font-medium hover:underline">
                    {view.teams.find((t) => t.id === m.teamId)?.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    {formatDate(m.startDate)} – {m.endDate ? formatDate(m.endDate) : "now"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Calculations on this participant, and records of each type that link to them. */
export function RecordsSection({ enrollmentId }: { enrollmentId: string }) {
  const { data } = useCohort();
  const empty =
    incomingLinks(data, "participant").length === 0 && !data.calculations.some((c) => c.on === "participant");
  if (empty) {
    return (
      <Card className="border-dashed bg-transparent shadow-none">
        <CardContent className="text-xs text-muted-foreground">
          No record types link to participants yet. Add a link field in{" "}
          <Link href="/admin/customize" className="underline">
            Customize
          </Link>
          .
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <TrackedNumbers on="participant" id={enrollmentId} />
      <LinkedRecords target="participant" id={enrollmentId} />
    </div>
  );
}
