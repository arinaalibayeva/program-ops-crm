"use client";

// The signed-in admin's own details. Saved through the backend when it's on,
// otherwise in this browser.

import { useCallback, useEffect, useState } from "react";
import { USE_BACKEND, api } from "./api";

export interface Profile {
  /** The staff member this is, so pages can show what's yours. */
  id?: string;
  name: string;
  email: string;
  jobTitle?: string;
  pronouns?: string;
  phone?: string;
  /** From the backend: manager, admin or participant. */
  role?: string;
}

const KEY = "program-ops-crm:profile";
const DEMO: Profile = {
  id: "staff-demo",
  name: "Arina Alibayeva",
  email: "admin@demo.test",
  jobTitle: "Program coordinator",
};

export function useProfile() {
  const [profile, setProfile] = useState<Profile>();

  useEffect(() => {
    if (USE_BACKEND) {
      api<Profile>("/me")
        .then(setProfile)
        .catch(() => setProfile(DEMO));
      return;
    }
    try {
      const saved = localStorage.getItem(KEY);
      setProfile(saved ? { ...DEMO, ...JSON.parse(saved) } : DEMO);
    } catch {
      setProfile(DEMO);
    }
  }, []);

  /** Saves and returns the stored profile; throws with a readable message if refused. */
  const save = useCallback(async (next: Profile) => {
    const saved = USE_BACKEND
      ? await api<Profile>("/me", { method: "PUT", body: next })
      : next;
    if (!USE_BACKEND) {
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch {
        // Not kept after a reload; nothing else to do.
      }
    }
    setProfile(saved);
    return saved;
  }, []);

  return { profile, save };
}
