"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { describeChange, type StatusChange } from "@/lib/requirement-insights";
import type { CohortData } from "@/lib/types";
import { SQUARE } from "./status-styles";

export function StatusChanges({
  data,
  changes,
}: {
  data: CohortData;
  changes: StatusChange[];
}) {
  return (
    <Card className="gap-1 rounded-2xl px-5">
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <h2 className="font-semibold">Recent status changes</h2>
        <span className="text-xs text-muted-foreground">from all rules</span>
      </div>
      {changes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No changes yet this term.
        </p>
      ) : (
        <ul>
          {changes.map((c, i) => {
            const { who, what } = describeChange(data, c);
            return (
              <li
                key={i}
                className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-t py-2 text-[13px] first:border-t-0"
              >
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(c.date)}
                </span>
                <span className="flex items-start gap-2">
                  <i
                    className={cn(
                      "mt-1.5 block size-2 shrink-0 rounded-full",
                      SQUARE[c.to],
                    )}
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold">{who}</span> {what}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Worked out from attendance and hand-in dates, judged by the rules as
        they are today.
      </p>
    </Card>
  );
}
