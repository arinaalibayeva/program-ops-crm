"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculate,
  evaluateRules,
  formatCalculation,
  formatRecordValue,
  incomingLinks,
  linkedIds,
  recordTitle,
} from "@/lib/records";
import { useCohort } from "@/lib/store";
import type { CustomRecord, RecordField, RecordType } from "@/lib/types";
import { RecordDialog } from "./record-dialog";

const SHOWN = 5;

/** A short line under a record's title: its first date and first choice, if any. */
export function recordMeta(type: RecordType, record: CustomRecord, format: (f: RecordField) => string): string {
  const parts = [type.fields.find((f) => f.type === "date"), type.fields.find((f) => f.type === "select")]
    .filter((f): f is RecordField => !!f && record.values[f.id] !== undefined)
    .map(format);
  return parts.join(" · ");
}

/** Newest first, by the first date field, falling back to when it was added. */
export function sortRecords(type: RecordType, records: CustomRecord[]): CustomRecord[] {
  const date = type.fields.find((f) => f.type === "date");
  const key = (r: CustomRecord) => String((date && r.values[date.id]) || r.createdAt);
  return [...records].sort((a, b) => key(b).localeCompare(key(a)));
}

/**
 * One card per record type that links to this thing (a team, participant,
 * event or record), listing the linked records with a way to add one.
 */
export function LinkedRecords({ target, id }: { target: string; id: string }) {
  const { data } = useCohort();
  const links = incomingLinks(data, target);
  return (
    <>
      {links.map(({ type, field }) => (
        <LinkedSection
          key={field.id}
          type={type}
          field={field}
          id={id}
          // Say which link when a type links here more than once.
          title={links.filter((l) => l.type.id === type.id).length > 1 ? `${type.name} · ${field.label}` : type.name}
        />
      ))}
    </>
  );
}

function LinkedSection({ type, field, id, title }: { type: RecordType; field: RecordField; id: string; title: string }) {
  const { data } = useCohort();
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const records = sortRecords(
    type,
    data.records.filter((r) => r.typeId === type.id && linkedIds(r.values[field.id]).includes(id)),
  );
  const shown = showAll ? records : records.slice(0, SHOWN);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {title} <span className="font-normal text-muted-foreground">{records.length}</span>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Add
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {records.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y">
            {shown.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/records/${type.id}/${r.id}`} className="block px-4 py-2 hover:bg-muted/50">
                  <div className="text-sm font-medium">{recordTitle(data, r)}</div>
                  <div className="text-xs text-muted-foreground">
                    {recordMeta(type, r, (f) => formatRecordValue(data, f, r.values[f.id]))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {records.length > SHOWN && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="px-4 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show fewer" : `Show all ${records.length}`}
          </button>
        )}
      </CardContent>
      <RecordDialog
        type={type}
        open={adding}
        onOpenChange={setAdding}
        preset={{ [field.id]: field.multiple ? [id] : id }}
      />
    </Card>
  );
}

/** Calculations shown on this thing, with the rules they've tripped. */
export function TrackedNumbers({ on, id }: { on: string; id: string }) {
  const { data } = useCohort();
  const calcs = data.calculations.filter((c) => c.on === on);
  if (calcs.length === 0) return null;
  const flagged = new Map(
    evaluateRules(data, on, id).map((r) => [data.rules.find((x) => x.id === r.ruleId)?.calculationId, r]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracked</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5">
          {calcs.map((c) => {
            const flag = flagged.get(c.id);
            return (
              <div key={c.id} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  {/* The reason is in Requirements; here a dot just marks the number behind it. */}
                  <dd className="shrink-0 font-medium" title={flag?.reason}>
                    {flag && (
                      <span className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${flag.status === "missing" ? "bg-ocean-900" : "bg-ocean-500"}`} />
                    )}
                    {formatCalculation(c, calculate(data, c, id))}
                  </dd>
                </div>

              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
