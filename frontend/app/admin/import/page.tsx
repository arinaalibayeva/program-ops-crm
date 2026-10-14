"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { parseCsv } from "@/lib/csv";
import { useCohort } from "@/lib/store";

type Field = "name" | "email" | "team";

const FIELDS: { key: Field; label: string; required: boolean; guesses: string[] }[] = [
  { key: "name", label: "Name", required: true, guesses: ["name", "full name", "student", "participant"] },
  { key: "email", label: "Email", required: true, guesses: ["email", "e-mail", "email address"] },
  { key: "team", label: "Team", required: false, guesses: ["team", "group", "team name"] },
];

const SAMPLE_CSV = `Full Name,Email Address,Team,Year
Leila Haddad,leila.haddad@example.edu,Harbor,M28
Tomás Rivera,tomas.rivera@example.edu,Kestrel,M27
Ines Fischer,,Kestrel,M28
Bruno Mensah,bruno.mensah@example.edu,Lantern,M27
Noah Bergström,noah.bergstrom@example.edu,Kestrel,M28
Noah Bergström,noah.bergstrom@example.edu,Kestrel,M28`;

interface RowCheck {
  values: Record<Field, string>;
  error?: string;
  warning?: string;
}

export default function ImportPage() {
  const { data, addParticipants } = useCohort();
  const [fileName, setFileName] = useState<string>();
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] }>();
  const [mapping, setMapping] = useState<Record<Field, number>>({ name: -1, email: -1, team: -1 });
  const [result, setResult] = useState<number>();

  function load(text: string, name: string) {
    const parsed = parseCsv(text);
    setCsv(parsed);
    setFileName(name);
    setResult(undefined);
    // Guess the mapping from header names so most files need no changes.
    const lower = parsed.headers.map((h) => h.toLowerCase());
    const guess = {} as Record<Field, number>;
    for (const f of FIELDS) guess[f.key] = lower.findIndex((h) => f.guesses.includes(h));
    setMapping(guess);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) load(await file.text(), file.name);
  }

  const checked: RowCheck[] = useMemo(() => {
    if (!csv) return [];
    const existingEmails = new Set(
      data.enrollments.map((e) => data.people.find((p) => p.id === e.personId)?.email.toLowerCase()),
    );
    const seen = new Set<string>();
    const teamNames = new Set(data.teams.map((t) => t.name.toLowerCase()));
    return csv.rows.map((row) => {
      const values = {
        name: (row[mapping.name] ?? "").trim(),
        email: (row[mapping.email] ?? "").trim(),
        team: (row[mapping.team] ?? "").trim(),
      };
      const email = values.email.toLowerCase();
      let error: string | undefined;
      if (!values.name) error = "Missing name";
      else if (!email) error = "Missing email";
      else if (!/^\S+@\S+\.\S+$/.test(email)) error = "Invalid email";
      else if (seen.has(email)) error = "Duplicate row in file";
      else if (existingEmails.has(email)) error = "Already in this cohort";
      seen.add(email);
      const warning =
        !error && values.team && !teamNames.has(values.team.toLowerCase())
          ? `New team "${values.team}" will be created`
          : undefined;
      return { values, error, warning };
    });
  }, [csv, mapping, data]);

  const valid = checked.filter((r) => !r.error);
  const mappingComplete = FIELDS.every((f) => !f.required || mapping[f.key] >= 0);

  function runImport() {
    setResult(addParticipants(valid.map((r) => r.values)));
    setCsv(undefined);
  }

  return (
    <>
      <PageHeader
        title="Import participants"
        description="Upload a CSV export of your roster or matching spreadsheet. Nothing is saved until you confirm."
      />

      {result !== undefined && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="size-4" />
          Imported {result} participant{result === 1 ? "" : "s"}.{" "}
          <Link href="/admin/participants" className="font-medium underline">
            View participants
          </Link>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>1. Choose a file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm hover:bg-muted/50">
            <FileSpreadsheet className="size-4" />
            {fileName ?? "Upload .csv"}
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
          <Button variant="ghost" onClick={() => load(SAMPLE_CSV, "sample.csv")}>
            Use a sample file
          </Button>
          <span className="text-xs text-muted-foreground">
            Excel files: use File → Save as → CSV for now.
          </span>
        </CardContent>
      </Card>

      {csv && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>2. Match your columns</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="space-y-1.5 text-sm">
                  <span className="font-medium">
                    {f.label}
                    {!f.required && <span className="text-muted-foreground"> (optional)</span>}
                  </span>
                  <NativeSelect
                    value={mapping[f.key]}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                    className="w-full"
                  >
                    <option value={-1}>— Not in file —</option>
                    {csv.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-3">
                Other columns ({csv.headers.filter((_, i) => !Object.values(mapping).includes(i)).join(", ") || "none"})
                will be kept as extra profile fields once the backend exists.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                3. Review{" "}
                <span className="font-normal text-muted-foreground">
                  {valid.length} ready · {checked.length - valid.length} with problems
                </span>
              </CardTitle>
              <Button onClick={runImport} disabled={!mappingComplete || valid.length === 0}>
                Import {valid.length} participant{valid.length === 1 ? "" : "s"}
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              {!mappingComplete ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  Choose the Name and Email columns to see a preview.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="pr-4">Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checked.map((row, i) => (
                      <TableRow key={i} className={row.error ? "bg-red-50/60" : undefined}>
                        <TableCell className="pl-4 text-muted-foreground tabular-nums">
                          {i + 2}
                        </TableCell>
                        <TableCell>{row.values.name || "—"}</TableCell>
                        <TableCell>{row.values.email || "—"}</TableCell>
                        <TableCell>{row.values.team || "—"}</TableCell>
                        <TableCell className="pr-4 text-xs">
                          {row.error ? (
                            <span className="flex items-center gap-1 text-red-700">
                              <XCircle className="size-3.5" /> {row.error}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="size-3.5" /> {row.warning ?? "Ready"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
