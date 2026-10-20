"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { StatusBadge } from "@/components/status-badge";
import { formatEventTime } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { partnerMembers, partnerStatus, partnersOf } from "@/lib/partners";
import { activeMembers } from "@/lib/requirements";
import { useCohort, usePeopleIndex } from "@/lib/store";
import type { Team } from "@/lib/types";

export default function PartnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, teamStatuses } = useCohort();
  const partner = partnersOf(data).find((p) => p.id === id);

  if (!partner) return <p className="text-muted-foreground">Partner not found.</p>;

  const flags = [...new Set(partner.teams.flatMap((t) => teamStatuses.get(t.id)?.flags ?? []))];
  const events = data.events.filter((e) => e.category === "partner" || e.host === partner.name);
  const members = partnerMembers(data, partner).length;

  return (
    <>
      <Link
        href="/admin/partners"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Partners
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {partner.name}
            <StatusBadge status={partnerStatus(partner, teamStatuses)} overall />
          </span>
        }
        description={`${partner.projects.map((p) => p.title).join(", ")} · ${partner.teams.length} team${
          partner.teams.length === 1 ? "" : "s"
        } · ${members} members`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {flags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {partner.teams.map((team) => (
            <LinkedRecords key={team.id} target="team" id={team.id} />
          ))}
          {partner.teams.length === 0 && <p className="text-sm text-muted-foreground">No team is on this project yet.</p>}
        </div>

        <div className="space-y-6">
          {partner.teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
          {partner.teams.map((team) => (
            <TrackedNumbers key={team.id} on="team" id={team.id} />
          ))}
          {events.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Partner events</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/events/${e.id}`} className="group block text-sm">
                        <div className="font-medium group-hover:underline">{e.title}</div>
                        <div className="text-muted-foreground">
                          {[formatDate(e.date, { weekday: true }), formatEventTime(e)].filter(Boolean).join(" · ")}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function TeamCard({ team }: { team: Team }) {
  const { data, teamStatuses } = useCohort();
  const { personFor } = usePeopleIndex();
  const status = teamStatuses.get(team.id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          <Link href={`/admin/teams/${team.id}`} className="hover:underline">
            Team {team.name}
          </Link>
        </CardTitle>
        {status && <StatusBadge status={status.status} overall />}
      </CardHeader>
      <CardContent className="px-0">
        <ul>
          {activeMembers(data, team.id).map((m) => (
            <li key={m.id}>
              <Link href={`/admin/participants/${m.id}`} className="block px-4 py-1.5 text-sm hover:bg-muted/50">
                {personFor(m.id)?.name}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
