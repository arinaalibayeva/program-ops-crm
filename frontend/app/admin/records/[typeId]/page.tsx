"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RecordDialog } from "@/components/records/record-dialog";
import { sortRecords } from "@/components/records/related";
import { worstStatus } from "@/lib/requirements";
import { evaluateRules, formatRecordValue, recordTitle, typeById } from "@/lib/records";
import { useCohort } from "@/lib/store";

const MAX_COLUMNS = 5;

export default function RecordListPage({ params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = use(params);
  const router = useRouter();
  const { data } = useCohort();
  const type = typeById(data, typeId);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);

  const columns = useMemo(
    () => type?.fields.filter((f) => f.type !== "long_text").slice(0, MAX_COLUMNS) ?? [],
    [type],
  );
  const choiceFields = type?.fields.filter((f) => f.type === "select") ?? [];
  const hasRules = data.rules.some((r) => data.calculations.find((c) => c.id === r.calculationId)?.on === typeId);

  const rows = useMemo(() => {
    if (!type) return [];
    const q = query.trim().toLowerCase();
    return sortRecords(
      type,
      data.records.filter((r) => r.typeId === type.id),
    ).filter((r) => {
      for (const [fieldId, wanted] of Object.entries(filters)) {
        if (wanted && r.values[fieldId] !== wanted) return false;
      }
      if (!q) return true;
      return type.fields.some((f) => formatRecordValue(data, f, r.values[f.id]).toLowerCase().includes(q));
    });
  }, [data, type, query, filters]);

  if (!type) return <p className="text-muted-foreground">This record type doesn&apos;t exist.</p>;
  const total = data.records.filter((r) => r.typeId === type.id).length;

  return (
    <>
      <PageHeader
        title={type.name}
        description={`${total} ${total === 1 ? type.singular.toLowerCase() : type.name.toLowerCase()}`}
        actions={
          <>
            <Link href={`/admin/customize/${type.id}`} className={buttonVariants({ variant: "outline" })}>
              <Settings2 /> Customize
            </Link>
            <Button onClick={() => setAdding(true)}>
              <Plus /> New {type.singular.toLowerCase()}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${type.name.toLowerCase()}`}
            className="pl-8"
          />
        </div>
        {choiceFields.map((f) => (
          <NativeSelect
            key={f.id}
            aria-label={f.label}
            value={filters[f.id] ?? ""}
            onChange={(e) => setFilters({ ...filters, [f.id]: e.target.value })}
          >
            <option value="">All {f.label.toLowerCase()}</option>
            {f.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </NativeSelect>
        ))}
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((f, i) => (
                <TableHead key={f.id} className={i === 0 ? "pl-4" : undefined}>
                  {f.label}
                </TableHead>
              ))}
              {columns.length === 0 && <TableHead className="pl-4">Record</TableHead>}
              {hasRules && <TableHead className="pr-4">Status</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const flags = hasRules ? evaluateRules(data, type.id, r.id) : [];
              return (
                <TableRow
                  key={r.id}
                  onClick={() => router.push(`/admin/records/${type.id}/${r.id}`)}
                  className="cursor-pointer"
                >
                  {columns.map((f, i) => (
                    <TableCell key={f.id} className={i === 0 ? "pl-4 font-medium" : "max-w-56 truncate"}>
                      {formatRecordValue(data, f, r.values[f.id])}
                    </TableCell>
                  ))}
                  {columns.length === 0 && <TableCell className="pl-4">{recordTitle(data, r)}</TableCell>}
                  {hasRules && (
                    <TableCell className="pr-4">
                      <StatusBadge status={worstStatus(flags.map((x) => x.status))} overall />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={Math.max(columns.length, 1) + (hasRules ? 1 : 0)} className="py-8 text-center text-muted-foreground">
                  {total === 0 ? `No ${type.name.toLowerCase()} yet.` : "Nothing matches."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <RecordDialog
        type={type}
        open={adding}
        onOpenChange={setAdding}
        onSaved={(id) => router.push(`/admin/records/${type.id}/${id}`)}
      />
    </>
  );
}
