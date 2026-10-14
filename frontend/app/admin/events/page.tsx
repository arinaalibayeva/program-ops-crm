"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { useCohort } from "@/lib/store";
import { cohortWeek, formatDate } from "@/lib/format";
import { EVENT_CATEGORIES as CATEGORIES, type EventCategory } from "@/lib/types";

export default function EventsPage() {
  const router = useRouter();
  const { data } = useCohort();
  const activeIds = new Set(
    data.enrollments.filter((e) => e.status === "active").map((e) => e.id),
  );

  return (
    <>
      <PageHeader
        title="Events"
        description="Each event has its own check-in link. Attendance feeds requirement status automatically."
        actions={<NewEventDialog />}
      />
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
                    <div>{formatDate(event.date, { weekday: true })}</div>
                    <div className="text-xs text-muted-foreground">
                      Week {cohortWeek(data.cohort.startDate, event.date)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.isRequired ? "Required" : "Optional"}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{event.category}</TableCell>
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

function NewEventDialog() {
  const { data, addEvent } = useCohort();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("workshop");
  const [date, setDate] = useState(data.today);
  const [isRequired, setIsRequired] = useState(true);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    addEvent({ title: title.trim(), category, date, isRequired });
    setOpen(false);
    setTitle("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New event
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <NativeSelect
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required event
          </label>
          <DialogFooter>
            <Button type="submit">Create event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
