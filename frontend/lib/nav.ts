import { CalendarDays, CircleUserRound, Handshake, Sun, Upload, Users, UsersRound } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: typeof Sun;
}

/** A dock item is a link, or a stack of links that fans out above it like a macOS dock folder. */
export type DockItem = NavLink & { stack?: NavLink[] };

/** The main sections, in dock order. */
export const DOCK_ITEMS: DockItem[] = [
  { href: "/admin", label: "Today", icon: Sun },
  {
    href: "/admin/participants",
    label: "People",
    icon: Users,
    stack: [
      { href: "/admin/participants", label: "People", icon: Users },
      { href: "/admin/teams", label: "Teams", icon: UsersRound },
      { href: "/admin/import", label: "Import", icon: Upload },
    ],
  },
  { href: "/admin/events", label: "Calendar", icon: CalendarDays },
  { href: "/admin/partners", label: "Partners", icon: Handshake },
  { href: "/admin/profile", label: "Profile", icon: CircleUserRound },
];

/** Every page the dock reaches, stacks flattened. */
export const NAV_LINKS: NavLink[] = DOCK_ITEMS.flatMap((item) => item.stack ?? [item]);
