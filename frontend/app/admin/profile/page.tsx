"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, KeyRound, LogOut, Pencil, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { InternsPanel } from "@/components/profile/interns-panel";
import { REQUIRE_SIGN_IN, USE_BACKEND, signOut } from "@/lib/api";
import { cohortWeek, formatDate, initials } from "@/lib/format";
import { useCohort } from "@/lib/store";
import { useProfile, type Profile } from "@/lib/profile";
import { ROLE_LABELS } from "@/lib/team";

const FIELDS: {
  key: keyof Profile;
  label: string;
  type?: string;
  placeholder?: string;
}[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email", type: "email" },
  {
    key: "jobTitle",
    label: "Job title",
    placeholder: "e.g. Program coordinator",
  },
  { key: "pronouns", label: "Pronouns", placeholder: "e.g. she/her" },
  { key: "phone", label: "Phone", type: "tel", placeholder: "+1 555 010 0000" },
];

export default function ProfilePage() {
  const { profile, save } = useProfile();
  const [draft, setDraft] = useState<Profile>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number>();
  const [editing, setEditing] = useState(false);
  const { data } = useCohort();

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  if (!draft) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const changed = JSON.stringify(draft) !== JSON.stringify(profile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft!.name.trim()) return setError("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(draft!.email.trim()))
      return setError("Enter a valid email.");
    setSaving(true);
    setError(undefined);
    try {
      setDraft(await save(draft!));
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const weeks = cohortWeek(data.cohort.startDate, data.cohort.endDate);
  const week = Math.min(cohortWeek(data.cohort.startDate, data.today), weeks);
  const role = profile?.role === "manager" ? "Manager" : ROLE_LABELS.admin;

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="gap-4 rounded-2xl px-5">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                {initials(draft.name || "?")}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold">{profile?.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[profile?.jobTitle, profile?.pronouns]
                    .filter(Boolean)
                    .join(" · ") || role}
                </div>
                <div className="mt-1 inline-flex rounded-full bg-ocean-100 px-2 py-px text-[11px] font-medium text-ocean-800">
                  {role}
                </div>
              </div>
            </div>
            <dl className="space-y-1.5 text-sm">
              <Detail label="Email" value={profile?.email} />
              <Detail label="Phone" value={profile?.phone} />
            </dl>
            {editing ? (
              <form onSubmit={submit} className="space-y-3 border-t pt-4">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <Input
                      id={f.key}
                      type={f.type ?? "text"}
                      value={draft[f.key] ?? ""}
                      placeholder={f.placeholder}
                      onChange={(e) => {
                        setDraft({ ...draft, [f.key]: e.target.value });
                        setSavedAt(undefined);
                      }}
                    />
                  </div>
                ))}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <Button type="submit" disabled={!changed || saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDraft(profile);
                      setEditing(false);
                    }}
                  >
                    Done
                  </Button>
                  {savedAt && !changed && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Check className="size-4" /> Saved
                    </span>
                  )}
                </div>
              </form>
            ) : (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => setEditing(true)}
              >
                <Pencil /> Edit details
              </Button>
            )}
          </Card>

          <Card className="gap-3 rounded-2xl px-5">
            <h2 className="font-semibold">Your program</h2>
            <div>
              <div className="font-medium">
                {data.program.name}, {data.cohort.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(data.cohort.startDate)} –{" "}
                {formatDate(data.cohort.endDate)} · Week {week} of {weeks}
              </div>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-neutral-200"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-neutral-500"
                style={{ width: `${(week / weeks) * 100}%` }}
              />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Count
                label="Participants"
                value={
                  data.enrollments.filter((e) => e.status === "active").length
                }
                href="/admin/participants"
              />
              <Count
                label="Teams"
                value={data.teams.length}
                href="/admin/teams"
              />
              <Count
                label="Partners"
                value={data.partners.length}
                href="/admin/partners"
              />
            </dl>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Link
                href="/admin/customize"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Settings2 /> Customize
              </Link>
              {USE_BACKEND && (
                <>
                  <Link
                    href="/admin/access"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    <KeyRound /> Team access
                  </Link>
                  {REQUIRE_SIGN_IN && (
                    <Button variant="outline" size="sm" onClick={signOut}>
                      <LogOut /> Sign out
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        <InternsPanel you={profile?.id} />
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-14 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">
        {value || <span className="text-muted-foreground">Not added</span>}
      </dd>
    </div>
  );
}

function Count({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl bg-muted px-2 py-2 hover:bg-neutral-200"
    >
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </Link>
  );
}
