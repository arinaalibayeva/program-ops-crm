import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  Handshake,
  Layers,
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

/** The main sections, in dock order; the records stack is filled in by dockItems(). */
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
  {
    href: "/admin/requirements",
    label: "Requirements",
    short: "Rules",
    icon: ClipboardCheck,
    stack: [
      { href: "/admin/requirements", label: "Requirements", icon: ClipboardCheck },
      { href: "/admin/deadlines", label: "Deadlines", icon: CalendarClock },
    ],
  },
  { href: "/admin/partners", label: "Partners", icon: Handshake },
  { href: "/admin/records", label: "Records", icon: Layers, stack: [] },
];

/** The dock for this program: its own record types go in the Records stack. */
export function dockItems(recordTypes: RecordType[]): DockItem[] {
  return DOCK_ITEMS.map((item) =>
    item.href === "/admin/records"
      ? {
          ...item,
          stack: [
            ...recordTypes.map((t) => ({ href: `/admin/records/${t.id}`, label: t.name, icon: Rows3 })),
            { href: "/admin/customize", label: "Customize", icon: Settings2 },
          ],
        }
      : item,
  );
}

/** Every page the dock reaches, stacks flattened. */
export function navLinks(recordTypes: RecordType[]): NavLink[] {
  return dockItems(recordTypes).flatMap((item) => item.stack ?? [item]);
}
