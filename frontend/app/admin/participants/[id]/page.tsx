"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notes } from "@/components/notes";
import {
  AttendanceSection,
  ProfileSection,
  RecordsSection,
  RequirementsSection,
  TeamSection,
  fullStatus,
} from "@/components/participant-sections";
import { PageHeader } from "@/components/page-header";
import { SectionBoard, type BoardLayout } from "@/components/section-board";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { useCohort } from "@/lib/store";
import { activeFields } from "@/lib/fields";
import {
  applyDraft,
  draftFrom,
  validateDraft,
  type ParticipantDraft,
} from "@/lib/participant-draft";
import { participantTimeline } from "@/lib/timeline";

type SectionId =
  | "requirements"
  | "attendance"
  | "records"
  | "profile"
  | "team"
  | "notes"
  | "timeline";

const SECTION_LABELS: Record<SectionId, string> = {
  requirements: "Requirements",
  attendance: "Attendance",
  records: "Records",
  profile: "Profile",
  team: "Team",
  notes: "Notes",
  timeline: "Timeline",
};

const DEFAULT_LAYOUT: BoardLayout<SectionId> = {
  left: ["requirements", "attendance", "records"],
  right: ["profile", "team", "notes", "timeline"],
};

// The arrangement is a per-admin preference shared by every participant page,
// so it lives in this browser rather than in the cohort data.
const LAYOUT_KEY = "program-ops-crm:participant-layout:v1";

function loadLayout(): BoardLayout<SectionId> {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null");
    const ids = [...(saved?.left ?? []), ...(saved?.right ?? [])].sort().join();
    // Fall back if sections were added or removed since it was saved.
    if (ids === Object.keys(SECTION_LABELS).sort().join()) return saved;
  } catch {
    // Unreadable storage: use the default.
  }
  return DEFAULT_LAYOUT;
}

export default function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, updateParticipant } = useCohort();
  const [draft, setDraft] = useState<ParticipantDraft>();
  const [error, setError] = useState("");
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layoutDraft, setLayoutDraft] = useState<BoardLayout<SectionId>>();

  // Read after mount to avoid a server/client mismatch.
  useEffect(() => setLayout(loadLayout()), []);

  // While editing, every section shows the draft applied to the data, so
  // statuses update live before anything is saved.
  const view = useMemo(
    () => (draft ? applyDraft(data, id, draft) : data),
    [data, id, draft],
  );

  const enrollment = view.enrollments.find((e) => e.id === id);
  const person =
    enrollment && view.people.find((p) => p.id === enrollment.personId);
  if (!enrollment || !person) {
    return <p className="text-muted-foreground">Participant not found.</p>;
  }

  const status =
    enrollment.status === "active" ? fullStatus(view, id) : undefined;
  const update = (patch: Partial<ParticipantDraft>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  function save() {
    if (!draft) return;
    const problem = validateDraft(data, id, draft, activeFields(data));
    if (problem) {
      setError(problem);
      return;
    }
    updateParticipant(id, draft);
    if (layoutDraft) {
      setLayout(layoutDraft);
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutDraft));
      } catch {
        // Storage unavailable: the layout lasts until the page reloads.
      }
    }
    cancel();
  }

  function startEditing() {
    setDraft(draftFrom(data, id));
    setLayoutDraft(layout);
  }

  function cancel() {
    setDraft(undefined);
    setLayoutDraft(undefined);
    setError("");
  }

  const section = { view, enrollment, draft, update };

  return (
    <>
      <Link
        href="/admin/participants"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Participants
      </Link>

      {draft && (
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-sm">
          <div className="text-sm">
            <span className="font-medium">Editing</span>{" "}
            <span className="text-muted-foreground">
              Drag sections by their handle to rearrange. Nothing is saved until
              you click Save.
            </span>
            {error && <div className="text-destructive">{error}</div>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setLayoutDraft(DEFAULT_LAYOUT)}
            >
              Reset layout
            </Button>
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        </div>
      )}

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {person.name || "Unnamed"}
            {enrollment.status === "withdrawn" ? (
              <span className="text-sm font-normal text-muted-foreground">
                Withdrawn
              </span>
            ) : (
              status && (
                <StatusBadge
                  status={status.status}
                  overall
                  className="text-sm"
                />
              )
            )}
          </span>
        }
        description={
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-3.5" /> {person.email}
          </span>
        }
        actions={
          !draft && (
            <Button variant="outline" onClick={startEditing}>
              <Pencil /> Edit participant
            </Button>
          )
        }
      />

      <SectionBoard
        layout={layoutDraft ?? layout}
        onChange={draft ? setLayoutDraft : undefined}
        labels={SECTION_LABELS}
        render={(sectionId) => {
          switch (sectionId) {
            case "requirements":
              return <RequirementsSection {...section} />;
            case "attendance":
              return <AttendanceSection {...section} />;
            case "profile":
              return <ProfileSection {...section} />;
            case "team":
              return <TeamSection {...section} />;
            case "notes":
              return (
                <Notes subjectType="participant" subjectId={enrollment.id} />
              );
            case "timeline":
              return (
                <Timeline entries={participantTimeline(view, enrollment.id)} />
              );
            case "records":
              return <RecordsSection enrollmentId={enrollment.id} />;
          }
        }}
      />
    </>
  );
}
