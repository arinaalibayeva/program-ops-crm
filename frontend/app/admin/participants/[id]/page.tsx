"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, MessageSquareText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FieldInput } from "@/components/field-input";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { SectionBoard, type BoardLayout } from "@/components/section-board";
import { StatusBadge } from "@/components/status-badge";
import { useCohort } from "@/lib/store";
import { currentTeamId, participantStatus } from "@/lib/requirements";
import { formatDate } from "@/lib/format";
import { activeFields, formatFieldValue } from "@/lib/fields";
import {
  applyDraft,
  draftFrom,
  validateDraft,
  type ParticipantDraft,
} from "@/lib/participant-draft";
import { cn } from "@/lib/utils";
import type { CohortData, Enrollment, SubjectStatus } from "@/lib/types";

type SectionId = "requirements" | "attendance" | "profile" | "team" | "notes";

const SECTION_LABELS: Record<SectionId, string> = {
  requirements: "Requirements",
  attendance: "Attendance",
  profile: "Profile",
  team: "Team",
  notes: "Notes",
};

const DEFAULT_LAYOUT: BoardLayout<SectionId> = {
  left: ["requirements", "attendance"],
  right: ["profile", "team", "notes"],
};

// The arrangement is a per-admin preference shared by every participant page,
// so it lives in this browser rather than in the cohort data.
const LAYOUT_KEY = "program-ops-crm:participant-layout:v1";

function loadLayout(): BoardLayout<SectionId> {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null");
    const ids = [...(saved?.left ?? []), ...(saved?.right ?? [])].sort().join();
    // Fall back if sections were added or removed since it was saved.
    if (ids === Object.keys(SECTION_LABELS).sort().join()) return saved;
  } catch {
    // Unreadable storage: use the default.
  }
  return DEFAULT_LAYOUT;
}

/** What each section needs. `draft` is only set in edit mode. */
interface SectionProps {
  view: CohortData;
  enrollment: Enrollment;
  draft?: ParticipantDraft;
  update: (patch: Partial<ParticipantDraft>) => void;
}

export default function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, updateParticipant } = useCohort();
  const [draft, setDraft] = useState<ParticipantDraft>();
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutDraft, setLayoutDraft] = useState<BoardLayout<SectionId>>();

  // Read after mount to avoid a server/client mismatch.
  useEffect(() => setLayout(loadLayout()), []);

  // While editing, every section shows the draft applied to the data, so
  // statuses update live before anything is saved.
  const view = useMemo(() => (draft ? applyDraft(data, id, draft) : data), [data, id, draft]);

  const enrollment = view.enrollments.find((e) => e.id === id);
  const person = enrollment && view.people.find((p) => p.id === enrollment.personId);
  if (!enrollment || !person) {
    return <p className="text-muted-foreground">Participant not found.</p>;
  }

  const status = enrollment.status === "active" ? participantStatus(view, id) : undefined;
  const update = (patch: Partial<ParticipantDraft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  function save() {
    if (!draft) return;
    const problem = validateDraft(data, id, draft, activeFields(data));
    if (problem) {
      setError(problem);
      return;
    }
    updateParticipant(id, draft);
    if (layoutDraft) {
      setLayout(layoutDraft);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutDraft));
      } catch {
        // Storage unavailable: the layout lasts until the page reloads.
      }
    }
    cancel();
  }

  function startEditing() {
    setDraft(draftFrom(data, id));
    setLayoutDraft(layout);
  }

  function cancel() {
    setDraft(undefined);
    setLayoutDraft(undefined);
    setError("");
  }

  const section = { view, enrollment, draft, update };

  return (
    <>
      <Link
        href="/admin/participants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Participants
      </Link>

      {draft && (
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-sm">
          <div className="text-sm">
            <span className="font-medium">Editing</span>{" "}
            <span className="text-muted-foreground">
              Drag sections by their handle to rearrange. Nothing is saved until you click
              Save.
            </span>
            {error && <div className="text-destructive">{error}</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setLayoutDraft(DEFAULT_LAYOUT)}>
              Reset layout
            </Button>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>
      )}

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {person.name || "Unnamed"}
            {enrollment.status === "withdrawn" ? (
              <span className="text-sm font-normal text-muted-foreground">Withdrawn</span>
            ) : (
              status && <StatusBadge status={status.status} overall className="text-sm" />
            )}
          </span>
        }
        description={
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> {person.email}
          </span>
        }
        actions={
          !draft && (
            <Button variant="outline" onClick={startEditing}>
              <Pencil /> Edit participant
            </Button>
          )
        }
      />

      <SectionBoard
        layout={layoutDraft ?? layout}
        onChange={draft ? setLayoutDraft : undefined}
        labels={SECTION_LABELS}
        render={(sectionId) => {
          switch (sectionId) {
            case "requirements":
              return <RequirementsSection {...section} status={status} />;
            case "attendance":
              return <AttendanceSection {...section} />;
            case "profile":
              return <ProfileSection {...section} />;
            case "team":
              return <TeamSection {...section} />;
            case "notes":
              return <NotesSection />;
          }
        }}
      />
    </>
  );
}

