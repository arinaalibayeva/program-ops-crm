"use client";

import { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section ids in a wide left column and a narrow right column. */
export interface BoardLayout<Id extends string> {
  left: Id[];
  right: Id[];
}

type Column = "left" | "right";

/**
 * Two-column page layout. When `onChange` is given, each section gets a drag
 * handle and can be dropped anywhere in either column.
 */
export function SectionBoard<Id extends string>({
  layout,
  onChange,
  labels,
  render,
}: {
  layout: BoardLayout<Id>;
  onChange?: (layout: BoardLayout<Id>) => void;
  labels: Record<Id, string>;
  render: (id: Id) => React.ReactNode;
}) {
  const editable = !!onChange;
  const [dragging, setDragging] = useState<Id>();
  const [target, setTarget] = useState<{ column: Column; index: number }>();
  const ghostRef = useRef<HTMLDivElement>(null);
  const columnRefs = { left: useRef<HTMLDivElement>(null), right: useRef<HTMLDivElement>(null) };

  /** Drop position among the column's other sections, from the pointer's height. */
  function indexAt(column: Column, clientY: number): number {
    const items = [
      ...(columnRefs[column].current?.querySelectorAll<HTMLElement>("[data-section]") ?? []),
    ].filter((el) => el.dataset.section !== dragging);
    const i = items.findIndex((el) => {
      const box = el.getBoundingClientRect();
      return clientY < box.top + box.height / 2;
    });
    return i === -1 ? items.length : i;
  }

  function drop() {
    if (dragging && target && onChange) {
      const left = layout.left.filter((id) => id !== dragging);
      const right = layout.right.filter((id) => id !== dragging);
      (target.column === "left" ? left : right).splice(target.index, 0, dragging);
      onChange({ left, right });
    }
    endDrag();
  }

  function endDrag() {
    setDragging(undefined);
    setTarget(undefined);
  }

  const leftEmpty = layout.left.length === 0;
  const rightEmpty = layout.right.length === 0;

  function renderColumn(column: Column) {
    const ids = layout[column];
    const indicator = (
      <div key="drop-indicator" className="h-1 rounded-full bg-primary/60" aria-hidden />
    );
    // The dragged section stays in place, faded, so the browser keeps its
    // drag source; drop positions are counted among the other sections.
    const children: React.ReactNode[] = [];
    let k = 0;
    for (const id of ids) {
      if (id === dragging) {
        children.push(
          <div key={id} className="opacity-40">
            {renderSection(id)}
          </div>,
        );
        continue;
      }
      if (target?.column === column && target.index === k) children.push(indicator);
      children.push(
        <div key={id} data-section={id}>
          {renderSection(id)}
        </div>,
      );
      k++;
    }
    if (target?.column === column && target.index === k) children.push(indicator);

    return (
      <div
        ref={columnRefs[column]}
        onDragOver={(e) => {
          if (!dragging) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const index = indexAt(column, e.clientY);
          if (target?.column !== column || target.index !== index) setTarget({ column, index });
        }}
        onDrop={(e) => {
          e.preventDefault();
          drop();
        }}
        className={cn(
          "space-y-6",
          column === "left" ? "lg:col-span-2" : "",
          !editable && (column === "left" ? rightEmpty : leftEmpty) && "lg:col-span-3",
          editable && "min-h-24",
        )}
      >
        {children}
        {editable && ids.length === 0 && !target && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
            Drop sections here
          </div>
        )}
      </div>
    );
  }

  function renderSection(id: Id) {
    if (!editable) return render(id);
    // While anything is being dragged, every section shrinks to its handle so
    // the layout reads like puzzle pieces and drop spots are close together.
    const compact = dragging !== undefined;
    return (
      <div
        className={cn(
          "rounded-xl outline-1 outline-offset-4 outline-border outline-dashed",
          compact && "bg-card",
        )}
      >
        {/* Only the handle is draggable, so sections' text and inputs work as usual. */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);
            // A small label follows the pointer instead of a snapshot of the whole section.
            if (ghostRef.current) {
              ghostRef.current.textContent = labels[id];
              e.dataTransfer.setDragImage(ghostRef.current, 12, 12);
            }
            // Wait a frame so the browser starts the drag before the layout shrinks.
            requestAnimationFrame(() => setDragging(id));
          }}
          onDragEnd={endDrag}
          className={cn(
            "flex cursor-grab items-center gap-1.5 text-xs text-muted-foreground select-none active:cursor-grabbing",
            compact ? "px-4 py-3 text-sm font-medium text-foreground" : "mb-2",
          )}
        >
          <GripVertical className="size-4 text-muted-foreground" />
          {labels[id]}
          {!compact && " · drag to move"}
        </div>
        {!compact && render(id)}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {(editable || !leftEmpty) && renderColumn("left")}
      {(editable || !rightEmpty) && renderColumn("right")}
      {/* Drag preview: must be rendered (not display:none), so it sits off screen. */}
      <div
        ref={ghostRef}
        aria-hidden
        className="pointer-events-none fixed -top-40 left-0 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium shadow-md"
      />
    </div>
  );
}
