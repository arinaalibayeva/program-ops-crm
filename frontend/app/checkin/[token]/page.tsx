"use client";

import { use, useEffect, useState } from "react";
import { Check, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USE_BACKEND, api } from "@/lib/api";
import { useCohort } from "@/lib/store";
import { formatEventTime } from "@/lib/events";
import { formatDate } from "@/lib/format";
import type { ProgramEvent } from "@/lib/types";

// Remembered on this device so returning participants don't retype it.
const EMAIL_KEY = "program-ops-crm:checkin-email";

type Result =
  | { kind: "checked_in"; firstName: string; already: boolean }
  | { kind: "not_found" | "not_open" | "closed" };

/** What the page shows, from the backend or from this browser's sample data. */
interface CheckinInfo {
  programName: string;
  cohortName: string;
  today: string;
  event: ProgramEvent;
}

type Submit = (email: string) => Promise<Result>;

export default function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return USE_BACKEND ? <BackendCheckin token={token} /> : <LocalCheckin token={token} />;
}

function BackendCheckin({ token }: { token: string }) {
  const [info, setInfo] = useState<CheckinInfo | null>();

  useEffect(() => {
    api<CheckinInfo>(`/checkin/${token}`)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [token]);

  async function submit(email: string): Promise<Result> {
    const r = await api<{ status: string; firstName?: string }>(`/checkin/${token}`, { body: { email } });
    if (r.status === "checked_in" || r.status === "already_checked_in") {
      return { kind: "checked_in", firstName: r.firstName ?? "", already: r.status === "already_checked_in" };
    }
    return { kind: r.status as "not_found" | "not_open" | "closed" };
  }

  if (info === undefined) return <Shell>{null}</Shell>;
  return <CheckinView info={info} submit={submit} />;
}

function LocalCheckin({ token }: { token: string }) {
  const { data, checkIn } = useCohort();
  const event = data.events.find((e) => e.checkinToken === token);

  async function submit(email: string): Promise<Result> {
    const person = data.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    const enrollment = person
      ? data.enrollments.find((en) => en.personId === person.id && en.status === "active")
      : undefined;
    if (!event || !person || !enrollment) return { kind: "not_found" };
    const already = data.attendance.some(
      (a) => a.eventId === event.id && a.enrollmentId === enrollment.id,
    );
    checkIn(event.id, enrollment.id);
    return { kind: "checked_in", firstName: person.name.split(" ")[0], already };
  }

  const info = event
    ? { programName: data.program.name, cohortName: data.cohort.name, today: data.today, event }
    : null;
  return <CheckinView info={info} submit={submit} />;
}

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
          PO
        </div>
        {subtitle && <span className="text-sm text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </main>
  );
}

function CheckinView({ info, submit }: { info: CheckinInfo | null; submit: Submit }) {
  if (!info) {
    return (
      <Shell>
        <Message
          title="This check-in link doesn't work"
          text="It may have been typed wrong or the event was removed. Ask the program team for the current link."
        />
      </Shell>
    );
  }
  return (
    <Shell subtitle={`${info.programName} · ${info.cohortName}`}>
      <CheckinForm event={info.event} today={info.today} submit={submit} />
    </Shell>
  );
}

function CheckinForm({ event, today, submit }: { event: ProgramEvent; today: string; submit: Submit }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Result>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    try {
      setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    } catch {
      // Storage unavailable: start with an empty field.
    }
  }, []);

  const lastDay = event.endDate ?? event.date;
  const opensLater = today < event.date || result?.kind === "not_open";
  const closed = today > lastDay || result?.kind === "closed";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const r = await submit(email);
      setResult(r);
      if (r.kind === "checked_in") {
        try {
          localStorage.setItem(EMAIL_KEY, email.trim());
        } catch {
          // Not remembered next time; check-in still worked.
        }
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Check in</p>
        <h1 className="text-3xl font-semibold leading-tight">{event.title}</h1>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" />
            {formatDate(event.date, { weekday: true })}
            {event.endDate && ` – ${formatDate(event.endDate, { weekday: true })}`},{" "}
            {formatEventTime(event)}
          </p>
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" />
              {/^https?:\/\//.test(event.location) ? "Online" : event.location}
            </p>
          )}
        </div>
      </header>

      {result?.kind === "checked_in" ? (
        <div className="space-y-5 rounded-xl border p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">
              {result.already ? "You're already checked in" : `You're checked in, ${result.firstName}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {result.already
                ? "No need to do anything else. Enjoy the event!"
                : "Thanks! Your attendance has been recorded."}
            </p>
          </div>
        </div>
      ) : opensLater ? (
        <Message
          title={`Check-in opens on ${formatDate(event.date, { weekday: true })}`}
          text="Come back to this link on the day of the event."
        />
      ) : closed ? (
        <Message
          title="Check-in for this event has closed"
          text="If you attended but didn't check in, let the program team know."
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Your email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResult(undefined);
              }}
              placeholder="The email you registered with"
              className="h-11 text-base"
            />
          </div>
          {result?.kind === "not_found" && (
            <p className="text-sm text-destructive">
              We couldn&apos;t find an active participant with that email. Check the spelling,
              or ask the program team to add you.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" disabled={sending} className="h-11 w-full text-base">
            {sending ? "Checking in…" : "Check in"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-1 rounded-xl border p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
