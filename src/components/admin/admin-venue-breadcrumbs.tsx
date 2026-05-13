"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminVenueBreadcrumbs({
  venueId,
  name,
}: {
  venueId: string;
  name: string;
}) {
  const pathname = usePathname();
  const isEdit = pathname === `/admin/venues/${venueId}/edit`;
  const isMenu = pathname === `/admin/venues/${venueId}/menu`;

  const crumbs: { label: string; href?: string; current?: boolean }[] = [
    { label: "Beranda", href: "/admin" },
    { label: "Venue", href: "/admin/venues" },
    { label: name, href: `/admin/venues/${venueId}/edit` },
  ];

  if (isEdit) {
    crumbs.push({ label: "Info dasar", current: true });
  } else if (isMenu) {
    crumbs.push({ label: "Menu kanonik", current: true });
  } else {
    crumbs.push({ label: "Kelola", current: true });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-muted-foreground/90 flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 ? (
              <span className="text-muted-foreground/50 inline-block px-1" aria-hidden>
                ›
              </span>
            ) : null}
            {c.href && !c.current ? (
              <Link
                href={c.href}
                className={cn(
                  "text-muted-foreground hover:text-primary max-w-[12rem] truncate font-medium underline-offset-4 hover:underline md:max-w-md",
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "text-foreground max-w-[14rem] truncate font-semibold md:max-w-lg",
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
