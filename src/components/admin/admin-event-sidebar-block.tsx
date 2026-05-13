"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { InboxIcon, Settings, Table2Icon } from "lucide-react";

import {
  adminShellNavIconClass,
  adminShellNavLinkClass,
} from "@/components/admin/admin-shell-nav-styles";

const EVENT_BRANCH_RE =
  /^\/admin\/events\/([^/]+)\/(?:inbox|report|edit)(?:\/|$)/;

function AdminEventSidebarBlockLoaded({
  eventId,
}: {
  eventId: string;
}) {
  const pathname = usePathname();

  const isEditBranch =
    !!pathname && pathname === `/admin/events/${eventId}/edit`;
  const isReportBranch =
    !!pathname &&
    (pathname === `/admin/events/${eventId}/report` ||
      pathname.startsWith(`/admin/events/${eventId}/report/`));
  const isInboxBranch =
    !!pathname &&
    (pathname === `/admin/events/${eventId}/inbox` ||
      pathname.startsWith(`/admin/events/${eventId}/inbox/`));

  const [title, setTitle] = useState<string | null>(null);
  const [canManageEventSettings, setCanManageEventSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/admin/events/${eventId}/title`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        title?: string;
        canManageEventSettings?: boolean;
      };
      if (!cancelled) {
        setTitle(data.title ?? null);
        setCanManageEventSettings(Boolean(data.canManageEventSettings));
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="border-t border-sidebar-border/70 pt-5">
      <div className="rounded-xl bg-sidebar-accent/35 p-3.5 shadow-sm ring-1 ring-sidebar-border/45">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
          Acara
        </p>
        {title ? (
          <p
            className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-sidebar-foreground"
            title={title}
          >
            {title}
          </p>
        ) : (
          <p className="mt-2 text-xs text-sidebar-foreground/45">Memuat judul…</p>
        )}
        <nav
          aria-label="Inbox, laporan, dan pengaturan"
          className="mt-3 flex flex-col gap-0.5"
        >
          <Link
            href={`/admin/events/${eventId}/inbox`}
            className={adminShellNavLinkClass(
              isInboxBranch && !isReportBranch && !isEditBranch,
            )}
          >
            <InboxIcon
              className={adminShellNavIconClass(
                isInboxBranch && !isReportBranch && !isEditBranch,
              )}
              aria-hidden
            />
            Inbox
          </Link>
          <Link
            href={`/admin/events/${eventId}/report`}
            className={adminShellNavLinkClass(isReportBranch && !isEditBranch)}
          >
            <Table2Icon
              className={adminShellNavIconClass(isReportBranch && !isEditBranch)}
              aria-hidden
            />
            Laporan
          </Link>
          {canManageEventSettings ? (
            <Link
              href={`/admin/events/${eventId}/edit`}
              className={adminShellNavLinkClass(isEditBranch)}
            >
              <Settings
                className={adminShellNavIconClass(isEditBranch)}
                aria-hidden
              />
              Pengaturan
            </Link>
          ) : null}
        </nav>
      </div>
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
