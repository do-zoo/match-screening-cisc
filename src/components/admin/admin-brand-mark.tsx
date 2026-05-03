import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { SITE_BRAND_SHORT } from "@/lib/site-metadata";

export function AdminBrandMark() {
  return (
    <Link
      href="/admin"
      className="flex min-w-0 items-center gap-3 rounded-lg outline-none ring-offset-background transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Logo height={36} className="shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">
          {SITE_BRAND_SHORT} Admin
        </p>
        <p className="text-xs text-sidebar-foreground/70">Panel PIC</p>
      </div>
    </Link>
  );
}
