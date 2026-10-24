"use client";

// Someone's own to-dos and quick notes on Today. Saved to their account when
// the backend is on, otherwise in this browser.

import { useCallback, useEffect, useState } from "react";
import { USE_BACKEND, api } from "./api";

export interface PersonalItem {
  id: string;
  kind: "todo" | "note";
  body: string;
  description?: string;
  done: boolean;
  createdAt: string;
}

const KEY = "program-ops-crm:personal-items";

function newId(): string {
  return `item-${Math.random().toString(36).slice(2, 10)}`;
}

function readLocal(): PersonalItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLocal(items: PersonalItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Not kept after a reload; nothing else to do.
  }
}

export function usePersonalItems() {
  const [items, setItems] = useState<PersonalItem[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (USE_BACKEND) {
      api<PersonalItem[]>("/me/items")
        .then(setItems)
        .catch((e: Error) => setError(e.message));
    } else {
      setItems(readLocal());
    }
  }, []);

  /** Shows the change right away, then swaps in what was saved. */
  const change = useCallback(
    (
      next: (current: PersonalItem[]) => PersonalItem[],
      send: () => Promise<PersonalItem[]>,
    ) => {
      setItems((current) => {
        const updated = next(current ?? []);
        if (!USE_BACKEND) writeLocal(updated);
        return updated;
      });
      if (!USE_BACKEND) return;
      setError(undefined);
      send()
        .then(setItems)
        .catch((e: Error) => {
          setError(e.message);
          api<PersonalItem[]>("/me/items")
            .then(setItems)
            .catch(() => {});
        });
    },
    [],
  );

  const add = useCallback(
    (kind: PersonalItem["kind"], body: string, description?: string) => {
      const id = newId();
      const item: PersonalItem = {
        id,
        kind,
        body: body.trim(),
        description: description?.trim() || undefined,
        done: false,
        createdAt: new Date().toISOString(),
      };
      change(
        (current) => [item, ...current],
        () => api("/me/items", { body: { id, kind, body, description } }),
      );
    },
    [change],
  );

  const setDone = useCallback(
    (id: string, done: boolean) => {
      change(
        (current) => current.map((i) => (i.id === id ? { ...i, done } : i)),
        () => api(`/me/items/${id}`, { method: "PATCH", body: { done } }),
      );
    },
    [change],
  );

  const remove = useCallback(
    (id: string) => {
      change(
        (current) => current.filter((i) => i.id !== id),
        () => api(`/me/items/${id}`, { method: "DELETE" }),
      );
    },
    [change],
  );

  return { items, error, add, setDone, remove };
}
