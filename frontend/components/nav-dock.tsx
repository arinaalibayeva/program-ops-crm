"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { DOCK_ITEMS, type DockItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { CommandMenu } from "./command-menu";

function isActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === href;
  // Importing adds people, so it belongs to People.
  if (href === "/admin/participants" && pathname.startsWith("/admin/import")) return true;
  return pathname.startsWith(href);
}

/** A plain click navigates here; ⌘, ctrl, shift or middle clicks open elsewhere. */
function opensHere(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

// Magnification, like the macOS dock: items grow as the pointer nears them.
const MAX_GROWTH = 0.25; // the item under the pointer is 1.25x
const REACH = 90; // px from an item's centre where growth fades to nothing

/** Floating navigation bar, the same on every page and screen size. */
export function NavDock() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [magnify, setMagnify] = useState(false);
  const [tracking, setTracking] = useState(false);
  // The page a dock link was clicked for, shown as current until that page has loaded.
  const [pending, setPending] = useState<{ href: string; from: string }>();
  const here = pending && pending.from === pathname ? pending.href : pathname;
  const frame = useRef<number>(undefined);
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

  /**
   * Scales each item for a pointer at x (undefined: back to normal), with side margins that
   * make room so items don't overlap. Writes styles directly, once per frame, so moving the
   * pointer doesn't re-render the dock.
   */
  function grow(x: number | undefined) {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      itemRefs.current.forEach((el, i) => {
        const item = centres.current[i];
        if (!el || !item) return;
        const t = x === undefined ? 0 : Math.max(0, 1 - Math.abs(x - item.centre) / REACH);
        const scale = 1 + MAX_GROWTH * t * t * (3 - 2 * t); // smoothstep for a softer falloff
        el.style.transform = scale === 1 ? "" : `scale(${scale})`;
        el.style.transformOrigin = "bottom";
        el.style.marginInline = scale === 1 ? "" : `${((scale - 1) * item.width) / 2}px`;
      });
    });
  }

  useEffect(() => () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
  }, []);

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

  const item = cn(
    tracking ? "duration-75" : "duration-200",
    "flex min-w-12 flex-col items-center gap-0.5 rounded-full px-1.5 py-1.5 text-[10px] font-medium transition-[color,background-color,transform,margin] ease-out sm:min-w-16 sm:px-3 sm:text-[11px]",
  );

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
            setTracking(true);
            grow(e.clientX);
          }}
          onMouseMove={(e) => magnify && grow(e.clientX)}
          onMouseLeave={() => {
            setTracking(false);
            grow(undefined);
          }}
          className="pointer-events-auto flex items-end gap-0.5 rounded-full border bg-background/85 p-1.5 shadow-lg backdrop-blur-md"
        >
          {DOCK_ITEMS.map((dockItem, i) => {
            const { href, label, icon: Icon, stack } = dockItem;
            const active = stack
              ? stack.some((link) => isActive(link.href, here))
              : isActive(href, here);
            const ref = (el: HTMLElement | null) => {
              itemRefs.current[i] = el;
            };
            const look = cn(
              item,
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            );
            if (stack) {
              return (
                <DockStack
                  key={href}
                  item={dockItem}
                  here={here}
                  onNavigate={(to) => setPending({ href: to, from: pathname })}
                  buttonRef={ref}
                  className={look}
                />
              );
            }
            return (
              <Link
                key={href}
                href={href}
                ref={ref}
                onClick={(e) => opensHere(e) && setPending({ href, from: pathname })}
                aria-current={active ? "page" : undefined}
                className={look}
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

/**
 * A dock item that fans its links out above itself, like a folder in the macOS dock.
 * Each link is an icon tile with its label beside it, curving slightly as the fan rises.
 */
function DockStack({
  item,
  here,
  onNavigate,
  buttonRef,
  className,
}: {
  item: DockItem;
  /** The current page, or the one being opened. */
  here: string;
  onNavigate: (href: string) => void;
  buttonRef: (el: HTMLElement | null) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const links = item.stack ?? [];
  const Icon = item.icon;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <ul
        id={`${item.href}-stack`}
        aria-label={item.label}
        aria-hidden={!open}
        className={cn(
          // The tile column sits centred over the button; labels extend to the left.
          // Reversed so the first (most important) link is nearest the button.
          "absolute right-1/2 bottom-full mb-4 flex translate-x-[22px] flex-col-reverse gap-2",
          !open && "pointer-events-none",
        )}
      >
        {links.map((link, i) => {
          const fromBottom = i;
          // Inside the stack each link is its own page, so Import doesn't also light up People.
          const active = here.startsWith(link.href);
          const LinkIcon = link.icon;
          return (
            <li
              key={link.href}
              style={{
                transform: open
                  ? `translateX(${fromBottom * fromBottom * 4}px) rotate(${fromBottom * 2}deg)`
                  : `translateY(${(fromBottom + 1) * 24}px) scale(0.5)`,
                opacity: open ? 1 : 0,
                transitionDelay: `${(open ? fromBottom : links.length - 1 - fromBottom) * 35}ms`,
              }}
              className="origin-right transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
            >
              <Link
                href={link.href}
                tabIndex={open ? undefined : -1}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  setOpen(false);
                  if (opensHere(e)) onNavigate(link.href);
                }}
                className="group flex items-center justify-end gap-2.5"
              >
                <span className="rounded-md bg-foreground/85 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-background shadow-sm backdrop-blur-md">
                  {link.label}
                </span>
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl border shadow-md transition-transform group-hover:scale-110",
                    active ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
                  )}
                >
                  <LinkIcon className="size-5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        ref={(el) => {
          button.current = el;
          buttonRef(el);
        }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${item.href}-stack`}
        className={cn(className, open && "ring-2 ring-ring/40")}
      >
        <Icon className="size-5" />
        {item.label}
      </button>
    </div>
  );
}
