"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Mail, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { currentTeamId } from "@/lib/requirements";
import { formatDate } from "@/lib/format";

export default function ParticipantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, participantStatuses, toggleAttendance, toggleCompletion, moveToTeam } =
    useCohort();
  const { personFor, enrollmentById, teamById, projectById } = usePeopleIndex();

  const enrollment = enrollmentById.get(id);
  const person = personFor(id);
  if (!enrollment || !person) {
    return <p className="text-muted-foreground">Participant not found.</p>;
  }

  const status = participantStatuses.get(id);
  const teamId = currentTeamId(data, id);
  const team = teamId ? teamById.get(teamId) : undefined;
  const project = team?.projectId ? projectById.get(team.projectId) : undefined;
  const history = data.memberships
    .filter((m) => m.enrollmentId === id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const pastEvents = data.events.filter((e) => e.date < data.today);

  return (
    <>
      <Link
        href="/admin/participants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Participants
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {person.name}
            {enrollment.status === "withdrawn" ? (
              <span className="text-sm font-normal text-muted-foreground">Withdrawn</span>
            ) : (
              status && <StatusBadge status={status.status} overall />
            )}
          </span>
        }
        description={
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> {person.email}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status?.results.map((result) => {
                const req = data.requirements.find((r) => r.id === result.requirementId)!;
                return (
                  <div
                    key={result.requirementId}
                    className="flex items-center justify-between gap-4 rounded-lg border p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{req.name}</div>
                      <div className="text-xs text-muted-foreground">{result.reason}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {req.type === "complete_by" && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={result.status === "met"}
                            onCheckedChange={() => toggleCompletion(req.id, id)}
                          />
                          Done
                        </label>
                      )}
                      <StatusBadge status={result.status} />
                    </div>
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

          <Card>
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <ul className="divide-y">
                {pastEvents.map((event) => {
                  const attended = data.attendance.some(
                    (a) => a.eventId === event.id && a.enrollmentId === id,
                  );
                  return (
                    <li key={event.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="text-sm hover:underline"
                        >
                          {event.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(event.date, { weekday: true })} · {event.category}
                          {event.isRequired ? " · required" : ""}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {attended ? "Attended" : "Absent"}
                        <Checkbox
                          checked={attended}
                          onCheckedChange={() => toggleAttendance(event.id, id)}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {team ? (
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
              {enrollment.status === "active" && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Move to team</div>
                  <NativeSelect
                    value={teamId ?? ""}
                    onChange={(e) => e.target.value && moveToTeam(id, e.target.value)}
                    className="w-full"
                  >
                    <option value="" disabled>
                      Choose a team
                    </option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
              <div>
                <div className="mb-1.5 text-xs text-muted-foreground">Team history</div>
                <ol className="space-y-1.5 border-l pl-3">
                  {history.map((m) => (
                    <li key={m.teamId + m.startDate} className="text-xs">
                      <span className="font-medium">{teamById.get(m.teamId)?.name}</span>{" "}
                      <span className="text-muted-foreground">
                        {formatDate(m.startDate)} – {m.endDate ? formatDate(m.endDate) : "now"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-transparent shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareText className="size-4" /> Notes &amp; activity
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Coming next: meeting notes, follow-ups and a timeline of everything that
              happened with this participant, across cohorts.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
