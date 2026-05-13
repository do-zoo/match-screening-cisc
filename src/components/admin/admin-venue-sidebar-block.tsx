"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, UtensilsCrossed } from "lucide-react";

import {
  adminShellNavIconClass,
  adminShellNavLinkClass,
} from "@/components/admin/admin-shell-nav-styles";

const VENUE_BRANCH_RE = /^\/admin\/venues\/([^/]+)\/(?:edit|menu)(?:\/|$)/;

function AdminVenueSidebarBlockLoaded({ venueId }: { venueId: string }) {
  const pathname = usePathname();
  const isEdit = !!pathname && pathname === `/admin/venues/${venueId}/edit`;
  const isMenu = !!pathname && pathname === `/admin/venues/${venueId}/menu`;

  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/admin/venues/${venueId}/label`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { name?: string };
      if (!cancelled) {
        setName(data.name ?? null);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [venueId]);

  return (
    <div className="border-sidebar-border/70 border-t pt-5">
      <div className="bg-sidebar-accent/35 ring-sidebar-border/45 rounded-xl p-3.5 shadow-sm ring-1">
        <p className="text-sidebar-foreground/50 text-[11px] font-semibold tracking-[0.14em] uppercase">
          Venue
        </p>
        {name ? (
          <p
            className="text-sidebar-foreground mt-2 line-clamp-2 text-[13px] leading-snug font-semibold"
            title={name}
          >
            {name}
          </p>
        ) : (
          <p className="text-sidebar-foreground/45 mt-2 text-xs">Memuat nama…</p>
        )}
        <nav aria-label="Info venue dan menu" className="mt-3 flex flex-col gap-0.5">
          <Link
            href={`/admin/venues/${venueId}/edit`}
            className={adminShellNavLinkClass(isEdit && !isMenu)}
          >
            <MapPin
              className={adminShellNavIconClass(isEdit && !isMenu)}
              aria-hidden
            />
            Info dasar
          </Link>
          <Link
            href={`/admin/venues/${venueId}/menu`}
            className={adminShellNavLinkClass(isMenu)}
          >
            <UtensilsCrossed className={adminShellNavIconClass(isMenu)} aria-hidden />
            Menu kanonik
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function AdminVenueSidebarBlock() {
  const pathname = usePathname();
  const branchMatch = pathname ? pathname.match(VENUE_BRANCH_RE) : null;
  const venueId = branchMatch?.[1] ?? null;

  if (!venueId) return null;

  return <AdminVenueSidebarBlockLoaded venueId={venueId} />;
}
