"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import {
  CalendarDays,
  Home,
  MenuIcon,
  Settings,
  Users,
} from "lucide-react";

import { AdminBrandMark } from "@/components/admin/admin-brand-mark";
import { AdminEventSidebarBlock } from "@/components/admin/admin-event-sidebar-block";
import { adminShellNavLinkClass } from "@/components/admin/admin-shell-nav-styles";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { GlobalSidebarNav } from "@/lib/admin/global-nav-flags";
import { cn } from "@/lib/utils";

const authClient = createAuthClient();

function AdminNavLinks({
  navFlags,
  className,
  onNavigate,
}: {
  navFlags: GlobalSidebarNav;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const acaraExact = pathname === "/admin/events";
  const anggotaActive =
    pathname === "/admin/anggota" || pathname.startsWith("/admin/anggota/");
  const pengaturanActive =
    pathname === "/admin/pengaturan" ||
    pathname.startsWith("/admin/pengaturan/");

  return (
    <nav
      aria-label="Navigasi admin"
      className={cn("flex flex-col gap-1", className)}
    >
      <Link
        href="/admin?tab=active"
        data-active={pathname === "/admin" ? "" : undefined}
        onClick={onNavigate}
        className={adminShellNavLinkClass(pathname === "/admin")}
      >
        <Home className="size-4 shrink-0 opacity-80" aria-hidden />
        Beranda
      </Link>
      {navFlags.acara ? (
        <Link
          href="/admin/events"
          onClick={onNavigate}
          className={adminShellNavLinkClass(acaraExact)}
        >
          <CalendarDays className="size-4 shrink-0 opacity-80" aria-hidden />
          Acara
        </Link>
      ) : null}
      {navFlags.anggota ? (
        <Link
          href="/admin/anggota"
          onClick={onNavigate}
          className={adminShellNavLinkClass(anggotaActive)}
        >
          <Users className="size-4 shrink-0 opacity-80" aria-hidden />
          Anggota
        </Link>
      ) : null}
      {navFlags.pengaturan ? (
        <Link
          href="/admin/pengaturan"
          onClick={onNavigate}
          className={adminShellNavLinkClass(pengaturanActive)}
        >
          <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
          Pengaturan
        </Link>
      ) : null}
    </nav>
  );
}

function AdminSignOutForm({ onDone }: { onDone?: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-auto w-full justify-center border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      onClick={async () => {
        await authClient.signOut();
        onDone?.();
        window.location.href = "/admin/sign-in";
      }}
    >
      Keluar
    </Button>
  );
}

export function AdminAppShell({
  navFlags,
  userEmail,
  children,
}: {
  navFlags: GlobalSidebarNav;
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      data-admin-shell
      className="flex min-h-[100dvh] w-full flex-col bg-muted/40 lg:flex-row"
    >
      <aside
        aria-label="Menu admin utama"
        className="sticky top-0 z-40 hidden min-h-[100dvh] w-[min(260px,100%)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex"
      >
        <div className="flex flex-1 flex-col gap-6 p-4">
          <div className="space-y-3">
            <AdminBrandMark />
            {userEmail ? (
              <p
                className="truncate px-0.5 text-xs text-sidebar-foreground/70"
                title={userEmail}
              >
                {userEmail}
              </p>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <AdminNavLinks navFlags={navFlags} className="shrink-0" />
            <AdminEventSidebarBlock />
          </div>
          <AdminSignOutForm />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col" data-admin-content>
        <header className="flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="Menu admin"
                />
              }
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(100%,280px)] flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
                <SheetTitle className="text-left text-sidebar-foreground">
                  Menu admin
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4">
                <div className="space-y-1">
                  <AdminBrandMark />
                  {userEmail ? (
                    <p
                      className="truncate text-xs text-sidebar-foreground/70"
                      title={userEmail}
                    >
                      {userEmail}
                    </p>
                  ) : null}
                </div>
                <AdminNavLinks
                  navFlags={navFlags}
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                />
                <div className="mt-auto border-t border-sidebar-border pt-4">
                  <AdminSignOutForm
                    onDone={() => {
                      setMobileOpen(false);
                    }}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-sidebar-foreground/70">PIC</p>
            {userEmail ? (
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userEmail}
              </p>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
