import { cn } from "@/lib/utils";

/** Icons in sidebar nav rows — brighter on hover/active. */
export function adminShellNavIconClass(active: boolean) {
  return cn(
    "size-[1.0625rem] shrink-0 transition-colors",
    active
      ? "text-primary"
      : "text-sidebar-foreground/55 group-hover/nav:text-sidebar-foreground",
  );
}

/** Shared nav row styles: desktop global nav + desktop event Inbox/Laporan. */
export function adminShellNavLinkClass(active: boolean) {
  return cn(
    "group/nav relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-[background-color,color,box-shadow,border-color]",
    "text-sidebar-foreground/92 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active &&
      cn(
        "border-sidebar-border/50 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]",
        "font-semibold",
      ),
  );
}
