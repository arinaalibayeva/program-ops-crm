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
