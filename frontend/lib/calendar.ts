// Everything that belongs on the calendar: saved events, plus items worked out
// from the rest of the program. A requirement's due date is its deadline, and
// records with a date (partner meetings, reports) show on the day they happened.

import { useMemo } from "react";
import { dueDateOf } from "./requirement-insights";
import { useCohort } from "./store";
import type { CohortData, ProgramEvent, SubjectStatus } from "./types";

export function eventHref(event: ProgramEvent): string {
  return event.href ?? `/admin/events/${event.id}`;
}

function deadlineItems(
  data: CohortData,
  statuses: {
    participantStatuses: Map<string, SubjectStatus>;
    teamStatuses: Map<string, SubjectStatus>;
  },
): ProgramEvent[] {
  return data.requirements.flatMap((req) => {
    const due = dueDateOf(req);
    if (!due) return [];
    const source =
      req.scope === "participant"
        ? statuses.participantStatuses
        : statuses.teamStatuses;
    const results = [...source.values()].flatMap((s) =>
      s.results.filter((r) => r.requirementId === req.id),
    );
    const done = results.filter((r) => r.status === "met").length;
    const description =
      "description" in req.params ? req.params.description : undefined;
    return [
      {
        id: `due-${req.id}`,
        cohortId: data.cohort.id,
        title: req.name,
        category: "deadline" as const,
        date: due,
        description: [
          `${done} of ${results.length} ${req.scope === "team" ? "teams" : "people"} in.`,
          description,
        ]
          .filter(Boolean)
          .join(" "),
        isRequired: true,
        checkinToken: "",
        completed: results.length > 0 && done === results.length,
        href: `/admin/requirements?rule=${req.id}`,
        derived: "requirement" as const,
      },
    ];
  });
}

/** One item per day per record type, e.g. "4 partner meetings logged". */
function recordItems(data: CohortData): ProgramEvent[] {
  const items: ProgramEvent[] = [];
  for (const type of data.recordTypes) {
    const dateField = type.fields.find((f) => f.type === "date");
    if (!dateField) continue;
    const byDay = new Map<string, number>();
    for (const r of data.records) {
      const date = r.typeId === type.id ? r.values[dateField.id] : undefined;
      if (typeof date === "string" && date)
        byDay.set(date, (byDay.get(date) ?? 0) + 1);
    }
    for (const [date, n] of byDay) {
      const what = (n === 1 ? type.singular : type.name).toLowerCase();
      items.push({
        id: `log-${type.id}-${date}`,
        cohortId: data.cohort.id,
        title: `${n} ${what}`,
        category: "other",
        date,
        description: `${n} ${what} logged with this date.`,
        isRequired: false,
        checkinToken: "",
        href: `/admin/records/${type.id}`,
        derived: "records",
      });
    }
  }
  return items;
}

export function calendarEvents(
  data: CohortData,
  statuses: {
    participantStatuses: Map<string, SubjectStatus>;
    teamStatuses: Map<string, SubjectStatus>;
  },
): ProgramEvent[] {
  return [
    ...data.events,
    ...deadlineItems(data, statuses),
    ...recordItems(data),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? ""),
  );
}

export function useCalendarEvents(): ProgramEvent[] {
  const { data, participantStatuses, teamStatuses } = useCohort();
  return useMemo(
    () => calendarEvents(data, { participantStatuses, teamStatuses }),
    [data, participantStatuses, teamStatuses],
  );
}
