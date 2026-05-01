"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const COMMITTEE_SETTINGS_NAV = [
  { href: "/admin/settings", label: "Ringkasan" },
  { href: "/admin/settings/committee", label: "Komite & admin" },
  { href: "/admin/settings/pricing", label: "Harga default" },
  { href: "/admin/settings/whatsapp-templates", label: "Template WhatsApp" },
  { href: "/admin/settings/branding", label: "Branding" },
  { href: "/admin/settings/notifications", label: "Notifikasi" },
  { href: "/admin/settings/operations", label: "Operasional" },
  { href: "/admin/settings/security", label: "Keamanan" },
] as const;

export function CommitteeSettingsSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Submenu pengaturan"
      className="flex flex-row gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      {COMMITTEE_SETTINGS_NAV.map((item) => {
        const active =
          item.href === "/admin/settings"
            ? pathname === "/admin/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
