"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";

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

  return (
    <nav
      aria-label="Inbox dan laporan"
      className="flex flex-wrap gap-2 pb-4 lg:hidden"
      role="tablist"
    >
      <Link
        href={`/admin/events/${eventId}/inbox`}
        aria-current={isInbox && !isReport ? "page" : undefined}
        className={buttonVariants({
          variant: isInbox && !isReport ? "secondary" : "outline",
          size: "sm",
          className: "rounded-full",
        })}
      >
        Inbox
      </Link>
      <Link
        href={`/admin/events/${eventId}/report`}
        aria-current={isReport ? "page" : undefined}
        className={buttonVariants({
          variant: isReport ? "secondary" : "outline",
          size: "sm",
          className: "rounded-full",
        })}
      >
        Laporan
      </Link>
    </nav>
  );
}
