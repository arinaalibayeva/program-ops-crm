"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/format";
import { followUpsOf, noteSubject } from "@/lib/notes";
import { usePersonalItems } from "@/lib/personal";
import { useCohort } from "@/lib/store";
import { cn } from "@/lib/utils";

const removeButton =
  "shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100";

type Personal = ReturnType<typeof usePersonalItems>;
type FollowUp = ReturnType<typeof followUpsOf>[number];
type Todo = NonNullable<Personal["items"]>[number];

export type Tab = { label: string; count?: number; content: React.ReactNode };

/** One card holding related lists, one shown at a time. */
export function TabbedCard({
  title,
  tabs,
  className,
}: {
  title?: string;
  tabs: Tab[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  return (
    <Card className={cn("gap-3 rounded-2xl p-5", className)}>
      {title && <h2 className="font-semibold">{title}</h2>}
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-[3px]">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors",
              i === active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs[active].label}>
        {tabs[active].content}
      </div>
    </Card>
  );
}

/** Your to-dos and notes in one place. */
export function MyListCard({
  personal,
  followUps,
  className,
}: {
  personal: Personal;
  followUps: FollowUp[];
  className?: string;
}) {
  const todos = (personal.items ?? []).filter(
    (i) => i.kind === "todo" && !i.done,
  ).length;
  const notes = (personal.items ?? []).filter((i) => i.kind === "note").length;
  return (
    <TabbedCard
      className={className}
      tabs={[
        {
          label: "To do",
          count: todos + followUps.filter((n) => !n.followUpDone).length,
          content: <TodoList personal={personal} followUps={followUps} />,
        },
        {
          label: "Notes",
          count: notes || undefined,
          content: <NotesList personal={personal} />,
        },
      ]}
    />
  );
}

/** Your own tasks, plus follow-ups from notes, which tick off the same way. */
function TodoList({
  personal,
  followUps,
}: {
  personal: Personal;
  followUps: FollowUp[];
}) {
  const [draft, setDraft] = useState("");
  const [description, setDescription] = useState("");
  const todos = (personal.items ?? []).filter((i) => i.kind === "todo");
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);
  const openFollowUps = followUps.filter((n) => !n.followUpDone);
  const doneFollowUps = followUps.filter((n) => n.followUpDone);
  // Finished items stay out of the way until asked for.
  const [showDone, setShowDone] = useState(false);
  const doneCount = done.length + doneFollowUps.length;

  function save() {
    if (!draft.trim()) return;
    personal.add("todo", draft, description);
    setDraft("");
    setDescription("");
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-2"
      >
        <div className="relative">
          <Input
            aria-label="New to-do"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a to-do"
            className="h-9 pr-9"
          />
          <button
            type="submit"
            aria-label="Add to-do"
            disabled={!draft.trim()}
            className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {(draft || description) && (
          <textarea
            aria-label="To-do description"
            rows={2}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
            placeholder="Description (optional)"
            className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        )}
      </form>

      <ul className="divide-y">
        {openFollowUps.map((note) => (
          <FollowUpRow key={note.id} note={note} />
        ))}
        {open.map((todo) => (
          <TodoRow key={todo.id} todo={todo} personal={personal} />
        ))}
        {showDone && (
          <>
            {doneFollowUps.map((note) => (
              <FollowUpRow key={note.id} note={note} />
            ))}
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} personal={personal} />
            ))}
          </>
        )}
      </ul>
      {personal.items && open.length + openFollowUps.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {doneCount ? "All done." : "Nothing to do yet."}
        </p>
      )}
      {doneCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDone(!showDone)}
          className="text-left text-xs font-medium text-ocean-600 hover:underline"
        >
          {showDone ? "Hide done" : `Show ${doneCount} done`}
        </button>
      )}
      {personal.error && (
        <p className="text-sm text-destructive">{personal.error}</p>
      )}
    </div>
  );
}

function TodoRow({ todo, personal }: { todo: Todo; personal: Personal }) {
  return (
    <li className="group flex items-start gap-2.5 py-2 text-sm">
      <Checkbox
        className="mt-0.5"
        checked={todo.done}
        onCheckedChange={(checked) =>
          personal.setDone(todo.id, checked === true)
        }
        aria-label={`Mark "${todo.body}" ${todo.done ? "not done" : "done"}`}
      />
      <div
        className={cn(
          "min-w-0 flex-1 break-words",
          todo.done && "text-muted-foreground line-through",
        )}
      >
        <div className="font-medium">{todo.body}</div>
        {todo.description && (
          <div className="whitespace-pre-wrap text-muted-foreground">
            {todo.description}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label={`Delete "${todo.body}"`}
        onClick={() => personal.remove(todo.id)}
        className={removeButton}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** A follow-up from a note. Ticking it crosses it off; it stays in the list. */
function FollowUpRow({ note }: { note: FollowUp }) {
  const { data, updateNote } = useCohort();
  const subject = noteSubject(data, note);
  const done = note.followUpDone;
  const overdue = !done && note.followUpDate < data.today;
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Checkbox
        className="mt-0.5"
        checked={done}
        onCheckedChange={(checked) =>
          updateNote(note.id, { followUpDone: checked === true })
        }
        aria-label={`Mark follow-up with ${subject.label} ${done ? "not done" : "done"}`}
      />
      <div
        className={cn(
          "min-w-0 flex-1 text-sm",
          done && "text-muted-foreground line-through",
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={subject.href}
            className="min-w-0 truncate font-medium hover:underline"
          >
            {subject.label}
          </Link>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              overdue ? "font-medium" : "text-muted-foreground",
            )}
          >
            {overdue && (
              <span className="mr-1 inline-block size-1.5 rounded-full bg-ocean-900 align-middle" />
            )}
            {formatDate(note.followUpDate)}
          </span>
        </div>
        <div className="line-clamp-1 text-muted-foreground">{note.body}</div>
      </div>
    </li>
  );
}

function NotesList({ personal }: { personal: Personal }) {
  const [draft, setDraft] = useState("");
  const notes = (personal.items ?? []).filter((i) => i.kind === "note");

  function save() {
    if (!draft.trim()) return;
    personal.add("note", draft);
    setDraft("");
  }

  return (
    <div className="space-y-3">
      <textarea
        aria-label="New note"
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        placeholder="Write something down, press Enter to save"
        className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <ul className="max-h-72 divide-y overflow-y-auto">
        {notes.map((note) => (
          <li key={note.id} className="group flex items-start gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm break-words whitespace-pre-wrap">
                {note.body}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(note.createdAt)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Delete note"
              onClick={() => personal.remove(note.id)}
              className={removeButton}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {personal.items && notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
