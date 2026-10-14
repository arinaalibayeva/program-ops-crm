import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const STYLES: Record<Status, { label: string; className: string; dot: string }> = {
  met: {
    label: "Done",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  on_track: {
    label: "On track",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  at_risk: {
    label: "At risk",
    className: "bg-amber-50 text-amber-800 ring-amber-600/25",
    dot: "bg-amber-500",
  },
  missing: {
    label: "Missing",
    className: "bg-red-50 text-red-700 ring-red-600/20",
    dot: "bg-red-500",
  },
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
  const style = STYLES[overall && status === "met" ? "on_track" : status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
