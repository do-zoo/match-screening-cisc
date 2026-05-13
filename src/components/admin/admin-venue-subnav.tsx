"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Props = { venueId: string };

/** Mobile pills: Info dasar | Menu (mirrors pola sub-nav acara). */
export function AdminVenueSubnav({ venueId }: Props) {
  const pathname = usePathname();
  const isEdit = pathname === `/admin/venues/${venueId}/edit`;
  const isMenu = pathname === `/admin/venues/${venueId}/menu`;

  const basePill =
    "border-border bg-background focus-visible:ring-ring rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
  const activePill =
    "border-transparent bg-sidebar-accent text-sidebar-accent-foreground";

  return (
    <nav
      aria-label="Info venue dan menu"
      className="flex flex-wrap gap-2 pb-4 lg:hidden"
      role="tablist"
    >
      <Link
        href={`/admin/venues/${venueId}/edit`}
        aria-current={isEdit ? "page" : undefined}
        className={cn(
          basePill,
          isEdit ? activePill : "text-muted-foreground hover:bg-muted",
        )}
      >
        Info dasar
      </Link>
      <Link
        href={`/admin/venues/${venueId}/menu`}
        aria-current={isMenu ? "page" : undefined}
        className={cn(
          basePill,
          isMenu ? activePill : "text-muted-foreground hover:bg-muted",
        )}
      >
        Menu kanonik
      </Link>
    </nav>
  );
}
