"use client";

import { useEffect } from "react";

/** Applies a query parameter once on load, so a link can open a page already filtered. */
export function useUrlParam(name: string, apply: (value: string) => void) {
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get(name);
    if (value) apply(value);
  }, [name, apply]);
}
