"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { pathsMatchRegistrationDetail } from "@/lib/admin/event-inbox-detail-path";
import { cn } from "@/lib/utils";

export function AdminEventBreadcrumbs({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const pathname = usePathname();
  const isReport =
    pathname === `/admin/events/${eventId}/report` ||
    pathname?.startsWith(`/admin/events/${eventId}/report/`);
  const isInboxExact = pathname === `/admin/events/${eventId}/inbox`;
  const isRegistrationDetail = pathsMatchRegistrationDetail(
    pathname ?? null,
    eventId,
  );

  const isEdit = pathname === `/admin/events/${eventId}/edit`;

  const crumbs: { label: string; href?: string; current?: boolean }[] = [];

  if (isEdit) {
    crumbs.push(
      { label: "Beranda", href: "/admin?tab=active" },
      { label: "Acara", href: "/admin/events" },
      { label: title, href: `/admin/events/${eventId}/inbox` },
      { label: "Pengaturan", current: true },
    );
  } else {
    crumbs.push(
      { label: "Beranda", href: "/admin?tab=active" },
      {
        label: title,
        href: `/admin/events/${eventId}/inbox`,
      },
    );

    if (isReport) {
      crumbs.push({ label: "Laporan", current: true });
    } else if (isRegistrationDetail) {
      crumbs.push(
        { label: "Inbox", href: `/admin/events/${eventId}/inbox` },
        { label: "Detail", current: true },
      );
    } else if (isInboxExact) {
      crumbs.push({ label: "Inbox", current: true });
    }
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? (
              <span className="inline-block px-1 text-muted-foreground/70" aria-hidden>
                ›
              </span>
            ) : null}
            {c.href && !c.current ? (
              <Link
                href={c.href}
                className={cn(
                  "max-w-[12rem] truncate font-medium underline-offset-4 hover:underline hover:text-foreground md:max-w-md",
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "max-w-[14rem] truncate font-medium md:max-w-lg",
                  c.current && "text-foreground",
                )}
                {...(c.current ? { "aria-current": "page" as const } : {})}
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