function NotesSection() {
  return (
    <Card className="border-dashed bg-transparent shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <MessageSquareText className="size-4" /> Notes &amp; activity
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        Coming next: meeting notes, follow-ups and a timeline of everything that happened
        with this participant, across cohorts.
      </CardContent>
    </Card>
  );
}

function RequirementsSection({
  view,
  draft,
  update,
  status,
}: SectionProps & { status?: SubjectStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.results.map((result) => {
          const req = view.requirements.find((r) => r.id === result.requirementId)!;
          const doneDate = draft?.completions[req.id];
          const excuse = draft?.exemptions[req.id];
          return (
            <div key={req.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{req.name}</div>
                  <div className="text-xs text-muted-foreground">{result.reason}</div>
                </div>
                {result.excused ? (
                  <span className="text-xs text-muted-foreground">Excused</span>
                ) : (
                  <StatusBadge status={result.status} />
                )}
              </div>

              {draft && (
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
                  {req.type === "complete_by" ? (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={doneDate !== undefined}
                          onCheckedChange={(on) => {
                            const completions = { ...draft.completions };
                            if (on) completions[req.id] = view.today;
                            else delete completions[req.id];
                            update({ completions });
                          }}
                        />
                        Completed
                      </label>
                      {doneDate !== undefined && (
                        <Input
                          type="date"
                          aria-label={`${req.name} completed on`}
                          value={doneDate}
                          max={view.today}
                          onChange={(e) =>
                            update({
                              completions: { ...draft.completions, [req.id]: e.target.value },
                            })
                          }
                          className="h-7 w-40"
                        />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Calculated from attendance below
                    </span>
                  )}
                  <div className="flex flex-1 items-center gap-2">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={excuse !== undefined}
                        onCheckedChange={(on) => {
                          const exemptions = { ...draft.exemptions };
                          if (on) exemptions[req.id] = "";
                          else delete exemptions[req.id];
                          update({ exemptions });
                        }}
                      />
                      Excused
                    </label>
                    {excuse !== undefined && (
                      <Input
                        aria-label={`Reason ${req.name} is excused`}
                        value={excuse}
                        onChange={(e) =>
                          update({ exemptions: { ...draft.exemptions, [req.id]: e.target.value } })
                        }
                        placeholder="Reason (optional)"
                        className="h-7 min-w-40 flex-1"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!status && (
          <p className="text-sm text-muted-foreground">
            Requirements aren&apos;t tracked for withdrawn participants.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AttendanceSection({ view, enrollment, draft, update }: SectionProps) {
  const attended = new Set(
    view.attendance.filter((a) => a.enrollmentId === enrollment.id).map((a) => a.eventId),
  );
  const past = view.events.filter((e) => e.date < view.today);
  // Today's events can be recorded while editing; future ones can't.
  const recordable = view.events.filter((e) => e.date <= view.today);

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
            Attended {past.filter((e) => attended.has(e.id)).length} of {past.length} events so
            far
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
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                update({
                  attendedEventIds: [
                    ...new Set([
                      ...draft.attendedEventIds,
                      ...recordable.filter((e) => e.isRequired).map((e) => e.id),
                    ]),
                  ],
                })
              }
            >
              Add all required
            </Button>
            <Button variant="ghost" size="sm" onClick={() => update({ attendedEventIds: [] })}>
              Clear
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {view.events.map((event) => {
            const isFuture = event.date > view.today;
            const isUpcoming = event.date >= view.today;
            const didAttend = attended.has(event.id);
            const details = (
              <div className="min-w-0 flex-1">
                <div className="text-sm">{event.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(event.date, { weekday: true })} · {event.category}
                  {event.isRequired ? " · required" : ""}
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
                ) : didAttend ? (
                  <span className="text-xs text-muted-foreground">Attended</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    Absent
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProfileSection({ view, enrollment, draft, update }: SectionProps) {
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
            <Link href="/admin/fields" className="underline">
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

function TeamSection({ view, enrollment, draft, update }: SectionProps) {
  const teamId = currentTeamId(view, enrollment.id);
  const team = view.teams.find((t) => t.id === teamId);
  const project = view.projects.find((p) => p.id === team?.projectId);
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
            {project && (
              <div className="text-xs text-muted-foreground">
                {project.title} · {project.partner}
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
                  <span className="font-medium">
                    {view.teams.find((t) => t.id === m.teamId)?.name}
                  </span>{" "}
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
