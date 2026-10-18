import { CalendarDays, CircleUserRound, Handshake, Sun, Users, UsersRound } from "lucide-react";

/** The main sections, in dock order. */
export const DOCK_ITEMS = [
  { href: "/admin", label: "Today", icon: Sun },
  { href: "/admin/participants", label: "People", icon: Users },
  { href: "/admin/teams", label: "Teams", icon: UsersRound },
  { href: "/admin/events", label: "Calendar", icon: CalendarDays },
  { href: "/admin/partners", label: "Partners", icon: Handshake },
  { href: "/admin/profile", label: "Profile", icon: CircleUserRound },
];
