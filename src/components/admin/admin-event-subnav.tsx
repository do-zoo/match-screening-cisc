"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = { eventId: string; canManageEventSettings?: boolean };

/** Mobile-only Peserta Acara | Laporan | (opsional) Pengaturan pills below breadcrumbs (§3 hybrid sub-nav). */
export function AdminEventSubnav({
  eventId,
  canManageEventSettings = false,
}: Props) {
  const pathname = usePathname();

  const isEdit = pathname === `/admin/events/${eventId}/edit`;
  const isReport =
    pathname === `/admin/events/${eventId}/report` ||
    pathname?.startsWith(`/admin/events/${eventId}/report/`);
  const listPath = `/admin/events/${eventId}/registrants`;
  const isRegistrants =
    pathname === listPath || pathname?.startsWith(`${listPath}/`);

  const basePill =
    "rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const activePill =
    "border-transparent bg-sidebar-accent text-sidebar-accent-foreground";

  const registrantsActive = isRegistrants && !isReport && !isEdit;
  const reportActive = isReport && !isEdit;

  return (
    <nav
      aria-label="Peserta acara, laporan, dan pengaturan"
      className="flex flex-wrap gap-2 pb-4 lg:hidden"
      role="tablist"
    >
      <Link
        href={listPath}
        aria-current={registrantsActive ? "page" : undefined}
        className={cn(
          basePill,
          registrantsActive ? activePill : "text-muted-foreground hover:bg-muted",
        )}
      >
        Peserta Acara
      </Link>
      <Link
        href={`/admin/events/${eventId}/report`}
        aria-current={reportActive ? "page" : undefined}
        className={cn(
          basePill,
          reportActive ? activePill : "text-muted-foreground hover:bg-muted",
        )}
      >
        Laporan
      </Link>
      {canManageEventSettings ? (
        <Link
          href={`/admin/events/${eventId}/edit`}
          aria-current={isEdit ? "page" : undefined}
          className={cn(
            basePill,
            isEdit ? activePill : "text-muted-foreground hover:bg-muted",
          )}
        >
          Pengaturan
        </Link>
      ) : null}
    </nav>
  );
}
