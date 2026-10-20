"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Temporary: compares design options on the real pages. It goes away once one
// is chosen. The choice is a convenience, so it's only kept in this browser.
const KEY = "program-ops-crm:theme-option";
const OPTIONS = [
  { id: "white", label: "Clean white", swatch: "#ffffff" },
  { id: "gray", label: "Soft gray", swatch: "#e4e7ec" },
  { id: "stone", label: "Warm stone", swatch: "#e9e3d6" },
  { id: "midnight", label: "Midnight", swatch: "#0f1724" },
  { id: "sky", label: "Current sky", swatch: "linear-gradient(160deg, #bcd6ea, #efe4d2)" },
];
const DEFAULT = "gray";

export function ThemePicker() {
  const [theme, setTheme] = useState(DEFAULT);

  useEffect(() => {
    try {
      setTheme(localStorage.getItem(KEY) ?? DEFAULT);
    } catch {
      // Storage can be blocked; the default still works.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function choose(id: string) {
    setTheme(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Not remembered after a reload; nothing else to do.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Design option"
      className="fixed top-3.5 right-16 z-40 flex items-center gap-1.5 rounded-full border bg-background px-2 py-1.5 shadow-sm sm:right-[4.5rem] lg:right-[5.5rem]"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={theme === option.id}
          aria-label={option.label}
          title={option.label}
          onClick={() => choose(option.id)}
          style={{ background: option.swatch }}
          className={cn(
            "size-5 rounded-full border border-black/15",
            theme === option.id && "ring-2 ring-primary ring-offset-1 ring-offset-background",
          )}
        />
      ))}
    </div>
  );
}
