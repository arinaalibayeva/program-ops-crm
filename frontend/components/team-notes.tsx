"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCohort } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import type { TeamNote } from "@/lib/types";

const textarea =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** ⌘↵ or Ctrl+↵ saves, like most note and chat boxes. */
function savesOn(e: React.KeyboardEvent, save: () => void) {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    save();
  }
}

/** Free-form notes about a team, newest first, so they're there next time. */
export function TeamNotes({ teamId }: { teamId: string }) {
  const { data, addTeamNote } = useCohort();
  const [draft, setDraft] = useState("");
  const notes = data.teamNotes.filter((n) => n.teamId === teamId);

  function save() {
    if (!draft.trim()) return;
    addTeamNote(teamId, draft);
    setDraft("");
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
            placeholder="What happened with this team? Meetings, concerns, decisions…"
            className={textarea}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">⌘↵ to save</span>
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

function NoteItem({ note }: { note: TeamNote }) {
  const { updateTeamNote, deleteTeamNote } = useCohort();
  const [editing, setEditing] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  function save() {
    if (!editing?.trim()) return;
    if (editing.trim() !== note.body) updateTeamNote(note.id, editing);
    setEditing(undefined);
  }

  const action = "text-muted-foreground hover:text-foreground";

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
                <button type="button" className="font-medium text-destructive" onClick={() => deleteTeamNote(note.id)}>
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
    </li>
  );
}
