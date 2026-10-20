"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyLinkButton } from "@/components/copy-link-button";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { USE_BACKEND, api } from "@/lib/api";
import { initials } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import { ROLE_LABELS, type InviteLink, type TeamMember, type TeamRole } from "@/lib/team";

const STATUS_LABELS: Record<TeamMember["status"], string> = {
  active: "Active",
  invited: "Invite sent",
  expired: "Invite expired",
};

export default function TeamPage() {
  const { profile } = useProfile();
  const isManager = profile?.role === "manager";
  const [members, setMembers] = useState<TeamMember[]>();
  const [error, setError] = useState<string>();
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<InviteLink>();
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirming, setConfirming] = useState<string>();

  const load = useCallback(() => {
    api<TeamMember[]>("/team").then(setMembers).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (USE_BACKEND) load();
  }, [load]);

  /** Runs a change, shows any refusal, and keeps the list current. */
  async function change(run: () => Promise<TeamMember[]>) {
    setError(undefined);
    try {
      setMembers(await run());
    } catch (e) {
      setError((e as Error).message);
    }
    setConfirming(undefined);
  }

  async function newLink(member: TeamMember) {
    setError(undefined);
    try {
      setLink(await api<InviteLink>(`/team/${member.id}/link`, { method: "POST" }));
      setLinkOpen(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <Link
        href="/admin/profile"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <PageHeader
        title="Team access"
        description="Everyone who can sign in to the CRM."
        actions={
          isManager && (
            <Button onClick={() => setInviting(true)}>
              <Plus /> Invite someone
            </Button>
          )
        }
      />

      {!USE_BACKEND ? (
        <p className="text-sm text-muted-foreground">Invitations need the backend to be running.</p>
      ) : (
        <>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <Card className="max-w-4xl py-0">
            <ul className="divide-y">
              {members?.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="truncate text-sm font-medium">
                      {member.name}
                      {member.email === profile?.email && (
                        <span className="font-normal text-muted-foreground"> (you)</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.email} · {STATUS_LABELS[member.status]}
                    </div>
                  </div>
                  {isManager ? (
                    <NativeSelect
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) =>
                        change(() =>
                          api(`/team/${member.id}`, { method: "PATCH", body: { role: e.target.value as TeamRole } }),
                        )
                      }
                    >
                      {Object.entries(ROLE_LABELS).map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                  )}
                  {isManager && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => newLink(member)}>
                        <Link2 /> {member.status === "active" ? "Reset link" : "New link"}
                      </Button>
                      {member.email !== profile?.email &&
                        (confirming === member.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => change(() => api(`/team/${member.id}`, { method: "DELETE" }))}
                            >
                              Remove
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirming(undefined)}>
                              Keep
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove ${member.name}`}
                            onClick={() => setConfirming(member.id)}
                          >
                            <Trash2 />
                          </Button>
                        ))}
                    </div>
                  )}
                </li>
              ))}
              {!members && <li className="px-4 py-6 text-sm text-muted-foreground">Loading…</li>}
            </ul>
          </Card>
          <p className="mt-3 max-w-4xl text-xs text-muted-foreground">
            Managers can invite and remove people. Team members can use the whole CRM.
          </p>
        </>
      )}

      <Dialog open={inviting} onOpenChange={setInviting}>
        <DialogContent>
          <InviteForm
            onDone={(created) => {
              setInviting(false);
              if (created) {
                setLink(created);
                setLinkOpen(true);
                load();
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          {link && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {link.member.status === "active" ? "Password reset link" : "Invite link"} for {link.member.name}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Send this to {link.member.email}. It works once and expires in 7 days. It won&apos;t be shown again, but
                you can always make a new one.
              </p>
              <Input readOnly value={`${window.location.origin}/invite/${link.token}`} onFocus={(e) => e.target.select()} />
              <DialogFooter>
                <CopyLinkButton path={`/invite/${link.token}`} label="Copy link" />
                <Button size="sm" onClick={() => setLinkOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteForm({ onDone }: { onDone: (link?: InviteLink) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("admin");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      onDone(await api<InviteLink>("/team/invites", { body: { name, email, role } }));
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Invite someone</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="invite-name">Name</Label>
        <Input id="invite-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <NativeSelect
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as TeamRole)}
          className="w-full"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" disabled={sending}>
          {sending ? "Creating…" : "Create invite"}
        </Button>
      </DialogFooter>
    </form>
  );
}
