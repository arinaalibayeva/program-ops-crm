"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PageHeader } from "@/components/page-header";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId } from "@/lib/requirements";
import { cohortWeek, formatDate } from "@/lib/format";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, toggleAttendance } = useCohort();
  const { personFor, teamById } = usePeopleIndex();
  const [query, setQuery] = useState("");

  const event = data.events.find((e) => e.id === id);
  if (!event) return <p className="text-muted-foreground">Event not found.</p>;

  const roster = data.enrollments
    .filter((e) => e.status === "active")
    .map((e) => {
      const record = data.attendance.find(
        (a) => a.eventId === id && a.enrollmentId === e.id,
      );
      const teamId = currentTeamId(data, e.id);
      return {
        enrollment: e,
        person: personFor(e.id)!,
        team: teamId ? teamById.get(teamId) : undefined,
        record,
      };
    })
    .filter(({ person }) => person.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(!!a.record) - Number(!!b.record) || a.person.name.localeCompare(b.person.name));

  const attendedCount = data.attendance.filter(
    (a) =>
      a.eventId === id &&
      data.enrollments.some((e) => e.id === a.enrollmentId && e.status === "active"),
  ).length;
  const activeCount = data.enrollments.filter((e) => e.status === "active").length;
  const checkinPath = `/checkin/${event.checkinToken}`;

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
        description={`${formatDate(event.date, { weekday: true })} · Week ${cohortWeek(data.cohort.startDate, event.date)} · ${event.category} · ${event.isRequired ? "required" : "optional"}`}
        actions={<CopyLinkButton path={checkinPath} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Attendance{" "}
              <span className="font-normal text-muted-foreground tabular-nums">
                {attendedCount} / {activeCount}
              </span>
            </CardTitle>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find participant"
              className="w-48"
            />
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {roster.map(({ enrollment, person, team, record }) => (
                <li key={enrollment.id} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <Link
                      href={`/admin/participants/${enrollment.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {person.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {team ? `Team ${team.name}` : "No team"}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    {record ? (record.source === "link" ? "Checked in via link" : "Marked manually") : "Not checked in"}
                    <Checkbox
                      checked={!!record}
                      onCheckedChange={() => toggleAttendance(id, enrollment.id)}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Check-in link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Share this link during the event. Participants enter their email and are
              matched to the roster.
            </p>
            <code className="block rounded-md bg-muted px-2 py-1.5 text-xs break-all">
              {checkinPath}
            </code>
            <p className="text-xs text-muted-foreground">
              The public check-in page will be built with the backend.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
