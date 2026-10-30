"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { CalculationsEditor } from "@/components/customize/calculations-editor";
import { FieldsEditor } from "@/components/customize/fields-editor";
import { FormsEditor } from "@/components/customize/forms-editor";
import { typeById } from "@/lib/records";
import { useCohort } from "@/lib/store";

export default function CustomizeTypePage({
  params,
}: {
  params: Promise<{ typeId: string }>;
}) {
  const { typeId } = use(params);
  const router = useRouter();
  const { data, updateRecordType, deleteRecordType } = useCohort();
  const type = typeById(data, typeId);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [singular, setSingular] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!type)
    return (
      <p className="text-muted-foreground">
        This record type doesn&apos;t exist.
      </p>
    );

  const count = data.records.filter((r) => r.typeId === type.id).length;
  const linkedFrom = data.recordTypes.filter(
    (t) =>
      t.id !== type.id &&
      t.fields.some((f) => f.type === "link" && f.linkTo === type.id),
  );

  return (
    <>
      <Link
        href="/admin/customize"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Customize
      </Link>

      {renaming ? (
        <form
          className="flex flex-wrap items-end gap-2 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !singular.trim()) return;
            updateRecordType(type.id, {
              name: name.trim(),
              singular: singular.trim(),
            });
            setRenaming(false);
          }}
        >
          <Input
            aria-label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56"
          />
          <Input
            aria-label="One record is called"
            value={singular}
            onChange={(e) => setSingular(e.target.value)}
            className="w-48"
          />
          <Button type="submit">Save</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRenaming(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <PageHeader
          title={type.name}
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setName(type.name);
                  setSingular(type.singular);
                  setRenaming(true);
                }}
              >
                <Pencil /> Rename
              </Button>
              <Link
                href={`/admin/records/${type.id}`}
                className={buttonVariants()}
              >
                View records <ArrowRight />
              </Link>
            </>
          }
        />
      )}

      <div className="max-w-3xl space-y-10">
        <FieldsEditor type={type} />
        <CalculationsEditor type={type} />
        <FormsEditor type={type} />

        <section className="space-y-2 border-t pt-6">
          <h2 className="text-base font-semibold">Delete this type</h2>
          {linkedFrom.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {linkedFrom.map((t) => t.name).join(", ")} link
              {linkedFrom.length === 1 ? "s" : ""} to {type.name}. Remove those
              link fields first.
            </p>
          ) : confirming ? (
            <div className="space-y-2">
              <p className="text-sm">
                This deletes {count} record{count === 1 ? "" : "s"}, and every
                calculation, rule and form for {type.name}. It can&apos;t be
                undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteRecordType(type.id);
                    router.push("/admin/customize");
                  }}
                >
                  Delete {type.name}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <Trash2 /> Delete {type.name}
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
