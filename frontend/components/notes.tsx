"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCohort } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Note, NoteSubject } from "@/lib/types";

const textarea =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** ⌘↵ or Ctrl+↵ saves, like most note and chat boxes. */
function savesOn(e: React.KeyboardEvent, save: () => void) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    save();
  }
}

/** Free-form notes about a person, team or partner, newest first, so they're there next time. */
export function Notes({ subjectType, subjectId }: { subjectType: NoteSubject; subjectId: string }) {
  const { data, addNote } = useCohort();
  const [draft, setDraft] = useState("");
  const [followUp, setFollowUp] = useState("");
  const notes = data.notes.filter((n) => n.subjectType === subjectType && n.subjectId === subjectId);

  function save() {
    if (!draft.trim()) return;
    addNote(subjectType, subjectId, draft, followUp || undefined);
    setDraft("");
    setFollowUp("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes{notes.length > 0 && ` (${notes.length})`}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <textarea
            aria-label="New note"
            maxLength={10000}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => savesOn(e, save)}
            placeholder="What happened? Meetings, concerns, decisions…"
            className={textarea}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Follow up by
              <Input
                type="date"
                aria-label="Follow up by"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="h-8 w-36"
              />
            </label>
            <Button size="sm" onClick={save} disabled={!draft.trim()}>
              Save note
            </Button>
          </div>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-4 border-t pt-4">
            {notes.map((note) => (
              <NoteItem key={note.id} note={note} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoteItem({ note }: { note: Note }) {
  const { data, updateNote, deleteNote } = useCohort();
  const [editing, setEditing] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  function save() {
    if (!editing?.trim()) return;
    if (editing.trim() !== note.body) updateNote(note.id, { body: editing });
    setEditing(undefined);
  }

  const action = "text-muted-foreground hover:text-foreground";
  const overdue = !note.followUpDone && !!note.followUpDate && note.followUpDate < data.today;

  return (
    <li className="group space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatDateTime(note.createdAt)}
          {note.author && ` · ${note.author}`}
          {note.updatedAt && " · edited"}
        </span>
        {editing === undefined && (
          // Shown on hover with a mouse; always shown on touch screens.
          <span className="flex shrink-0 gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
            {confirming ? (
              <>
                <button type="button" className="font-medium text-destructive" onClick={() => deleteNote(note.id)}>
                  Delete
                </button>
                <button type="button" className={action} onClick={() => setConfirming(false)}>
                  Keep
                </button>
              </>
            ) : (
              <>
                <button type="button" className={action} onClick={() => setEditing(note.body)}>
                  Edit
                </button>
                <button type="button" className={action} onClick={() => setConfirming(true)}>
                  Delete
                </button>
              </>
            )}
          </span>
        )}
      </div>
      {editing === undefined ? (
        <p className="text-sm whitespace-pre-wrap">{note.body}</p>
      ) : (
        <div className="space-y-2">
          <textarea
            aria-label="Edit note"
            maxLength={10000}
            autoFocus
            rows={Math.min(10, Math.max(3, editing.split("\n").length))}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            onKeyDown={(e) => {
              savesOn(e, save);
              if (e.key === "Escape") setEditing(undefined);
            }}
            className={textarea}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={!editing.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}
      {note.followUpDate && (
        <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <Checkbox
            checked={note.followUpDone}
            onCheckedChange={() => updateNote(note.id, { followUpDone: !note.followUpDone })}
            aria-label={`Follow-up done, due ${formatDate(note.followUpDate)}`}
          />
          <span className={overdue ? "font-medium text-foreground" : undefined}>
            Follow up by {formatDate(note.followUpDate)}
            {overdue && " · overdue"}
            {note.followUpDone && " · done"}
          </span>
        </label>
      )}
    </li>
  );
}
