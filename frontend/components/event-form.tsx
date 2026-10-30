"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { EVENT_CATEGORY_LABELS, addDays } from "@/lib/events";
import { partnersOf } from "@/lib/partners";
import { useCohort, type NewEvent } from "@/lib/store";
import { EVENT_CATEGORIES, type EventCategory, type ProgramEvent } from "@/lib/types";

/** Form state for creating or editing one event; repeats are handled by the caller. */
export interface EventFormValues {
  title: string;
  category: EventCategory;
  isRequired: boolean;
  date: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  multiDay: boolean;
  endDate: string;
  location: string;
  host: string;
  partnerId: string;
  description: string;
}

export function eventFormValues(today: string, event?: ProgramEvent): EventFormValues {
  return {
    title: event?.title ?? "",
    category: event?.category ?? "workshop",
    isRequired: event?.isRequired ?? true,
    date: event?.date ?? today,
    allDay: event ? !event.startTime : false,
    startTime: event?.startTime ?? "10:00",
    endTime: event ? (event.endTime ?? "") : "11:00",
    multiDay: !!event?.endDate,
    endDate: event?.endDate ?? addDays(event?.date ?? today, 1),
    location: event?.location ?? "",
    host: event?.host ?? "",
    partnerId: event?.partnerId ?? "",
    description: event?.description ?? "",
  };
}

export function validateEventForm(v: EventFormValues): string | undefined {
  if (!v.title.trim()) return "Enter a title.";
  if (!v.date) return "Pick a date.";
  if (v.multiDay && (!v.endDate || v.endDate <= v.date)) {
    return "The end date must be after the start date.";
  }
  if (!v.allDay && !v.startTime) return "Pick a start time, or mark the event as all day.";
  if (!v.allDay && !v.multiDay && v.endTime && v.endTime <= v.startTime) {
    return "The end time must be after the start time.";
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** The event to save, optionally moved to another start date (for repeats). */
export function eventFromForm(v: EventFormValues, start = v.date): NewEvent {
  const span = v.multiDay ? daysBetween(v.date, v.endDate) : 0;
  const text = (s: string) => s.trim() || undefined;
  return {
    title: v.title.trim(),
    category: v.category,
    isRequired: v.isRequired,
    date: start,
    endDate: span ? addDays(start, span) : undefined,
    startTime: v.allDay ? undefined : v.startTime,
    endTime: v.allDay || !v.endTime ? undefined : v.endTime,
    location: text(v.location),
    host: text(v.host),
    partnerId: v.partnerId || undefined,
    description: text(v.description),
  };
}

export function EventFields({
  values: v,
  onChange,
}: {
  values: EventFormValues;
  onChange: (values: EventFormValues) => void;
}) {
  const { data } = useCohort();
  const set = (patch: Partial<EventFormValues>) => onChange({ ...v, ...patch });

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={v.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Kickoff, Design workshop, Weekly check-in"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <NativeSelect
              id="category"
              value={v.category}
              onChange={(e) => set({ category: e.target.value as EventCategory })}
              className="h-9 w-full"
            >
              {/* Deadlines come from requirements, not events. */}
              {EVENT_CATEGORIES.filter((c) => c !== "deadline" || v.category === "deadline").map((c) => (
                <option key={c} value={c}>
                  {EVENT_CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>

      <div className="space-y-4 border-t pt-5">
        <div className="text-sm font-medium">When</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">{v.multiDay ? "Starts" : "Date"}</Label>
            <Input id="date" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          {v.multiDay && (
            <div className="space-y-1.5">
              <Label htmlFor="end-date">Ends</Label>
              <Input
                id="end-date"
                type="date"
                min={v.date}
                value={v.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
              />
            </div>
          )}
          {!v.allDay && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Start time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={v.startTime}
                  onChange={(e) => set({ startTime: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">
                  End time
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={v.endTime}
                  onChange={(e) => set({ endTime: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.allDay}
              onChange={(e) => set({ allDay: e.target.checked })}
            />
            All day
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={v.multiDay}
              onChange={(e) =>
                set({
                  multiDay: e.target.checked,
                  endDate: v.endDate > v.date ? v.endDate : addDays(v.date, 1),
                })
              }
            />
            Lasts more than one day
          </label>
        </div>
      </div>

      <div className="space-y-4 border-t pt-5">
        <div className="text-sm font-medium">Details</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={v.location}
              onChange={(e) => set({ location: e.target.value })}
              placeholder="Room, address or meeting link"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host">Host</Label>
            <Input
              id="host"
              value={v.host}
              onChange={(e) => set({ host: e.target.value })}
              placeholder="Facilitator, speaker or partner"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-partner">
            Partner
          </Label>
          <NativeSelect
            id="event-partner"
            value={v.partnerId}
            onChange={(e) => set({ partnerId: e.target.value })}
            className="h-9 w-full"
          >
            <option value="">{v.category === "partner" ? "All partners" : "None"}</option>
            {partnersOf(data).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            value={v.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What happens at this event and what participants should bring or prepare"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>
    </>
  );
}
