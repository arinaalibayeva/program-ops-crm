"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USE_BACKEND, api } from "@/lib/api";

interface SignedIn {
  name: string;
  role: "manager" | "admin" | "participant";
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

function BrandPanel() {
  return (
    <section className="px-6 pt-8 text-white sm:px-10 lg:px-16 lg:pt-14">
      <div className="text-sm font-semibold tracking-tight">Program Ops</div>
      <div className="mt-10 max-w-lg space-y-4 lg:mt-24">
        <h2 className="text-3xl leading-[1.1] font-semibold tracking-tight lg:text-5xl">
          See who needs you before it&apos;s too late.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-white/75 lg:text-base">
          Participants, teams, partners and events in one place, so nobody slips through the cracks.
        </p>
      </div>
    </section>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [participant, setParticipant] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const user = await api<SignedIn>("/auth/login", { body: { email, password } });
      if (user.role !== "participant") {
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
    <main className="bg-dusk grid min-h-screen content-start gap-10 pb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:content-stretch lg:gap-0 lg:pb-0">
      <BrandPanel />
      <section className="flex items-center justify-center px-4 sm:px-10">
        <div className="w-full max-w-md space-y-7 rounded-2xl bg-card p-7 shadow-[0_24px_60px_-28px_oklch(0.25_0.08_258/0.55)] sm:p-9">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your program.</p>
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
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={sending} className="h-11 w-full">
                {sending ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Trouble signing in? Ask your manager for a new link.
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
