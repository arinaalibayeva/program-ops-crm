"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { targetName } from "@/lib/records";
import { useCohort } from "@/lib/store";

/** "Partner meetings" -> "Partner meeting", as a starting suggestion. */
function guessSingular(name: string): string {
  const t = name.trim();
  if (/ies$/i.test(t)) return t.slice(0, -3) + "y";
  if (/(ss|us)$/i.test(t)) return t;
  return t.replace(/s$/i, "");
}

export default function CustomizePage() {
  const { data } = useCohort();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Customize"
        description="Add your own kinds of records, link them to teams, people and events, and track what matters."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New record type
          </Button>
        }
      />

      {data.recordTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No record types yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.recordTypes.map((t) => {
            const count = data.records.filter((r) => r.typeId === t.id).length;
            const links = [...new Set(t.fields.filter((f) => f.type === "link").map((f) => f.linkTo!))];
            const calcs = data.calculations.filter((c) => c.sourceTypeId === t.id).length;
            const forms = data.forms.filter((f) => f.typeId === t.id).length;
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/customize/${t.id}`}
                  className="group block h-full rounded-xl border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {count} {count === 1 ? "record" : "records"} · {t.fields.length} fields
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {links.length > 0 ? `Linked to ${links.map((l) => targetName(data, l)).join(", ")}` : "Not linked yet"}
                    {calcs > 0 && ` · ${calcs} calculation${calcs === 1 ? "" : "s"}`}
                    {forms > 0 && ` · ${forms} form${forms === 1 ? "" : "s"}`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-12 max-w-2xl space-y-2 border-t text-sm text-muted-foreground">
        <h2 className="pt-8 font-medium text-foreground">How it fits together</h2>
        <p>
          <span className="font-medium text-foreground">Record types</span> are the things you track, like partner
          meetings, submissions or issues. Give them fields, and link them to teams, participants, events or each
          other. Linked records show up on those pages.
        </p>
        <p>
          <span className="font-medium text-foreground">Calculations</span> work out numbers from linked records,
          like the days since a team&apos;s last meeting. <span className="font-medium text-foreground">Rules</span>{" "}
          flag a team or person on Today when a number crosses a line.
        </p>
        <p>
          <span className="font-medium text-foreground">Forms</span> are links you share so people add records
          themselves, matched to them by email.
        </p>
      </section>

      <NewTypeDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function NewTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <NewTypeForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function NewTypeForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const { addRecordType } = useCohort();
  const [name, setName] = useState("");
  const [singular, setSingular] = useState("");
  const [singularEdited, setSingularEdited] = useState(false);
  const [error, setError] = useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !singular.trim()) return setError("Enter both names.");
    const id = addRecordType({ name: name.trim(), singular: singular.trim() });
    onDone();
    router.push(`/admin/customize/${id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>New record type</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="type-name">Name</Label>
        <Input
          id="type-name"
          autoFocus
          value={name}
          placeholder="e.g. Submissions, Mentor sessions, Sponsors"
          onChange={(e) => {
            setName(e.target.value);
            if (!singularEdited) setSingular(guessSingular(e.target.value));
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type-singular">One record is called</Label>
        <Input
          id="type-singular"
          value={singular}
          placeholder="e.g. Submission"
          onChange={(e) => {
            setSingular(e.target.value);
            setSingularEdited(true);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  );
}
