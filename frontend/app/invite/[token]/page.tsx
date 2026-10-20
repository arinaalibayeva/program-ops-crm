"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { InviteInfo } from "@/lib/team";

const MIN_PASSWORD = 10;

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<InviteInfo>();
  const [problem, setProblem] = useState<string>();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/invites/${token}`)
      .then(setInfo)
      .catch((e: Error) => setProblem(e.message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== again) return setError("The passwords don't match.");
    setSending(true);
    setError(undefined);
    try {
      await api(`/invites/${token}`, { body: { password } });
      window.location.href = "/admin";
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  }

  return (
    <main className="bg-dusk flex min-h-screen flex-col items-center px-4 py-8 sm:py-14">
      <div className="mb-10 w-full max-w-md text-sm font-semibold tracking-tight text-white">
        Program Ops
      </div>
      <div className="w-full max-w-md space-y-7 rounded-2xl bg-card p-7 shadow-[0_24px_60px_-28px_oklch(0.25_0.08_258/0.55)] sm:p-9">
        {problem ? (
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">This link doesn&apos;t work</h1>
            <p className="text-sm text-muted-foreground">{problem}</p>
            <Link href="/login" className="inline-block text-sm font-medium underline">
              Go to sign in
            </Link>
          </div>
        ) : !info ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">
                {info.isReset ? "Choose a new password" : `Welcome, ${info.name.split(" ")[0]}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                {info.isReset
                  ? `For ${info.email}.`
                  : `${info.invitedBy ?? "Your manager"} invited you${
                      info.programName ? ` to ${info.programName}` : ""
                    }. Choose a password to get started.`}
              </p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={info.email} readOnly className="h-11 bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="again">Same password again</Label>
                <Input
                  id="again"
                  type="password"
                  autoComplete="new-password"
                  value={again}
                  onChange={(e) => setAgain(e.target.value)}
                  className="h-11"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={sending} className="h-11 w-full">
                {sending ? "Saving…" : info.isReset ? "Save password" : "Create account"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
