"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { adminShellNavLinkClass } from "@/components/admin/admin-shell-nav-styles";

const EVENT_BRANCH_RE =
  /^\/admin\/events\/([^/]+)\/(?:inbox|report)(?:\/|$)/;

function AdminEventSidebarBlockLoaded({
  eventId,
}: {
  eventId: string;
}) {
  const pathname = usePathname();

  const isReportBranch =
    !!pathname &&
    (pathname === `/admin/events/${eventId}/report` ||
      pathname.startsWith(`/admin/events/${eventId}/report/`));
  const isInboxBranch =
    !!pathname &&
    (pathname === `/admin/events/${eventId}/inbox` ||
      pathname.startsWith(`/admin/events/${eventId}/inbox/`));

  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/admin/events/${eventId}/title`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { title?: string };
      if (!cancelled) setTitle(data.title ?? null);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="space-y-2 border-t border-sidebar-border pt-4">
      <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">
        Acara
      </p>
      {title ? (
        <p
          className="line-clamp-2 px-3 text-xs font-medium text-sidebar-foreground"
          title={title}
        >
          {title}
        </p>
      ) : null}
      <nav aria-label="Inbox dan laporan" className="flex flex-col gap-1">
        <Link
          href={`/admin/events/${eventId}/inbox`}
          className={adminShellNavLinkClass(isInboxBranch && !isReportBranch)}
        >
          Inbox
        </Link>
        <Link
          href={`/admin/events/${eventId}/report`}
          className={adminShellNavLinkClass(isReportBranch)}
        >
          Laporan
        </Link>
      </nav>
    </div>
  );
}

export function AdminEventSidebarBlock() {
  const pathname = usePathname();
  const match = pathname ? EVENT_BRANCH_RE.exec(pathname) : null;
  const eventId = match?.[1] ?? null;

  if (!eventId) return null;

  return <AdminEventSidebarBlockLoaded key={eventId} eventId={eventId} />;
}
