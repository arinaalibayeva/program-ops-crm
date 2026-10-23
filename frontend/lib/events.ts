// Display helpers for events: category names, times and repeating dates.

import type { EventCategory, ProgramEvent } from "./types";

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  workshop: "Workshop",
  talk: "Talk or lecture",
  panel: "Panel",
  meeting: "Meeting",
  "all-hands": "All-hands",
  "office-hours": "Office hours",
  mentoring: "Mentoring or 1:1",
  orientation: "Orientation",
  showcase: "Showcase or demo day",
  partner: "Partner session",
  networking: "Networking",
  social: "Social",
  deadline: "Deadline",
  other: "Other",
};

/** Calendar colors: a soft tile with a strong edge, and a dot for legends. */
export const EVENT_CATEGORY_COLORS: Record<EventCategory, { tile: string; dot: string }> = {
  workshop: { tile: "border-blue-500 bg-blue-100 text-blue-950 hover:bg-blue-200", dot: "bg-blue-500" },
  talk: { tile: "border-sky-500 bg-sky-100 text-sky-950 hover:bg-sky-200", dot: "bg-sky-500" },
  panel: { tile: "border-cyan-500 bg-cyan-100 text-cyan-950 hover:bg-cyan-200", dot: "bg-cyan-500" },
  meeting: { tile: "border-slate-500 bg-slate-200 text-slate-900 hover:bg-slate-300", dot: "bg-slate-500" },
  "all-hands": { tile: "border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-200", dot: "bg-amber-500" },
  "office-hours": { tile: "border-teal-500 bg-teal-100 text-teal-950 hover:bg-teal-200", dot: "bg-teal-500" },
  mentoring: { tile: "border-emerald-500 bg-emerald-100 text-emerald-950 hover:bg-emerald-200", dot: "bg-emerald-500" },
  orientation: { tile: "border-lime-500 bg-lime-100 text-lime-950 hover:bg-lime-200", dot: "bg-lime-500" },
  showcase: { tile: "border-orange-500 bg-orange-100 text-orange-950 hover:bg-orange-200", dot: "bg-orange-500" },
  partner: { tile: "border-green-600 bg-green-100 text-green-950 hover:bg-green-200", dot: "bg-green-600" },
  networking: { tile: "border-yellow-500 bg-yellow-100 text-yellow-950 hover:bg-yellow-200", dot: "bg-yellow-500" },
  social: { tile: "border-pink-500 bg-pink-100 text-pink-950 hover:bg-pink-200", dot: "bg-pink-500" },
  deadline: { tile: "border-red-500 bg-red-100 text-red-950 hover:bg-red-200", dot: "bg-red-500" },
  other: { tile: "border-stone-500 bg-stone-200 text-stone-900 hover:bg-stone-300", dot: "bg-stone-500" },
};

/** Deadlines go on the calendar, but nobody attends or checks in to them. */
export function takesAttendance(event: Pick<ProgramEvent, "category">): boolean {
  return event.category !== "deadline";
}

/** Lowercase plural for sentences, e.g. "workshops", "office hours". */
export function categoryPlural(category: EventCategory): string {
  const words = category.replace("-", " ");
  return words.endsWith("s") ? words : `${words}s`;
}

/** "14:30" -> "2:30 PM". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "All day", "2:00 PM" or "2:00 PM – 3:30 PM". */
export function formatEventTime(event: Pick<ProgramEvent, "startTime" | "endTime">): string {
  if (!event.startTime) return "All day";
  return event.endTime
    ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
    : formatTime(event.startTime);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const MAX_REPEATS = 52;

/** Start dates from `start` to `until` (inclusive), every `everyDays` days. */
export function repeatDates(start: string, until: string, everyDays: number): string[] {
  const dates: string[] = [];
  for (let d = start; d <= until && dates.length < MAX_REPEATS; d = addDays(d, everyDays)) {
    dates.push(d);
  }
  return dates;
}
