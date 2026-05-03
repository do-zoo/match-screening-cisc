"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  MapPin,
  MenuIcon,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";

import { AdminAccountMenu } from "@/components/admin/admin-account-menu";
import { AdminBrandMark } from "@/components/admin/admin-brand-mark";
import { AdminEventSidebarBlock } from "@/components/admin/admin-event-sidebar-block";
import {
  adminShellNavIconClass,
  adminShellNavLinkClass,
} from "@/components/admin/admin-shell-nav-styles";
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
  const venuesActive =
    pathname === "/admin/venues" || pathname.startsWith("/admin/venues/");
  const membersActive =
    pathname === "/admin/members" || pathname.startsWith("/admin/members/");
  const managementActive =
    pathname === "/admin/management" ||
    pathname.startsWith("/admin/management/");
  const settingsActive =
    pathname === "/admin/settings" ||
    pathname.startsWith("/admin/settings/");

  return (
    <nav
      aria-label="Navigasi admin"
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Link
        href="/admin?tab=active"
        data-active={pathname === "/admin" ? "" : undefined}
        onClick={onNavigate}
        className={adminShellNavLinkClass(pathname === "/admin")}
      >
        <Home className={adminShellNavIconClass(pathname === "/admin")} aria-hidden />
        Beranda
      </Link>
      {navFlags.acara ? (
        <Link
          href="/admin/events"
          onClick={onNavigate}
          className={adminShellNavLinkClass(acaraExact)}
        >
          <CalendarDays
            className={adminShellNavIconClass(acaraExact)}
            aria-hidden
          />
          Acara
        </Link>
      ) : null}
      {navFlags.venues ? (
        <Link
          href="/admin/venues"
          onClick={onNavigate}
          className={adminShellNavLinkClass(venuesActive)}
        >
          <MapPin className={adminShellNavIconClass(venuesActive)} aria-hidden />
          Venue
        </Link>
      ) : null}
      {navFlags.members ? (
        <Link
          href="/admin/members"
          onClick={onNavigate}
          className={adminShellNavLinkClass(membersActive)}
        >
          <Users className={adminShellNavIconClass(membersActive)} aria-hidden />
          Anggota
        </Link>
      ) : null}
      {navFlags.management ? (
        <Link
          href="/admin/management"
          onClick={onNavigate}
          className={adminShellNavLinkClass(managementActive)}
        >
          <UsersRound
            className={adminShellNavIconClass(managementActive)}
            aria-hidden
          />
          Kepengurusan
        </Link>
      ) : null}
      {navFlags.settings ? (
        <Link
          href="/admin/settings"
          onClick={onNavigate}
          className={adminShellNavLinkClass(settingsActive)}
        >
          <Settings
            className={adminShellNavIconClass(settingsActive)}
            aria-hidden
          />
          Pengaturan
        </Link>
      ) : null}
    </nav>
  );
}

export function AdminAppShell({
  navFlags,
  userEmail,
  displayName,
  children,
}: {
  navFlags: GlobalSidebarNav;
  userEmail: string | null;
  displayName: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      data-admin-shell
      className="flex min-h-[100dvh] w-full flex-col bg-muted/40 lg:flex-row lg:items-start"
    >
      <aside
        aria-label="Menu admin utama"
        className="sticky top-0 z-40 hidden w-[min(238px,100%)] shrink-0 border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-[inset_-1px_0_0_0_var(--sidebar-border)] lg:flex lg:max-h-[100dvh] lg:min-h-[100dvh] lg:flex-col lg:overflow-hidden lg:self-start"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col px-3 pt-5 pb-4">
          <div className="shrink-0">
            <AdminBrandMark />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-6">
            <div className="flex flex-col gap-2">
              <AdminNavLinks navFlags={navFlags} className="shrink-0" />
              <AdminEventSidebarBlock />
            </div>
          </div>
          <div className="shrink-0 border-t border-sidebar-border/60 pt-4">
            <AdminAccountMenu
              userEmail={userEmail}
              displayName={displayName}
              variant="sidebar"
            />
          </div>
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
                </div>
                <AdminNavLinks
                  navFlags={navFlags}
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-xs text-sidebar-foreground/70">PIC</p>
            <AdminAccountMenu userEmail={userEmail} displayName={displayName} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
