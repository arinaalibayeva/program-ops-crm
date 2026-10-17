export function formatDate(iso: string, opts?: { weekday?: boolean }): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(opts?.weekday ? { weekday: "short" } : {}),
  });
}

/** A moment like "Oct 19, 2026, 3:42 PM", in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** 1-based week number of `date` within a cohort starting on `start`. */
export function cohortWeek(start: string, date: string): number {
  const days =
    (new Date(date).getTime() - new Date(start).getTime()) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
