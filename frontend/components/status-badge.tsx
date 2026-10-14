import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

// Color only means "look here": statuses that are fine stay muted, and
// problems get a small colored dot next to the word.
const DOT: Partial<Record<Status, string>> = {
  at_risk: "bg-amber-500 dark:bg-amber-400",
  missing: "bg-red-500 dark:bg-red-400",
};

const LABEL: Record<Status, string> = {
  met: "Done",
  on_track: "On track",
  at_risk: "At risk",
  missing: "Missing",
};

export function StatusBadge({
  status,
  overall,
  className,
}: {
  status: Status;
  /** Overall subject status shows "On track" instead of "Done" for met. */
  overall?: boolean;
  className?: string;
}) {
  const shown = overall && status === "met" ? "on_track" : status;
  const dot = DOT[shown];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        dot ? "font-medium text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {shown === "met" && <Check className="size-3.5" />}
      {LABEL[shown]}
    </span>
  );
}
