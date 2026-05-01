import { cn } from "@/lib/utils";

/** Shared nav row styles: desktop global nav + desktop event Inbox/Laporan chips. */
export function adminShellNavLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
  );
}
