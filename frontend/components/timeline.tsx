"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { TimelineEntry } from "@/lib/timeline";

const SHOWN = 8;

/** Date-times are stored in UTC; show the day it was where the reader is. */
function dayOf(date: string): string {
  if (date.length === 10) return formatDate(date);
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Everything that's happened with a record, newest first. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, SHOWN);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ol className="space-y-3 border-l pl-3">
            {shown.map((entry) => (
              <li key={entry.id} className="text-sm">
                <div className="text-xs text-muted-foreground">{dayOf(entry.date)}</div>
                {entry.href ? (
                  <Link href={entry.href} className="font-medium hover:underline">
                    {entry.title}
                  </Link>
                ) : (
                  <div className="font-medium">{entry.title}</div>
                )}
                {entry.detail && (
                  <div className="line-clamp-2 text-xs text-muted-foreground">{entry.detail}</div>
                )}
              </li>
            ))}
          </ol>
        )}
        {entries.length > SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="pt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show fewer" : `Show all ${entries.length}`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
