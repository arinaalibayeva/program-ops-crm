"use client";

import { NativeSelect } from "@/components/native-select";
import { UNASSIGNED } from "@/lib/staff";
import { useCohort } from "@/lib/store";

/** Picks the staff member who looks after a team or partner. */
export function OwnerSelect({
  value,
  onChange,
  className,
}: {
  value: string | undefined;
  onChange: (ownerId: string | undefined) => void;
  className?: string;
}) {
  const { data } = useCohort();
  return (
    <NativeSelect
      aria-label="Assigned to"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={className}
    >
      <option value="">{UNASSIGNED}</option>
      {data.staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </NativeSelect>
  );
}
