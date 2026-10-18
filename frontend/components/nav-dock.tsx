"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { DOCK_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { CommandMenu } from "./command-menu";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === href;
  // Importing adds people, so it belongs to People.
  if (href === "/admin/participants" && pathname.startsWith("/admin/import")) return true;
  return pathname.startsWith(href);
}

// Magnification, like the macOS dock: items grow as the pointer nears them.
const MAX_GROWTH = 0.45; // the item under the pointer is 1.45x
const REACH = 110; // px from an item's centre where growth fades to nothing

/** Floating navigation bar, the same on every page and screen size. */
export function NavDock() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [pointerX, setPointerX] = useState<number>();
  const [magnify, setMagnify] = useState(false);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Item centres measured before growing, so growth doesn't move its own targets.
  const centres = useRef<{ centre: number; width: number }[]>([]);

  // Only with a mouse or trackpad, and not for people who prefer less motion.
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)");
    const update = () => setMagnify(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function measure() {
    centres.current = itemRefs.current.map((el) => {
      const box = el?.getBoundingClientRect();
      return box ? { centre: box.left + box.width / 2, width: box.width } : { centre: 0, width: 0 };
    });
  }

  /** Scale and side margin for item i; the margin makes room so items don't overlap. */
  function growth(i: number): React.CSSProperties | undefined {
    if (!magnify) return undefined;
    const item = centres.current[i];
    const t = pointerX === undefined || !item ? 0 : Math.max(0, 1 - Math.abs(pointerX - item.centre) / REACH);
    const scale = 1 + MAX_GROWTH * t * t * (3 - 2 * t); // smoothstep for a softer falloff
    return {
      transform: `scale(${scale})`,
      transformOrigin: "bottom",
      marginInline: ((scale - 1) * (item?.width ?? 0)) / 2,
    };
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const item =
    "flex min-w-12 flex-col items-center gap-0.5 rounded-full px-1.5 py-1.5 text-[10px] font-medium transition-[color,background-color,transform,margin] duration-150 ease-out sm:min-w-16 sm:px-3 sm:text-[11px]";

  return (
    <>
      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-5"
      >
        <div
          onMouseEnter={(e) => {
            if (!magnify) return;
            measure();
            setPointerX(e.clientX);
          }}
          onMouseMove={(e) => magnify && setPointerX(e.clientX)}
          onMouseLeave={() => setPointerX(undefined)}
          className="pointer-events-auto flex items-end gap-0.5 rounded-full border bg-background/85 p-1.5 shadow-lg backdrop-blur-md"
        >
          {DOCK_ITEMS.map(({ href, label, icon: Icon }, i) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                style={growth(i)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  item,
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          <div className="mx-1 mb-1.5 h-8 w-px self-end bg-border" aria-hidden />
          <button
            type="button"
            ref={(el) => {
              itemRefs.current[DOCK_ITEMS.length] = el;
            }}
            style={growth(DOCK_ITEMS.length)}
            onClick={() => setSearchOpen(true)}
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(item, "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
          >
            <Search className="size-5" />
            <span>
              Search <span className="hidden sm:inline">⌘K</span>
            </span>
          </button>
        </div>
      </nav>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
