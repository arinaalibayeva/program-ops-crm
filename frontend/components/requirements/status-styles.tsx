import type { Bucket } from "@/lib/requirement-insights";

// One blue scale everywhere, like the pie charts: the darker, the more serious.
// Deep navy = can no longer meet it, mid blue = at risk, pale blue = fine.
// Words always sit beside the colour, so nobody has to rely on shade alone.

export const SQUARE: Record<Bucket, string> = {
  missing: "bg-ocean-900",
  at_risk: "bg-ocean-500",
  ok: "bg-ocean-200",
};

// Statuses are words, not badges: weight carries how serious it is.
export const PILL: Record<Bucket, string> = {
  missing: "font-semibold",
  at_risk: "font-medium",
  ok: "",
};

export const CHIP: Record<Bucket, string> = {
  missing: "font-semibold",
  at_risk: "",
  ok: "",
};

export const TEXT: Record<Bucket, string> = {
  missing: "text-ocean-900",
  at_risk: "text-ocean-600",
  ok: "text-ocean-700",
};

export const LABEL: Record<Bucket, string> = {
  missing: "Can't meet",
  at_risk: "At risk",
  ok: "On track",
};

export function Pill({
  bucket,
  children,
}: {
  bucket: Bucket;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`text-xs whitespace-nowrap text-foreground tabular-nums ${PILL[bucket]}`}
    >
      {children}
    </span>
  );
}
