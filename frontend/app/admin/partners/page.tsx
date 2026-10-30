"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { partnerMembers, partnerStatus, partnersOf } from "@/lib/partners";
import { needsAttention } from "@/lib/requirements";
import { staffName, UNASSIGNED } from "@/lib/staff";
import { useCohort } from "@/lib/store";
import { useUrlParam } from "@/lib/url-param";

export default function PartnersPage() {
  const { data, teamStatuses } = useCohort();
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [owner, setOwner] = useState("all");
  const [creating, setCreating] = useState(false);

  useUrlParam("owner", setOwner);

  const partners = partnersOf(data);
  const flagged = partners.filter((p) =>
    needsAttention(partnerStatus(p, teamStatuses)),
  ).length;
  const q = query.trim().toLowerCase();
  const shown = partners.filter((p) => {
    if (attentionOnly && !needsAttention(partnerStatus(p, teamStatuses)))
      return false;
    if (owner === "none" ? p.ownerId : owner !== "all" && p.ownerId !== owner)
      return false;
    if (!q) return true;
    return [
      p.name,
      ...p.projects.map((x) => x.title),
      ...p.teams.map((t) => t.name),
    ].some((text) => text.toLowerCase().includes(q));
  });

  return (
    <>
      <PageHeader
        title="Partners"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New partner
          </Button>
        }
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
        <NativeSelect
          aria-label="Assigned to"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          <option value="all">Anyone</option>
          <option value="none">{UNASSIGNED}</option>
          {data.staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={attentionOnly}
            onChange={(e) => setAttentionOnly(e.target.checked)}
          />
          Needs attention ({flagged})
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No partners match.
        </p>
      ) : (
        // A plain list for now; the layout will be redesigned later.
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b">
                <tr className="text-left text-xs font-semibold">
                  <th className="px-4 py-2.5">Partner</th>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Team</th>
                  <th className="px-4 py-2.5 text-right">Members</th>
                  <th className="px-4 py-2.5">Looked after by</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((partner) => (
                  <tr key={partner.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="font-medium hover:underline"
                      >
                        {partner.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {partner.projects.map((p) => p.title).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {partner.teams.map((t) => t.name).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {partnerMembers(data, partner).length}
                    </td>
                    <td className="px-4 py-2.5">
                      {staffName(data, partner.ownerId)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        status={partnerStatus(partner, teamStatuses)}
                        overall
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewPartnerDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function NewPartnerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { data, addPartner } = useCohort();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a name.");
    if (
      data.partners.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      return setError("There's already a partner with this name.");
    }
    router.push(`/admin/partners/${addPartner({ name: trimmed })}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-partner-name">Organization name</Label>
            <Input
              id="new-partner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit">Create partner</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
