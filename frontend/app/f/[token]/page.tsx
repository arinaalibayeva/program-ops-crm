"use client";

import { use, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldInput } from "@/components/field-input";
import { USE_BACKEND, api } from "@/lib/api";
import { asFieldDefinition, validateRecord } from "@/lib/records";
import { useCohort } from "@/lib/store";
import type { FieldValue, RecordField } from "@/lib/types";

// Shared with check-in, so people only type their email once per device.
const EMAIL_KEY = "program-ops-crm:checkin-email";

interface FormInfo {
  title: string;
  description?: string;
  programName: string;
  roster: boolean;
  fields: RecordField[];
}

type Result = { status: "saved"; name?: string } | { status: "not_found" | "closed" };
type Submit = (email: string, values: Record<string, FieldValue>) => Promise<Result>;

export default function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return USE_BACKEND ? <BackendForm token={token} /> : <LocalForm token={token} />;
}

function BackendForm({ token }: { token: string }) {
  const [info, setInfo] = useState<FormInfo | null>();

  useEffect(() => {
    api<FormInfo>(`/f/${token}`)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [token]);

  const submit: Submit = (email, values) => api<Result>(`/f/${token}`, { body: { email, values } });

  if (info === undefined) return <Shell>{null}</Shell>;
  return <FormView info={info} submit={submit} />;
}

/** Without the backend, the form adds to this browser's sample data. */
function LocalForm({ token }: { token: string }) {
  const { data, addRecord } = useCohort();
  const form = data.forms.find((f) => f.token === token);
  const type = form && data.recordTypes.find((t) => t.id === form.typeId);

  const submit: Submit = async (email, values) => {
    if (!form || !type) return { status: "not_found" };
    if (!form.isOpen) return { status: "closed" };
    const asked = Object.fromEntries(Object.entries(values).filter(([k]) => form.fieldIds.includes(k)));
    let name: string | undefined;
    if (form.roster) {
      const person = data.people.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
      const enrollment = person && data.enrollments.find((e) => e.personId === person.id && e.status === "active");
      if (!person || !enrollment) return { status: "not_found" };
      name = person.name;
      const teamId = data.memberships.find((m) => m.enrollmentId === enrollment.id && !m.endDate)?.teamId;
      for (const f of type.fields) {
        if (f.type !== "link") continue;
        const id = f.linkTo === "participant" ? enrollment.id : f.linkTo === "team" ? teamId : undefined;
        if (id) asked[f.id] = f.multiple ? [id] : id;
      }
    }
    addRecord(type.id, asked);
    return { status: "saved", name };
  };

  const info: FormInfo | null =
    form && type
      ? {
          title: form.title,
          description: form.description,
          programName: data.program.name,
          roster: form.roster,
          fields: form.fieldIds
            .map((id) => type.fields.find((f) => f.id === id))
            .filter((f): f is RecordField => !!f),
        }
      : null;
  return <FormView info={info} submit={submit} />;
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

function FormView({ info, submit }: { info: FormInfo | null; submit: Submit }) {
  const [email, setEmail] = useState("");
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result>();

  useEffect(() => {
    try {
      setEmail(localStorage.getItem(EMAIL_KEY) ?? "");
    } catch {
      // Storage can be blocked; they just type it.
    }
  }, []);

  if (!info) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">This form link doesn&apos;t work</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been typed wrong or the form was removed. Ask the program team for the current link.
        </p>
      </Shell>
    );
  }

  if (result?.status === "saved") {
    return (
      <Shell subtitle={info.programName}>
        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Thanks{result.name ? `, ${result.name.split(" ")[0]}` : ""}!</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your response was saved.</p>
        <Button
          variant="outline"
          className="mt-6 self-start"
          onClick={() => {
            setValues({});
            setResult(undefined);
          }}
        >
          Submit another
        </Button>
      </Shell>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (info!.roster && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter your email.");
    const problem = validateRecord({ id: "", programId: "", name: "", singular: "", fields: info!.fields }, values);
    if (problem) return setError(problem);
    setSending(true);
    setError(undefined);
    try {
      const r = await submit(email.trim(), values);
      if (r.status === "not_found") setError("We couldn't find that email in the program. Use the one you signed up with.");
      else if (r.status === "closed") setError("This form isn't accepting responses right now.");
      else {
        try {
          if (info!.roster) localStorage.setItem(EMAIL_KEY, email.trim());
        } catch {
          // Not remembering it is fine.
        }
        setResult(r);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Shell subtitle={info.programName}>
      <h1 className="text-xl font-semibold">{info.title}</h1>
      {info.description && <p className="mt-2 text-sm text-muted-foreground">{info.description}</p>}
      <form onSubmit={send} className="mt-6 space-y-4">
        {info.roster && (
          <div className="space-y-1.5">
            <Label htmlFor="form-email">Your email</Label>
            <Input
              id="form-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="The email you signed up with"
            />
          </div>
        )}
        {info.fields.map((f) => (
          <div key={f.id} className="space-y-1.5">
            <Label htmlFor={`f-${f.id}`}>
              {f.label}
              {!f.required && <span className="font-normal text-muted-foreground">(optional)</span>}
            </Label>
            <FieldInput
              id={`f-${f.id}`}
              field={asFieldDefinition(f)}
              value={values[f.id]}
              onChange={(v) => setValues({ ...values, [f.id]: v })}
            />
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={sending}>
          {sending ? "Sending…" : "Submit"}
        </Button>
      </form>
    </Shell>
  );
}
