"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  RotateCcw,
  Upload,
  Users,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohort } from "@/lib/store";
import { cohortWeek } from "@/lib/format";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/teams", label: "Teams", icon: UsersRound },
  { href: "/admin/events", label: "Events", icon: CalendarDays },
  { href: "/admin/requirements", label: "Requirements", icon: ClipboardCheck },
  { href: "/admin/import", label: "Import", icon: Upload },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data, reset } = useCohort();
  const week = cohortWeek(data.cohort.startDate, data.today);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            PO
          </div>
          <span className="font-semibold">Program Ops</span>
        </div>
      </div>

      <div className="border-b px-4 py-3">
        <div className="text-xs text-muted-foreground">Program</div>
        <div className="text-sm font-medium">{data.program.name}</div>
        <div className="mt-2 text-xs text-muted-foreground">Cohort</div>
        <div className="flex items-center justify-between text-sm font-medium">
          {data.cohort.name}
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
            Week {week}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground/70">
          Spring 2026 · archived
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
            AD
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Demo Admin</div>
            <div className="truncate text-xs text-muted-foreground">
              admin@demo.test
            </div>
          </div>
        </div>
        <button
          onClick={reset}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Reset demo data
        </button>
      </div>
    </aside>
  );
}
