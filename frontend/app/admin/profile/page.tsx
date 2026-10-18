"use client";

import { useEffect, useState } from "react";
import { Check, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgChart, YourTeam, staffWithYou } from "@/components/org-chart";
import { PageHeader } from "@/components/page-header";
import { USE_BACKEND, signOut } from "@/lib/api";
import { initials } from "@/lib/format";
import { useProfile, type Profile } from "@/lib/profile";

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

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  if (!draft) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const changed = JSON.stringify(draft) !== JSON.stringify(profile);
  const staff = staffWithYou(profile ?? draft);

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

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details and the people you work with."
      />
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,32rem)]">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {initials(draft.name || "?")}
            </div>
            <div>
              <div className="text-lg font-semibold">{profile?.name}</div>
              <div className="text-sm text-muted-foreground">
                {[profile?.jobTitle, profile?.pronouns]
                  .filter(Boolean)
                  .join(" · ") || "Admin"}
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
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
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={!changed || saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {savedAt && !changed && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Check className="size-4" /> Saved
                </span>
              )}
            </div>
          </form>

          {USE_BACKEND && (
            <div className="border-t pt-6">
              <Button variant="outline" onClick={signOut}>
                <LogOut />
                Sign out
              </Button>
            </div>
          )}
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Your team</h2>
          <p className="text-sm text-muted-foreground">Sample organization for this prototype.</p>
          <YourTeam staff={staff} />
        </section>
      </div>

      <section className="mt-12 space-y-4 border-t pt-8">
        <div>
          <h2 className="text-base font-semibold">Org chart</h2>
          <p className="text-sm text-muted-foreground">
            Who does what, and who reports to whom.
          </p>
        </div>
        <OrgChart staff={staff} />
      </section>
    </>
  );
}
