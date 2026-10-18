"use client";

import { useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { initials } from "@/lib/format";
import { SAMPLE_STAFF, YOU, type StaffMember } from "@/lib/org-chart";
import type { Profile } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** The sample staff with the signed-in admin filled in as "you". */
export function staffWithYou(profile: Profile): StaffMember[] {
  return SAMPLE_STAFF.map((s) =>
    s.id === YOU
      ? { ...s, name: profile.name, title: profile.jobTitle || s.title, email: profile.email }
      : s,
  );
}

function Avatar({ name, you, small }: { name: string; you?: boolean; small?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "size-8 text-xs" : "size-10 text-sm",
        you ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
      )}
    >
      {initials(name || "?")}
    </div>
  );
}

function PersonRow({ person }: { person: StaffMember }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Avatar name={person.name} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{person.name}</div>
        <div className="text-xs text-muted-foreground">{person.title}</div>
        <div className="mt-0.5 text-xs">{person.focus}</div>
      </div>
      {person.email && (
        <a
          href={`mailto:${person.email}`}
          aria-label={`Email ${person.name}`}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Mail className="size-4" />
        </a>
      )}
    </li>
  );
}

/** Who you report to, who you work alongside, and who reports to you. */
export function YourTeam({ staff }: { staff: StaffMember[] }) {
  const you = staff.find((s) => s.id === YOU)!;
  const manager = staff.find((s) => s.id === you.managerId);
  const groups = [
    { title: "You report to", people: manager ? [manager] : [] },
    {
      title: "Works alongside you",
      people: staff.filter((s) => s.id !== YOU && s.managerId === you.managerId),
    },
    { title: "Reports to you", people: staff.filter((s) => s.managerId === YOU) },
  ].filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {g.title}
          </h3>
          <ul className="divide-y">
            {g.people.map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ChartCard({ person }: { person: StaffMember }) {
  const you = person.id === YOU;
  return (
    <div
      data-you={you || undefined}
      className={cn(
        "mx-auto flex w-44 flex-col items-center gap-1.5 rounded-xl border bg-background p-3 text-center",
        you && "border-primary ring-2 ring-primary/20",
      )}
    >
      <Avatar name={person.name} you={you} small />
      <div>
        <div className="text-sm leading-tight font-medium">
          {person.name}
          {you && <span className="font-normal text-muted-foreground"> (you)</span>}
        </div>
        <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{person.title}</div>
      </div>
      <div className="text-[11px] leading-tight">{person.focus}</div>
    </div>
  );
}

// Connectors: each child draws the top line over its half of the row and a
// stub down to its card; the first and last children trim the outer halves.
const branch = cn(
  "relative px-2 pt-5",
  "before:absolute before:top-0 before:left-0 before:w-1/2 before:border-t before:content-['']",
  "after:absolute after:top-0 after:left-1/2 after:h-5 after:w-1/2 after:border-t after:border-l after:content-['']",
  "before:border-border after:border-border first:before:border-t-0 last:after:border-t-0",
);

function Branch({ person, staff }: { person: StaffMember; staff: StaffMember[] }) {
  const reports = staff.filter((s) => s.managerId === person.id);
  return (
    <>
      <ChartCard person={person} />
      {reports.length > 0 && (
        <>
          <div className="mx-auto h-5 w-px bg-border" aria-hidden />
          <ul className="flex justify-center">
            {reports.map((r) => (
              <li key={r.id} className={branch}>
                <Branch person={r} staff={staff} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** The whole organization as a tree, top to bottom. Scrolls sideways on small screens. */
export function OrgChart({ staff }: { staff: StaffMember[] }) {
  const roots = staff.filter((s) => !s.managerId);
  const scroller = useRef<HTMLDivElement>(null);

  // When the chart is wider than the screen, start with your own card in view.
  useEffect(() => {
    const box = scroller.current;
    const you = box?.querySelector<HTMLElement>("[data-you]");
    if (!box || !you || box.scrollWidth <= box.clientWidth) return;
    const offset = you.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollLeft += offset - (box.clientWidth - you.offsetWidth) / 2;
  }, []);

  return (
    <div ref={scroller} className="overflow-x-auto pb-2">
      <div className="mx-auto w-max min-w-full">
        {roots.map((r) => (
          <div key={r.id}>
            <Branch person={r} staff={staff} />
          </div>
        ))}
      </div>
    </div>
  );
}
