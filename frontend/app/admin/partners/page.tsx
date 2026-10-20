"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { partnerMembers, partnerStatus, partnersOf } from "@/lib/partners";
import { needsAttention } from "@/lib/requirements";
import { useCohort } from "@/lib/store";

export default function PartnersPage() {
  const { data, teamStatuses } = useCohort();
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const partners = partnersOf(data);
  const flagged = partners.filter((p) => needsAttention(partnerStatus(p, teamStatuses))).length;
  const q = query.trim().toLowerCase();
  const shown = partners.filter((p) => {
    if (attentionOnly && !needsAttention(partnerStatus(p, teamStatuses))) return false;
    if (!q) return true;
    return [p.name, ...p.projects.map((x) => x.title), ...p.teams.map((t) => t.name)].some((text) =>
      text.toLowerCase().includes(q),
    );
  });

  return (
    <>
      <PageHeader
        title="Partners"
        description={`${partners.length} organizations working with teams in ${data.cohort.name}`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search partners, projects or teams"
            className="pl-8"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
          Needs attention ({flagged})
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No partners match.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((partner) => {
            const flags = partner.teams.flatMap((t) => teamStatuses.get(t.id)?.flags ?? []);
            const members = partnerMembers(data, partner).length;
            return (
              <li key={partner.id}>
                <Link
                  href={`/admin/partners/${partner.id}`}
                  className="group flex h-full flex-col rounded-xl border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium">{partner.name}</span>
                    <StatusBadge status={partnerStatus(partner, teamStatuses)} overall />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {partner.projects.map((p) => p.title).join(", ")}
                  </div>
                  {flags.length > 0 && <div className="mt-3 line-clamp-2 text-sm">{flags.join(" · ")}</div>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
                    <span>
                      {partner.teams.length > 0
                        ? `${partner.teams.map((t) => `Team ${t.name}`).join(", ")} · ${members} members`
                        : "No team yet"}
                    </span>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
