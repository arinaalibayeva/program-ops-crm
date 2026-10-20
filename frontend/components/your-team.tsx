"use client";

import { Mail } from "lucide-react";
import { initials } from "@/lib/format";
import { SAMPLE_STAFF, YOU, type StaffMember } from "@/lib/staff";
import type { Profile } from "@/lib/profile";

/** The sample staff with the signed-in admin filled in as "you". */
export function staffWithYou(profile: Profile): StaffMember[] {
  return SAMPLE_STAFF.map((s) =>
    s.id === YOU
      ? { ...s, name: profile.name, title: profile.jobTitle || s.title, email: profile.email }
      : s,
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
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
