"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Notes } from "@/components/notes";
import { OwnerSelect } from "@/components/owner-select";
import { PageHeader } from "@/components/page-header";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { formatEventTime } from "@/lib/events";
import { formatDate } from "@/lib/format";
import {
  partnerById,
  partnerEvents,
  partnerMembers,
  partnerStatus,
  type PartnerSummary,
} from "@/lib/partners";
import { activeMembers } from "@/lib/requirements";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { partnerTimeline } from "@/lib/timeline";
import type { Team } from "@/lib/types";

export default function PartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, teamStatuses, updatePartner } = useCohort();
  const [editing, setEditing] = useState(false);
  const partner = partnerById(data, id);

  if (!partner)
    return <p className="text-muted-foreground">Partner not found.</p>;

  const flags = [
    ...new Set(
      partner.teams.flatMap((t) => teamStatuses.get(t.id)?.flags ?? []),
    ),
  ];
  const events = partnerEvents(data, partner.id);
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
            <StatusBadge
              status={partnerStatus(partner, teamStatuses)}
              overall
            />
          </span>
        }
        description={[
          ...partner.projects.map((p) => p.title),
          `${partner.teams.length} team${partner.teams.length === 1 ? "" : "s"}`,
          `${members} members`,
        ].join(" · ")}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Assigned to
              <OwnerSelect
                value={partner.ownerId}
                onChange={(ownerId) => updatePartner(id, { ownerId })}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil /> Edit partner
            </Button>
          </>
        }
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
          {(partner.website || partner.description) && (
            <Card>
              <CardContent className="space-y-2 text-sm">
                {partner.description && (
                  <p className="whitespace-pre-wrap">{partner.description}</p>
                )}
                {/* Only link http(s) so a pasted "javascript:" value can't run. */}
                {partner.website && /^https?:\/\//i.test(partner.website) && (
                  <a
                    href={partner.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    {partner.website}
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
          {partner.teams.map((team) => (
            <LinkedRecords key={team.id} target="team" id={team.id} />
          ))}
          {partner.teams.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No team is on this project yet.
            </p>
          )}
          <Notes subjectType="partner" subjectId={partner.id} />
        </div>

        <div className="space-y-6">
          <ContactsCard partner={partner} />
          <ProjectsCard partner={partner} />
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
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="group block text-sm"
                      >
                        <div className="font-medium group-hover:underline">
                          {e.title}
                        </div>
                        <div className="text-muted-foreground">
                          {[
                            formatDate(e.date, { weekday: true }),
                            formatEventTime(e),
                            !e.partnerId && "All partners",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Timeline entries={partnerTimeline(data, partner)} />
        </div>
      </div>

      <EditPartnerDialog
        key={String(editing)}
        partner={partner}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}

function EditPartnerDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: PartnerSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePartner } = useCohort();
  const [name, setName] = useState(partner.name);
  const [website, setWebsite] = useState(partner.website ?? "");
  const [description, setDescription] = useState(partner.description ?? "");
  const [error, setError] = useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = website.trim();
    if (!name.trim()) return setError("Enter a name.");
    if (url && !/^https?:\/\/\S+$/i.test(url))
      return setError("Websites must start with http:// or https://.");
    updatePartner(partner.id, {
      name: name.trim(),
      website: url || undefined,
      description: description.trim() || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="partner-name">Name</Label>
            <Input
              id="partner-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-website">Website</Label>
            <Input
              id="partner-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.org"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner-description">About</Label>
            <textarea
              id="partner-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What they do and how they work with the program"
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit">Save partner</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactsCard({ partner }: { partner: PartnerSummary }) {
  const { addContact, deleteContact } = useCohort();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();

  function close() {
    setAdding(false);
    setName("");
    setTitle("");
    setEmail("");
    setError(undefined);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter their name.");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()))
      return setError("Enter a valid email.");
    addContact(partner.id, {
      name: name.trim(),
      title: title.trim() || undefined,
      email: email.trim() || undefined,
    });
    close();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contacts</CardTitle>
        {!adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {partner.contacts.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No contacts yet.</p>
        )}
        <ul className="space-y-3">
          {partner.contacts.map((c) => (
            <li
              key={c.id}
              className="group flex items-start justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                {c.title && (
                  <div className="text-xs text-muted-foreground">{c.title}</div>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="size-3" /> {c.email}
                  </a>
                )}
              </div>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => deleteContact(partner.id, c.id)}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {adding && (
          <form onSubmit={submit} className="space-y-2 border-t pt-3">
            <Input
              aria-label="Name"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              aria-label="Role"
              placeholder="Role"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Add contact
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectsCard({ partner }: { partner: PartnerSummary }) {
  const { data, setProjectPartner } = useCohort();
  const free = data.projects.filter((p) => !p.partnerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {partner.projects.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No projects this cohort.
          </p>
        )}
        <ul className="space-y-1.5">
          {partner.projects.map((p) => (
            <li
              key={p.id}
              className="group flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0">{p.title}</span>
              <button
                type="button"
                aria-label={`Unlink ${p.title}`}
                onClick={() => setProjectPartner(p.id, undefined)}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {free.length > 0 && (
          <NativeSelect
            aria-label="Link a project"
            value=""
            onChange={(e) =>
              e.target.value && setProjectPartner(e.target.value, partner.id)
            }
            className="w-full"
          >
            <option value="">Link a project…</option>
            {free.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </NativeSelect>
        )}
      </CardContent>
    </Card>
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
              <Link
                href={`/admin/participants/${m.id}`}
                className="block px-4 py-1.5 text-sm hover:bg-muted/50"
              >
                {personFor(m.id)?.name}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
