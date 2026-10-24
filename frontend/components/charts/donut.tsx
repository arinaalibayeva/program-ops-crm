"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  label: string;
  value: number;
  /** A fill class for the legend swatch and a stroke class for the ring. */
  fill: string;
  stroke: string;
  /** Opens whatever is behind this slice. */
  href?: string;
}

const SIZE = 116; // the drawing; it scales to DISPLAY_SIZE on screen
const DISPLAY_SIZE = 92;
const THICKNESS = 14;
const RADIUS = (SIZE - THICKNESS) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3; // px of background between slices

/**
 * A ring of slices with its total in the middle. Hovering or focusing a legend
 * row or slice shows that slice in the middle; the legend always shows every
 * count, so nothing depends on color or hover alone.
 */
export function Donut({ slices, unit }: { slices: DonutSlice[]; unit: string }) {
  const [active, setActive] = useState<string>();
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const shown = slices.find((s) => s.label === active);
  const visible = slices.filter((s) => s.value > 0);

  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}>
        <svg
          width={DISPLAY_SIZE}
          height={DISPLAY_SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={slices.map((s) => `${s.label}: ${s.value}`).join(", ")}
          className="-rotate-90"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={THICKNESS} className="stroke-muted" />
          {visible.map((slice) => {
            const length = (slice.value / total) * CIRCUMFERENCE;
            const gap = visible.length > 1 ? GAP : 0;
            const dash = Math.max(length - gap, 1);
            const circle = (
              <circle
                key={slice.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={THICKNESS}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setActive(slice.label)}
                onMouseLeave={() => setActive(undefined)}
                className={cn(
                  slice.stroke,
                  "transition-opacity duration-150",
                  active && active !== slice.label && "opacity-35",
                )}
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl leading-none font-semibold tabular-nums">{shown ? shown.value : total}</span>
          <span className="mt-0.5 max-w-16 truncate text-[11px] text-muted-foreground">{shown ? shown.label : unit}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {slices.map((slice) => (
          <li
            key={slice.label}
            onMouseEnter={() => setActive(slice.label)}
            onMouseLeave={() => setActive(undefined)}
            onFocus={() => setActive(slice.label)}
            onBlur={() => setActive(undefined)}
          >
            <LegendRow slice={slice} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LegendRow({ slice }: { slice: DonutSlice }) {
  const row = "flex items-center gap-2 rounded text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
  const content = (
    <>
      <span className={cn("size-2.5 shrink-0 rounded-[3px]", slice.fill)} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
      <span className="font-medium tabular-nums">{slice.value}</span>
    </>
  );
  return slice.href ? (
    <Link href={slice.href} className={cn(row, "hover:underline")}>
      {content}
    </Link>
  ) : (
    <div tabIndex={0} className={row}>
      {content}
    </div>
  );
}
