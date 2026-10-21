"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Mail, Maximize2, X } from "lucide-react";
import { Notes } from "@/components/notes";
import {
  AttendanceSection,
  ProfileSection,
  RecordsSection,
  RequirementsSection,
  TeamSection,
  fullStatus,
} from "@/components/participant-sections";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { useCohort, usePeopleIndex } from "@/lib/store";
import { participantTimeline } from "@/lib/timeline";

const iconButton =
  "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground";

/**
 * A participant's profile beside the list, so you can look at people one after
 * another without leaving it. The list stays usable behind it.
 */
export function ParticipantPanel({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const { data } = useCohort();
  const { enrollmentById, personFor } = usePeopleIndex();
  const panel = useRef<HTMLElement>(null);
  const enrollment = enrollmentById.get(enrollmentId);
  const person = personFor(enrollmentId);

  // Keyboard users land in the panel, and Escape works from here.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, [enrollmentId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape in a box or dialog belongs to that, and shouldn't lose what's typed.
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || document.querySelector('[role="dialog"]')) return;
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!enrollment || !person) return null;

  const status = enrollment.status === "active" ? fullStatus(data, enrollmentId) : undefined;
  const section = { view: data, enrollment, update: () => {} };

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label={`${person.name}'s profile`}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-xl outline-none duration-200 animate-in slide-in-from-right motion-reduce:animate-none sm:w-[min(40rem,calc(100vw-4rem))]"
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-3 text-lg font-semibold">
            {person.name}
            {status && <StatusBadge status={status.status} overall />}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" /> <span className="truncate">{person.email}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Link
            href={`/admin/participants/${enrollmentId}`}
            aria-label="Expand to full page"
            title="Expand to full page"
            className={iconButton}
          >
            <Maximize2 className="size-4" />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className={iconButton}>
            <X className="size-4" />
          </button>
        </div>
      </header>
      {/* Keyed so moving to another person starts at the top with empty note boxes. */}
      <div key={enrollmentId} className="flex-1 space-y-4 overflow-y-auto p-4">
        <ProfileSection {...section} />
        <RequirementsSection {...section} />
        <TeamSection {...section} />
        <Notes subjectType="participant" subjectId={enrollmentId} />
        <AttendanceSection {...section} />
        <RecordsSection enrollmentId={enrollmentId} />
        <Timeline entries={participantTimeline(data, enrollmentId)} />
      </div>
    </aside>
  );
}
