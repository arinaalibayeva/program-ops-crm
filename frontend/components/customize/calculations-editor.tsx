"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import {
  CALCULATION_LABELS,
  CONDITION_LABELS,
  RULE_OP_LABELS,
  canHaveRules,
  describeCalculation,
  describeRule,
  linkOptions,
  targetName,
} from "@/lib/records";
import { useCohort } from "@/lib/store";
import {
  CALCULATION_KINDS,
  CONDITION_OPS,
  RULE_OPS,
  type Calculation,
  type CalculationKind,
  type Condition,
  type ConditionOp,
  type RecordField,
  type RecordType,
  type RuleOp,
} from "@/lib/types";

function suggestLabel(type: RecordType, kind: CalculationKind): string {
  const one = type.singular.toLowerCase();
  if (kind === "count") return type.name;
  if (kind === "latest") return `Last ${one}`;
  if (kind === "days_since") return `Days since last ${one}`;
  return `${type.name} that match`;
}

export function CalculationsEditor({ type }: { type: RecordType }) {
  const { data, deleteCalculation } = useCohort();
  const [adding, setAdding] = useState(false);
  const calcs = data.calculations.filter((c) => c.sourceTypeId === type.id);
  const hasLinks = type.fields.some((f) => f.type === "link");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Calculations and rules</h2>
          <p className="text-sm text-muted-foreground">
            Work out numbers from these records and show them on what they link to. Rules flag it on Today.
          </p>
        </div>
        {!adding && hasLinks && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Add calculation
          </Button>
        )}
      </div>

      {!hasLinks && (
        <p className="rounded-xl border px-3 py-4 text-sm text-muted-foreground">
          Add a link field first, for example to Teams, so there&apos;s something to calculate for.
        </p>
      )}
      {(calcs.length > 0 || adding) && (
        <ul className="divide-y rounded-xl border">
          {calcs.map((c) => (
            <li key={c.id} className="space-y-3 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {c.label}{" "}
                    <span className="font-normal text-muted-foreground">on each {targetName(data, c.on, true).toLowerCase()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{describeCalculation(data, c)}</div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Delete ${c.label}`}
                  onClick={() => deleteCalculation(c.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              {canHaveRules(c.kind) && <RulesEditor calc={c} />}
            </li>
          ))}
          {adding && (
            <li className="bg-muted/30 p-3">
              <NewCalculation type={type} onDone={() => setAdding(false)} />
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ConditionInput({
  field,
  condition,
  onChange,
}: {
  field?: RecordField;
  condition: Condition;
  onChange: (c: Condition) => void;
}) {
  const { data } = useCohort();
  if (!field || condition.op === "is_empty" || condition.op === "is_not_empty") return null;
  const choices =
    field.type === "checkbox"
      ? [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]
      : field.type === "link"
        ? linkOptions(data, field.linkTo!)
        : field.options?.map((o) => ({ id: o, label: o }));
  if (choices) {
    return (
      <NativeSelect
        aria-label="Value"
        value={condition.value ?? ""}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        className="w-full"
      >
        <option value="">Choose…</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  return (
    <Input
      aria-label="Value"
      value={condition.value ?? ""}
      onChange={(e) => onChange({ ...condition, value: e.target.value })}
    />
  );
}

function NewCalculation({ type, onDone }: { type: RecordType; onDone: () => void }) {
  const { data, addCalculation } = useCohort();
  const links = type.fields.filter((f) => f.type === "link");
  const targets = [...new Set(links.map((f) => f.linkTo!))];
  const dates = type.fields.filter((f) => f.type === "date");

  const [on, setOn] = useState(targets[0]);
  const [via, setVia] = useState(links.find((f) => f.linkTo === targets[0])?.id ?? "");
  const [kind, setKind] = useState<CalculationKind>("count");
  const [dateField, setDateField] = useState(dates[0]?.id ?? "");
  const [filtered, setFiltered] = useState(false);
  const [condition, setCondition] = useState<Condition>({ fieldId: type.fields[0]?.id ?? "", op: "is" });
  const [label, setLabel] = useState(suggestLabel(type, "count"));
  const [labelEdited, setLabelEdited] = useState(false);
  const [error, setError] = useState<string>();

  const viaChoices = links.filter((f) => f.linkTo === on);
  const needsDate = kind === "latest" || kind === "days_since";
  const useFilter = filtered || kind === "percent";

  function setKindAndLabel(next: CalculationKind) {
    setKind(next);
    if (!labelEdited) setLabel(suggestLabel(type, next));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Enter a name.");
    if (needsDate && !dateField) return setError("Add a date field to this type first.");
    if (useFilter && condition.op !== "is_empty" && condition.op !== "is_not_empty" && !condition.value) {
      return setError("Choose what to match.");
    }
    addCalculation({
      label: label.trim(),
      on,
      kind,
      sourceTypeId: type.id,
      viaFieldId: via,
      dateFieldId: needsDate ? dateField : undefined,
      filter: useFilter ? condition : undefined,
    });
    onDone();
  }

  const filterField = type.fields.find((f) => f.id === condition.fieldId);

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="calc-on">Show on each</Label>
          <NativeSelect
            id="calc-on"
            value={on}
            onChange={(e) => {
              setOn(e.target.value);
              setVia(links.find((f) => f.linkTo === e.target.value)?.id ?? "");
            }}
            className="w-full"
          >
            {targets.map((t) => (
              <option key={t} value={t}>
                {targetName(data, t, true)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {viaChoices.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="calc-via">Linked by</Label>
            <NativeSelect id="calc-via" value={via} onChange={(e) => setVia(e.target.value)} className="w-full">
              {viaChoices.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="calc-kind">Calculate</Label>
          <NativeSelect
            id="calc-kind"
            value={kind}
            onChange={(e) => setKindAndLabel(e.target.value as CalculationKind)}
            className="w-full"
          >
            {CALCULATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {CALCULATION_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {needsDate && (
          <div className="space-y-1.5">
            <Label htmlFor="calc-date">Using the date</Label>
            {dates.length ? (
              <NativeSelect
                id="calc-date"
                value={dateField}
                onChange={(e) => setDateField(e.target.value)}
                className="w-full"
              >
                {dates.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <p className="pt-2 text-xs text-muted-foreground">This type has no date field.</p>
            )}
          </div>
        )}
      </div>

      {kind !== "percent" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filtered} onChange={(e) => setFiltered(e.target.checked)} />
          Only count some records
        </label>
      )}
      {useFilter && (
        <div className="grid gap-2 sm:grid-cols-3">
          <NativeSelect
            aria-label="Field"
            value={condition.fieldId}
            onChange={(e) => setCondition({ fieldId: e.target.value, op: condition.op })}
            className="w-full"
          >
            {type.fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Condition"
            value={condition.op}
            onChange={(e) => setCondition({ ...condition, op: e.target.value as ConditionOp })}
            className="w-full"
          >
            {CONDITION_OPS.map((op) => (
              <option key={op} value={op}>
                {CONDITION_LABELS[op]}
              </option>
            ))}
          </NativeSelect>
          <ConditionInput field={filterField} condition={condition} onChange={setCondition} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="calc-label">Name</Label>
        <Input
          id="calc-label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelEdited(true);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Add calculation
        </Button>
      </div>
    </form>
  );
}

function RulesEditor({ calc }: { calc: Calculation }) {
  const { data, addRule, deleteRule } = useCohort();
  const rules = data.rules.filter((r) => r.calculationId === calc.id);
  const [adding, setAdding] = useState(false);
  const [op, setOp] = useState<RuleOp>(calc.kind === "percent" ? "lt" : "gt");
  const [value, setValue] = useState("");
  const [whenEmpty, setWhenEmpty] = useState(calc.kind === "days_since");
  const [status, setStatus] = useState<"at_risk" | "missing">("at_risk");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const unit = calc.kind === "percent" ? "%" : calc.kind === "days_since" ? "days" : "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === "" || Number.isNaN(Number(value))) return setError("Enter a number.");
    const text = message.trim() || `${calc.label} ${RULE_OP_LABELS[op]} ${value}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
    addRule({ calculationId: calc.id, op, value: Number(value), whenEmpty, status, message: text });
    setAdding(false);
    setValue("");
    setMessage("");
    setError(undefined);
  }

  return (
    <div className="space-y-2 border-l-2 pl-3">
      {rules.map((r) => (
        <div key={r.id} className="flex items-start justify-between gap-2 text-xs">
          <div>
            <span className="font-medium text-foreground">
              Flag {r.status === "missing" ? "as missing" : "at risk"}
            </span>{" "}
            <span className="text-muted-foreground">
              when {describeRule(r, calc).replace(calc.label, calc.label.toLowerCase())} · “{r.message}”
            </span>
          </div>
          <button
            type="button"
            aria-label="Delete rule"
            onClick={() => deleteRule(r.id)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      {adding ? (
        <form onSubmit={submit} className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>Flag when it</span>
            <NativeSelect aria-label="Comparison" value={op} onChange={(e) => setOp(e.target.value as RuleOp)}>
              {RULE_OPS.map((o) => (
                <option key={o} value={o}>
                  {RULE_OP_LABELS[o]}
                </option>
              ))}
            </NativeSelect>
            <Input
              aria-label="Threshold"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-20"
            />
            {unit && <span className="text-muted-foreground">{unit}</span>}
            <NativeSelect
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "at_risk" | "missing")}
            >
              <option value="at_risk">as at risk</option>
              <option value="missing">as missing</option>
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={whenEmpty} onChange={(e) => setWhenEmpty(e.target.checked)} />
            Also flag when there&apos;s nothing to calculate from yet
          </label>
          <Input
            aria-label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message on Today, e.g. No partner meeting in 2 weeks"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Add rule
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" /> Add rule
        </button>
      )}
    </div>
  );
}
