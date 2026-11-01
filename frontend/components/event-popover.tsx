"use client";

import { inProgramOn } from "@/lib/requirements";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import {
  CalendarDays,
  Clock,
  MapPin,
  UserRound,
  X,
  Handshake,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_LABELS,
  formatEventTime,
  takesAttendance,
} from "@/lib/events";
import { eventHref } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { useCohort, usePeopleIndex } from "@/lib/store";
import type { ProgramEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

function Fact({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** A quick look at an event, beside whatever was clicked. */
export function EventPopover({
  event,
  anchor,
  onClose,
}: {
  event: ProgramEvent | undefined;
  anchor: HTMLElement | undefined;
  onClose: () => void;
}) {
  return (
    <Popover.Root open={!!event} onOpenChange={(open) => !open && onClose()}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50"
        >
          <Popover.Popup className="w-80 max-w-[calc(100vw-2rem)] rounded-2xl border bg-popover p-4 text-sm text-popover-foreground shadow-xl outline-none">
            {event && <Details event={event} onClose={onClose} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Details({
  event,
  onClose,
}: {
  event: ProgramEvent;
  onClose: () => void;
}) {
  const { data } = useCohort();
  const { partnerById } = usePeopleIndex();
  const partner = event.partnerId
    ? partnerById.get(event.partnerId)
    : undefined;
  const isLink = /^https?:\/\//i.test(event.location ?? "");
  const past =
    !event.derived && takesAttendance(event) && event.date < data.today;
  const active = inProgramOn(data, event.date);
  const present = data.attendance.filter(
    (a) => a.eventId === event.id && active.has(a.enrollmentId),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                EVENT_CATEGORY_COLORS[event.category].dot,
              )}
              aria-hidden
            />
            {event.derived === "requirement"
              ? "Deadline"
              : event.derived === "records"
                ? "Logged"
                : EVENT_CATEGORY_LABELS[event.category]}
          </div>
          <Popover.Title className="mt-1 text-base leading-snug font-semibold">
            {event.title}
          </Popover.Title>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-mt-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Fact icon={CalendarDays}>
          {formatDate(event.date, { weekday: true })}
          {event.endDate &&
            ` – ${formatDate(event.endDate, { weekday: true })}`}
        </Fact>
        {!event.derived && <Fact icon={Clock}>{formatEventTime(event)}</Fact>}
        {event.location && (
          <Fact icon={MapPin}>
            {isLink ? (
              <a
                href={event.location}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Meeting link
              </a>
            ) : (
              event.location
            )}
          </Fact>
        )}
        {event.host && <Fact icon={UserRound}>{event.host}</Fact>}
        {partner && (
          <Fact icon={Handshake}>
            <Link
              href={`/admin/partners/${partner.id}`}
              className="underline underline-offset-2"
            >
              {partner.name}
            </Link>
          </Fact>
        )}
      </div>

      {event.description && (
        <p className="line-clamp-3 text-xs text-muted-foreground">
          {event.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {past && `${present} of ${active.size} attended`}
        </span>
        <Link
          href={eventHref(event)}
          className={buttonVariants({ size: "sm" })}
        >
          {event.derived === "requirement"
            ? "See who's in"
            : event.derived === "records"
              ? "See records"
              : "Open event"}
        </Link>
      </div>
    </div>
  );
}
