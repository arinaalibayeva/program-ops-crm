"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTime } from "@/lib/events";
import { formatDate } from "@/lib/format";
import { useCohort } from "@/lib/store";
import type { ProgramEvent } from "@/lib/types";

// CCP assignments are due at 11 pm PT, so new deadlines start there.
const DEFAULT_TIME = "23:00";

function daysLeft(today: string, date: string): string {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (days < 0) return "Passed";
  if (days === 0) return "Due today";
  return days === 1 ? "Due tomorrow" : `In ${days} days`;
}

/** Deadlines are calendar events, so every change here shows on the calendar too. */
export function DeadlineList() {
  const { data, deleteEvent } = useCohort();
  const [editing, setEditing] = useState<ProgramEvent | "new">();
  const [confirming, setConfirming] = useState<string>();
  const deadlines = data.events
    .filter((e) => e.category === "deadline")
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> New deadline
        </Button>
      </div>
      <Card className="py-0">
        <ul className="divide-y">
          {deadlines.map((deadline) => (
            <li key={deadline.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <div className="text-sm font-medium">{deadline.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[
                    formatDate(deadline.date, { weekday: true }),
                    deadline.startTime && formatTime(deadline.startTime),
                    deadline.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">{daysLeft(data.today, deadline.date)}</span>
              {confirming === deadline.id ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      deleteEvent(deadline.id);
                      setConfirming(undefined);
                    }}
                  >
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(undefined)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <div className="flex gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${deadline.title}`}
                    onClick={() => setEditing(deadline)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${deadline.title}`}
                    onClick={() => setConfirming(deadline.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {deadlines.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No deadlines yet.</li>}
        </ul>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <DeadlineForm
              deadline={editing === "new" ? undefined : editing}
              onDone={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeadlineForm({ deadline, onDone }: { deadline?: ProgramEvent; onDone: () => void }) {
  const { data, addEvent, updateEvent } = useCohort();
  const [title, setTitle] = useState(deadline?.title ?? "");
  const [date, setDate] = useState(deadline?.date ?? data.today);
  const [time, setTime] = useState(deadline ? (deadline.startTime ?? "") : DEFAULT_TIME);
  const [location, setLocation] = useState(deadline?.location ?? "Forum");
  const [description, setDescription] = useState(deadline?.description ?? "");
  const [error, setError] = useState<string>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Enter a title.");
    if (!date) return setError("Pick a date.");
    const values = {
      title: title.trim(),
      date,
      startTime: time || undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (deadline) updateEvent(deadline.id, values);
    else addEvent({ ...values, category: "deadline", isRequired: true });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{deadline ? "Edit deadline" : "New deadline"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="deadline-title">Title</Label>
        <Input id="deadline-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="deadline-date">Due date</Label>
          <Input id="deadline-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deadline-time">Due time</Label>
          <Input id="deadline-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deadline-location">Submitted on</Label>
        <Input id="deadline-location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="deadline-description">Details</Label>
        <textarea
          id="deadline-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{deadline ? "Save" : "Add deadline"}</Button>
      </DialogFooter>
    </form>
  );
}
