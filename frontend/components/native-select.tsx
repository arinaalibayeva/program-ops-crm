import { cn } from "@/lib/utils";

/** Styled native <select>; simpler than a custom popover for filters and forms. */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        // native-select (globals.css) draws our own arrow, inset from the edge.
        "native-select h-8 rounded-lg border border-input bg-background pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}
