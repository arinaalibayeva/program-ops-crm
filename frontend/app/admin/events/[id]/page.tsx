"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, ExternalLink, Link as LinkIcon, Pencil, Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CopyLinkButton } from "@/components/copy-link-button";
import {
  EventFields,
  eventFormValues,
  eventFromForm,
  validateEventForm,
  type EventFormValues,
} from "@/components/event-form";
import { PageHeader } from "@/components/page-header";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId } from "@/lib/requirements";
import { EVENT_CATEGORY_LABELS, formatEventTime, takesAttendance } from "@/lib/events";
import { cohortWeek, formatDate } from "@/lib/format";
import type { ProgramEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "present" | "absent";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useCohort();
  const [editing, setEditing] = useState(false);

  const event = data.events.find((e) => e.id === id);
  if (!event) return <p className="text-muted-foreground">Event not found.</p>;

  return (
    <>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Events
      </Link>
      <PageHeader
        title={event.title}
        description={`${formatDays(event)} · Week ${cohortWeek(data.cohort.startDate, event.date)}`}
        actions={
          <>
            {!editing && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit event
              </Button>
            )}
            {takesAttendance(event) && (
              <>
                <a
                  href={`/checkin/${event.checkinToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink />
                  Open check-in page
                </a>
                <CopyLinkButton path={`/checkin/${event.checkinToken}`} />
              </>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {editing ? (
          <EditEventCard event={event} onDone={() => setEditing(false)} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <EventDetails event={event} />
            <MaterialsCard event={event} />
          </div>
        )}
        {takesAttendance(event) && <AttendanceCard event={event} />}
        <div className="grid gap-6 lg:grid-cols-2">
          <TrackedNumbers on="event" id={event.id} />
          <LinkedRecords target="event" id={event.id} />
        </div>
      </div>
    </>
  );
}

function AttendanceCard({ event }: { event: ProgramEvent }) {
  const { data, toggleAttendance } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const everyone = data.enrollments
    .filter((e) => e.status === "active")
    .map((e) => {
      const teamId = currentTeamId(data, e.id);
      return {
        enrollment: e,
        person: personFor(e.id)!,
        team: teamId ? teamById.get(teamId) : undefined,
        record: data.attendance.find((a) => a.eventId === event.id && a.enrollmentId === e.id),
      };
    })
    .sort((a, b) => a.person.name.localeCompare(b.person.name));
  const presentCount = everyone.filter((r) => r.record).length;
  const counts: Record<Filter, number> = {
    all: everyone.length,
    present: presentCount,
    absent: everyone.length - presentCount,
  };
  const q = query.trim().toLowerCase();
  const shown = everyone.filter(
    (r) =>
      (filter === "all" || (filter === "present") === !!r.record) &&
      r.person.name.toLowerCase().includes(q),
  );
  const upcoming = event.date > data.today;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          Attendance{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {presentCount} / {everyone.length}
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" className="flex h-8 rounded-lg border p-0.5 text-sm">
            {(["all", "present", "absent"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 text-muted-foreground capitalize",
                  filter === f && "bg-muted font-medium text-foreground",
                )}
              >
                {f} <span className="tabular-nums">{counts[f]}</span>
              </button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find participant"
            className="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcoming && (
          <p className="text-sm text-muted-foreground">
            This event hasn&apos;t happened yet. Participants check in with the link on the day.
          </p>
        )}
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No one matches.</p>
        ) : (
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map(({ enrollment, person, team, record }) => (
              <li key={enrollment.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60">
                <Checkbox
                  checked={!!record}
                  onCheckedChange={() => toggleAttendance(event.id, enrollment.id)}
                  aria-label={`${person.name} attended`}
                />
                <span className="min-w-0">
                  <Link
                    href={`/admin/participants/${enrollment.id}`}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {person.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">
                    {team ? (
                      <Link href={`/admin/teams/${team.id}`} className="hover:text-foreground hover:underline">
                        Team {team.name}
                      </Link>
                    ) : (
                      "No team"
                    )}
                    {record && (record.source === "link" ? " · via link" : " · marked by hand")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatDays(event: ProgramEvent): string {
  const start = formatDate(event.date, { weekday: true });
  return event.endDate ? `${start} – ${formatDate(event.endDate, { weekday: true })}` : start;
}

function EventDetails({ event }: { event: ProgramEvent }) {
  const { partnerById } = usePeopleIndex();
  const partner = event.partnerId ? partnerById.get(event.partnerId) : undefined;
  const isLink = event.location && /^https?:\/\//.test(event.location);
  const facts: [string, React.ReactNode][] = [
    ["Time", formatEventTime(event)],
    [
      "Where",
      isLink ? (
        <a
          href={event.location}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2"
        >
          Meeting link
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        event.location
      ),
    ],
    ["Host", event.host],
    ["Category", EVENT_CATEGORY_LABELS[event.category]],
    [
      "Partner",
      partner ? (
        <Link href={`/admin/partners/${partner.id}`} className="underline underline-offset-2">
          {partner.name}
        </Link>
      ) : event.category === "partner" ? (
        "All partners"
      ) : undefined,
    ],
  ];

  return (
    <Card className="lg:col-span-2">
      <CardContent className="space-y-5">
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium">
                {value || <span className="font-normal text-muted-foreground">—</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t pt-4">
          {event.description ? (
            <Description text={event.description} />
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Shows the first paragraph of a long description, with a toggle for the rest. */
function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const paragraphs = text.split(/\n\s*\n/);
  const long = paragraphs.length > 1 || text.length > 400;
  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-sm leading-relaxed whitespace-pre-line",
          long && !expanded && "line-clamp-4",
        )}
      >
        {expanded ? text : paragraphs[0]}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Slides, recordings, forms: labelled links admins add for each event. */
function MaterialsCard({ event }: { event: ProgramEvent }) {
  const { updateEvent } = useCohort();
  const links = event.links ?? [];
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();

  function closeForm() {
    setAdding(false);
    setLabel("");
    setUrl("");
    setError(undefined);
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const href = /^https?:\/\//.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    if (!url.trim() || !URL.canParse(href)) {
      setError("Enter a valid link.");
      return;
    }
    updateEvent(event.id, { links: [...links, { label: label.trim() || hostname(href), url: href }] });
    closeForm();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Materials</CardTitle>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            Add link
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {links.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No materials yet. Add slides, recordings, templates or sign-up forms.
          </p>
        )}
        {links.length > 0 && (
          <ul className="-mx-2">
            {links.map((link, i) => (
              <li key={i} className="group flex items-center gap-3 px-2 py-1.5 hover:bg-muted/60">
                <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate text-sm font-medium group-hover:underline">
                    {link.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {hostname(link.url)}
                  </span>
                </a>
                <button
                  type="button"
                  aria-label={`Remove ${link.label}`}
                  onClick={() =>
                    updateEvent(event.id, { links: links.filter((_, j) => j !== i) })
                  }
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {adding && (
          <form onSubmit={add} className="space-y-2 border-t pt-3">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name, e.g. Workshop slides"
              autoFocus
            />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link, e.g. docs.google.com/…"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Add
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function EditEventCard({ event, onDone }: { event: ProgramEvent; onDone: () => void }) {
  const { data, updateEvent } = useCohort();
  const [values, setValues] = useState<EventFormValues>(() => eventFormValues(data.today, event));
  const [error, setError] = useState<string>();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateEventForm(values);
    if (problem) {
      setError(problem);
      return;
    }
    updateEvent(event.id, eventFromForm(values));
    onDone();
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={save} className="space-y-6">
          <EventFields values={values} onChange={setValues} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
