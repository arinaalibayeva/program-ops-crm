"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USE_BACKEND, api } from "@/lib/api";

interface SignedIn {
  name: string;
  role: "admin" | "participant";
}

/** Only follow ?next= to a page on this site, never to another website. */
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/")) return "/admin";
  try {
    const destination = new URL(next, window.location.origin);
    return destination.origin === window.location.origin
      ? destination.pathname + destination.search + destination.hash
      : "/admin";
  } catch {
    return "/admin";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [participant, setParticipant] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const user = await api<SignedIn>("/auth/login", { body: { email, password } });
      if (user.role === "admin") {
        window.location.href = safeNext();
        return;
      }
      setParticipant(user.name.split(" ")[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            PO
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Sign in to Program Ops</h1>
            <p className="text-sm text-muted-foreground">For the team running the program.</p>
          </div>
        </div>

        {!USE_BACKEND ? (
          <p className="text-sm text-muted-foreground">
            This copy runs on sample data in your browser, so there&apos;s nothing to sign in to.{" "}
            <Link href="/admin" className="font-medium text-foreground underline">
              Open the app
            </Link>
          </p>
        ) : participant ? (
          <div className="space-y-1 rounded-xl border p-5">
            <h2 className="font-semibold">Hi {participant}, you&apos;re signed in</h2>
            <p className="text-sm text-muted-foreground">
              The participant site isn&apos;t ready yet. For now, check in to events with the link
              your program team shares.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={sending} className="h-10 w-full">
              {sending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
