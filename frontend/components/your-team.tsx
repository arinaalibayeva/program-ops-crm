"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { initials } from "@/lib/format";
import { partnersOf } from "@/lib/partners";
import { useCohort } from "@/lib/store";

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
      {initials(name || "?")}
    </div>
  );
}

/** Everyone who runs this program and what each of them looks after. */
export function YourTeam({ you }: { you?: string }) {
  const { data } = useCohort();
  const partners = partnersOf(data);

  return (
    <ul className="divide-y">
      {data.staff.map((person) => {
        const teams = data.teams.filter((t) => t.ownerId === person.id);
        const theirs = partners.filter((p) => p.ownerId === person.id);
        return (
          <li key={person.id} className="flex items-start gap-3 py-3">
            <Avatar name={person.name} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {person.name}
                {person.id === you && <span className="font-normal text-muted-foreground"> (you)</span>}
              </div>
              {person.jobTitle && <div className="text-xs text-muted-foreground">{person.jobTitle}</div>}
              <div className="mt-1 text-xs text-muted-foreground">
                {teams.length === 0 && theirs.length === 0 ? (
                  "Nothing assigned yet"
                ) : (
                  <>
                    <Link href={`/admin/teams?owner=${person.id}`} className="underline underline-offset-2">
                      {teams.length} {teams.length === 1 ? "team" : "teams"}
                    </Link>
                    {" · "}
                    <Link href={`/admin/partners?owner=${person.id}`} className="underline underline-offset-2">
                      {theirs.length} {theirs.length === 1 ? "partner" : "partners"}
                    </Link>
                  </>
                )}
              </div>
            </div>
            <a
              href={`mailto:${person.email}`}
              aria-label={`Email ${person.name}`}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Mail className="size-4" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
