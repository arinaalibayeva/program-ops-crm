"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CircleUserRound,
  CornerDownLeft,
  Handshake,
  KeyRound,
  LogOut,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
  User,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { REQUIRE_SIGN_IN, signOut } from "@/lib/api";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { navLinks } from "@/lib/nav";
import { partnersOf } from "@/lib/partners";
import { recordTitle, typeById } from "@/lib/records";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

/** Results shown per group while searching, so one group can't crowd out the rest. */
const PER_GROUP = 5;

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        {/* Remount on open so the query and selection start fresh. */}
        {open && <CommandList close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CommandList({ close }: { close: () => void }) {
  const router = useRouter();
  const { data, reset } = useCohort();
  const { personFor } = usePeopleIndex();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const all = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      ...navLinks(data.recordTypes).map((item) => ({
        id: item.href,
        group: "Go to",
        label: item.label,
        icon: item.icon,
        run: go(item.href),
      })),
      { id: "profile", group: "Go to", label: "Profile", icon: CircleUserRound, run: go("/admin/profile") },
      { id: "team-access", group: "Go to", label: "Team access", icon: KeyRound, run: go("/admin/access") },
      { id: "fields", group: "Go to", label: "Participant fields", icon: SlidersHorizontal, run: go("/admin/participants/fields") },
      ...data.enrollments.map((e) => ({
        id: e.id,
        group: "People",
        label: personFor(e.id)?.name ?? "Unknown",
        hint: e.status === "active" ? undefined : "Withdrawn",
        icon: User,
        run: go(`/admin/participants/${e.id}`),
      })),
      ...data.teams.map((t) => ({
        id: t.id,
        group: "Teams",
        label: `Team ${t.name}`,
        icon: UsersRound,
        run: go(`/admin/teams/${t.id}`),
      })),
      ...partnersOf(data).map((p) => ({
        id: p.id,
        group: "Partners",
        label: p.name,
        icon: Handshake,
        run: go(`/admin/partners/${p.id}`),
      })),
      ...data.events.map((ev) => ({
        id: ev.id,
        group: "Events",
        label: ev.title,
        hint: formatDate(ev.date, { weekday: true }),
        icon: CalendarDays,
        run: go(`/admin/events/${ev.id}`),
      })),
      ...data.records.map((r) => ({
        id: r.id,
        group: "Records",
        label: recordTitle(data, r),
        hint: typeById(data, r.typeId)?.singular,
        icon: Rows3,
        run: go(`/admin/records/${r.typeId}/${r.id}`),
      })),
      { id: "reset", group: "Actions", label: "Reset demo data", icon: RotateCcw, run: reset },
      ...(REQUIRE_SIGN_IN
        ? [{ id: "sign-out", group: "Actions", label: "Sign out", icon: LogOut, run: signOut }]
        : []),
    ];
  }, [data, personFor, reset, router]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // With no query, offer navigation and actions rather than every record.
    if (!q) return all.filter((c) => c.group === "Go to" || c.group === "Actions");
    const counts = new Map<string, number>();
    return all.filter((c) => {
      if (!c.label.toLowerCase().includes(q)) return false;
      const n = counts.get(c.group) ?? 0;
      counts.set(c.group, n + 1);
      return n < PER_GROUP;
    });
  }, [all, query]);

  const active = Math.min(selected, Math.max(results.length - 1, 0));

  function run(command: Command) {
    close();
    command.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setSelected((active + step + results.length) % Math.max(results.length, 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      run(results[active]);
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          placeholder="Search people, teams, events or pages"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-placeholder"
        />
      </div>
      <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
        {results.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No results.</p>
        )}
        {results.map((command, i) => (
          <div key={command.id}>
            {(i === 0 || results[i - 1].group !== command.group) && (
              <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{command.group}</div>
            )}
            <button
              type="button"
              onClick={() => run(command)}
              onMouseMove={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-3 px-2 py-2 text-left text-sm",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <command.icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{command.label}</span>
              {command.hint && (
                <span className="text-xs text-muted-foreground">{command.hint}</span>
              )}
              {i === active && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
