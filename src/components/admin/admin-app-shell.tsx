"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const authClient = createAuthClient();

function AdminNavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi admin"
      className={cn("flex flex-col gap-1", className)}
    >
      <Link
        href="/admin?tab=active"
        data-active={pathname === "/admin" ? "" : undefined}
        onClick={onNavigate}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium hover:bg-muted",
          pathname === "/admin" && "bg-muted text-foreground",
        )}
      >
        Beranda
      </Link>
    </nav>
  );
}

function AdminSignOutForm({ onDone }: { onDone?: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="mt-auto w-full justify-center"
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
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-muted/40 lg:flex-row">
      <aside
        aria-label="Menu admin utama"
        className="sticky top-0 z-40 hidden min-h-[100dvh] w-[220px] shrink-0 flex-col border-r bg-card lg:flex lg:sticky"
      >
        <div className="flex flex-1 flex-col gap-6 p-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              CISC Admin
            </p>
            {userEmail ? (
              <p className="truncate text-xs text-muted-foreground" title={userEmail}>
                {userEmail}
              </p>
            ) : null}
          </div>
          <AdminNavLinks className="flex-1" />
          <AdminSignOutForm />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Menu admin"
                />
              }
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[min(100%,280px)] flex-col"
            >
              <SheetHeader>
                <SheetTitle className="text-left">Menu admin</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
                <AdminNavLinks
                  onNavigate={() => {
                    setMobileOpen(false);
                  }}
                />
                <div className="mt-auto border-t pt-4">
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
            <p className="truncate text-xs text-muted-foreground">PIC</p>
            {userEmail ? (
              <p className="truncate text-sm font-medium">{userEmail}</p>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
