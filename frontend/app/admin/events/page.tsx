"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyLinkButton } from "@/components/copy-link-button";
import { EventCalendar } from "@/components/event-calendar";
import {
  EventFields,
  eventFormValues,
  eventFromForm,
  validateEventForm,
} from "@/components/event-form";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { useCohort } from "@/lib/store";
import {
  EVENT_CATEGORY_LABELS,
  MAX_REPEATS,
  addDays,
  formatEventTime,
  repeatDates,
} from "@/lib/events";
import { cohortWeek, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEW_KEY = "program-ops-crm:events-view";
type View = "list" | "calendar";

export default function EventsPage() {
  const { data } = useCohort();
  const [view, setView] = useState<View>("list");

  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "calendar") setView("calendar");
    } catch {
      // Storage unavailable: start on the list.
    }
  }, []);

  function changeView(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts until the page reloads.
    }
  }

  return (
    <>
      <PageHeader
        title="Events"
        description="Each event has its own check-in link. Attendance feeds requirement status automatically."
        actions={
          <>
            <div role="radiogroup" aria-label="View" className="flex h-8 rounded-lg border p-0.5 text-sm">
              {(["list", "calendar"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => changeView(v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 text-muted-foreground capitalize",
                    view === v && "bg-muted font-medium text-foreground",
                  )}
                >
                  {v === "list" ? <List className="size-4" /> : <CalendarDays className="size-4" />}
                  {v}
                </button>
              ))}
            </div>
            <NewEventDialog />
          </>
        }
      />
      {view === "calendar" ? (
        <EventCalendar events={data.events} today={data.today} />
      ) : (
        <EventTable />
      )}
    </>
  );
}

function EventTable() {
  const router = useRouter();
  const { data } = useCohort();
  const activeIds = new Set(
    data.enrollments.filter((e) => e.status === "active").map((e) => e.id),
  );

  return (
    <>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead className="pr-4 text-right">Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.events.map((event) => {
              const past = event.date < data.today;
              const count = data.attendance.filter(
                (a) => a.eventId === event.id && activeIds.has(a.enrollmentId),
              ).length;
              return (
                <TableRow
                  key={event.id}
                  onClick={() => router.push(`/admin/events/${event.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell className="pl-4">
                    <div>
                      {formatDate(event.date, { weekday: true })}
                      {event.endDate && ` – ${formatDate(event.endDate, { weekday: true })}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatEventTime(event)} · Week {cohortWeek(data.cohort.startDate, event.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.isRequired ? "Required" : "Optional"}
                    </div>
                  </TableCell>
                  <TableCell>{EVENT_CATEGORY_LABELS[event.category]}</TableCell>
                  <TableCell className="tabular-nums">
                    {past ? (
                      `${count} / ${activeIds.size}`
                    ) : (
                      <span className="text-muted-foreground">Upcoming</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <CopyLinkButton path={`/checkin/${event.checkinToken}`} label="Copy link" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

const REPEAT_OPTIONS = [
  { value: 0, label: "Doesn't repeat" },
  { value: 1, label: "Every day" },
  { value: 7, label: "Every week" },
  { value: 14, label: "Every 2 weeks" },
];

function NewEventDialog() {
  const { data, addEvent } = useCohort();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => eventFormValues(data.today));
  const [repeatEvery, setRepeatEvery] = useState(0);
  const [until, setUntil] = useState(addDays(data.today, 28));
  const [error, setError] = useState<string>();

  const { date } = values;
  const starts = repeatEvery && until >= date ? repeatDates(date, until, repeatEvery) : [date];

  function reset() {
    setValues(eventFormValues(data.today));
    setRepeatEvery(0);
    setError(undefined);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem =
      validateEventForm(values) ??
      (repeatEvery && (!until || until <= date)
        ? "The repeat end date must be after the start date."
        : undefined);
    if (problem) {
      setError(problem);
      return;
    }
    for (const start of starts) addEvent(eventFromForm(values, start));
    setOpen(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus />
        New event
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>Each event gets its own check-in link.</DialogDescription>
          </DialogHeader>

          <EventFields values={values} onChange={setValues} />

          <div className="space-y-4 border-t pt-5">
            <div className="text-sm font-medium">Repeat</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="repeat">How often</Label>
                <NativeSelect
                  id="repeat"
                  value={repeatEvery}
                  onChange={(e) => setRepeatEvery(Number(e.target.value))}
                  className="h-9 w-full"
                >
                  {REPEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {repeatEvery > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="until">Until</Label>
                  <Input
                    id="until"
                    type="date"
                    min={date}
                    value={until}
                    onChange={(e) => setUntil(e.target.value)}
                  />
                </div>
              )}
            </div>
            {repeatEvery > 0 && starts.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Creates {starts.length} events:{" "}
                {starts.slice(0, 6).map((d) => formatDate(d)).join(", ")}
                {starts.length > 6 && ", …"}
                {starts.length === MAX_REPEATS && ` (at most ${MAX_REPEATS} at once)`}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {starts.length > 1 ? `Create ${starts.length} events` : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
