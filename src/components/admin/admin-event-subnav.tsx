"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = { eventId: string };

/** Mobile-only Inbox | Laporan pills below breadcrumbs (§3 hybrid sub-nav). */
export function AdminEventSubnav({ eventId }: Props) {
  const pathname = usePathname();

  const isReport =
    pathname === `/admin/events/${eventId}/report` ||
    pathname?.startsWith(`/admin/events/${eventId}/report/`);
  const isInbox =
    pathname === `/admin/events/${eventId}/inbox` ||
    pathname?.startsWith(`/admin/events/${eventId}/inbox/`);

  const basePill =
    "rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const activePill =
    "border-transparent bg-sidebar-accent text-sidebar-accent-foreground";

  return (
    <nav
      aria-label="Inbox dan laporan"
      className="flex flex-wrap gap-2 pb-4 lg:hidden"
      role="tablist"
    >
      <Link
        href={`/admin/events/${eventId}/inbox`}
        aria-current={isInbox && !isReport ? "page" : undefined}
        className={cn(
          basePill,
          isInbox && !isReport
            ? activePill
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        Inbox
      </Link>
      <Link
        href={`/admin/events/${eventId}/report`}
        aria-current={isReport ? "page" : undefined}
        className={cn(
          basePill,
          isReport ? activePill : "text-muted-foreground hover:bg-muted",
        )}
      >
        Laporan
      </Link>
    </nav>
  );
}
