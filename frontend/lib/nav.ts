import {
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  Handshake,
  Rows3,
  Settings2,
  Sun,
  Upload,
  Users,
  UsersRound,
} from "lucide-react";
import type { RecordType } from "./types";

export interface NavLink {
  href: string;
  label: string;
  /** Shown in the dock on phones, where the full label won't fit. */
  short?: string;
  icon: typeof Sun;
}

/** A dock item is a link, or a stack of links that fans out above it like a macOS dock folder. */
export type DockItem = NavLink & { stack?: NavLink[] };

/** The main sections, in dock order. */
const DOCK_ITEMS: DockItem[] = [
  { href: "/admin", label: "Today", icon: Sun },
  {
    href: "/admin/participants",
    label: "People",
    icon: Users,
    stack: [
      { href: "/admin/participants", label: "Participants", icon: Users },
      { href: "/admin/teams", label: "Teams", icon: UsersRound },
      { href: "/admin/import", label: "Import", icon: Upload },
    ],
  },
  { href: "/admin/events", label: "Calendar", icon: CalendarDays },
  // Deadlines are requirements with a due date, so they live here too.
  { href: "/admin/requirements", label: "Requirements", short: "Rules", icon: ClipboardCheck },
  { href: "/admin/partners", label: "Partners", icon: Handshake },
  { href: "/admin/profile", label: "Profile", icon: CircleUserRound },
];

/** The dock. Records are left out of it for now; search still finds them. */
export function dockItems(): DockItem[] {
  return DOCK_ITEMS;
}

/** Every page search can jump to: the dock's pages, then each kind of record. */
export function navLinks(recordTypes: RecordType[]): NavLink[] {
  return [
    ...DOCK_ITEMS.flatMap((item) => item.stack ?? [item]),
    ...recordTypes.map((t) => ({
      href: `/admin/records/${t.id}`,
      label: t.name,
      icon: Rows3,
    })),
    { href: "/admin/customize", label: "Customize", icon: Settings2 },
  ];
}
