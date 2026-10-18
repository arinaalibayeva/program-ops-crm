"use client";

import { X } from "lucide-react";
import { useCohort } from "@/lib/store";

/** Says when the server refused a change; the screen has already been reloaded to match it. */
export function SyncError() {
  const { syncError, clearSyncError } = useCohort();
  if (!syncError) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-start gap-3 rounded-lg border border-destructive/30 bg-background px-4 py-3 text-sm shadow-lg"
    >
      <span>
        <span className="font-medium text-destructive">Not saved.</span> {syncError}
      </span>
      <button type="button" onClick={clearSyncError} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}
