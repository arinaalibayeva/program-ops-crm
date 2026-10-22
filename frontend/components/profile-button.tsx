"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/lib/format";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** The signed-in person's initials, top right on every page. */
export function ProfileButton() {
  const { profile } = useProfile();
  const active = usePathname().startsWith("/admin/profile");
  return (
    <Link
      href="/admin/profile"
      aria-label="Your profile"
      aria-current={active ? "page" : undefined}
      className={cn(
        "absolute top-3 right-4 z-30 flex size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-105 sm:right-6 lg:right-10",
        active && "ring-2 ring-primary/30 ring-offset-2 ring-offset-transparent",
      )}
    >
      {profile ? initials(profile.name) : ""}
    </Link>
  );
}
