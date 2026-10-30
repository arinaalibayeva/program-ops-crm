"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { RecordDialog } from "@/components/records/record-dialog";
import { LinkedRecords, TrackedNumbers } from "@/components/records/related";
import { formatDateTime } from "@/lib/format";
import {
  formatRecordValue,
  linkedIds,
  linkLabel,
  recordTitle,
  targetHref,
  typeById,
} from "@/lib/records";
import { useCohort } from "@/lib/store";

export default function RecordPage({
  params,
}: {
  params: Promise<{ typeId: string; recordId: string }>;
}) {
  const { typeId, recordId } = use(params);
  const router = useRouter();
  const { data, deleteRecord } = useCohort();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const type = typeById(data, typeId);
  const record = data.records.find(
    (r) => r.id === recordId && r.typeId === typeId,
  );

  if (!type || !record)
    return (
      <p className="text-muted-foreground">This record doesn&apos;t exist.</p>
    );

  return (
    <>
      <Link
        href={`/admin/records/${type.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {type.name}
      </Link>
      <PageHeader
        title={recordTitle(data, record)}
        description={`${type.singular} · added ${formatDateTime(record.createdAt)}${
          record.updatedAt
            ? ` · edited ${formatDateTime(record.updatedAt)}`
            : ""
        }`}
        actions={
          confirming ? (
            <>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteRecord(record.id);
                  router.push(`/admin/records/${type.id}`);
                }}
              >
                Delete {type.singular.toLowerCase()}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <Trash2 /> Delete
              </Button>
              <Button onClick={() => setEditing(true)}>
                <Pencil /> Edit
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {type.fields.map((f) => {
                  const value = record.values[f.id];
                  const wide =
                    f.type === "long_text" || (f.type === "link" && f.multiple);
                  return (
                    <div
                      key={f.id}
                      className={wide ? "sm:col-span-2" : undefined}
                    >
                      <dt className="text-xs text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 text-sm">
                        {f.type === "link" && linkedIds(value).length > 0 ? (
                          <span className="flex flex-wrap gap-1.5">
                            {linkedIds(value).map((id) => (
                              <Link
                                key={id}
                                href={targetHref(f.linkTo!, id)}
                                className="rounded-full bg-secondary px-2.5 py-0.5 text-xs hover:underline"
                              >
                                {linkLabel(data, f.linkTo!, id)}
                              </Link>
                            ))}
                          </span>
                        ) : f.type === "url" &&
                          typeof value === "string" &&
                          value ? (
                          <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all underline"
                          >
                            {value}
                          </a>
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {formatRecordValue(data, f, value)}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
          <LinkedRecords target={type.id} id={record.id} />
        </div>
        <div className="space-y-6">
          <TrackedNumbers on={type.id} id={record.id} />
        </div>
      </div>

      <RecordDialog
        type={type}
        record={record}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}
