import { CalendarDays, MapPin, Users, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Beranda" };

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deriveGlobalSidebarNav } from "@/lib/admin/global-nav-flags";
import { getPendingReviewTotalForAdminContext } from "@/lib/admin/pending-review-total-for-context";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { loadPublicClubBranding } from "@/lib/public/load-club-branding";
import { cn } from "@/lib/utils";

const fmtNum = new Intl.NumberFormat("id-ID");

export default async function AdminHomePage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  const branding = await loadPublicClubBranding();

  if (!ctx) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Beranda</h1>
        <Alert variant="destructive">
          <AlertTitle>Profil admin belum ada</AlertTitle>
          <AlertDescription>
            Akun Anda belum dikaitkan ke AdminProfile. Hubungi Owner untuk
            aktivasi akses PIC.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const nav = deriveGlobalSidebarNav(ctx);
  const pendingTotal = await getPendingReviewTotalForAdminContext(ctx);

  const shortcuts: {
    href: string;
    title: string;
    description: string;
    Icon: typeof Users;
    enabled: boolean;
  }[] = [
    {
      href: "/admin/events?tab=active",
      title: "Acara",
      description: "Inbox, laporan, dan ringkasan pendaftaran per acara.",
      Icon: CalendarDays,
      enabled: true,
    },
    {
      href: "/admin/members",
      title: "Anggota",
      description: "Direktori anggota dan impor CSV.",
      Icon: Users,
      enabled: nav.members,
    },
    {
      href: "/admin/venues",
      title: "Venue",
      description: "Katalog tempat dan menu untuk acara.",
      Icon: MapPin,
      enabled: nav.venues,
    },
    {
      href: "/admin/management",
      title: "Kepengurusan",
      description: "Struktur komite dan periode kepengurusan.",
      Icon: UsersRound,
      enabled: nav.management,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 md:px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Beranda</h1>
        <p className="text-sm text-muted-foreground">
          Pratinjau backoffice{" "}
          <span className="font-medium text-foreground">
            {branding.clubNameNav}
          </span>
          — anggota, acara, venue, dan kepengurusan dalam satu tempat.
        </p>
      </header>

      <Alert className="border-primary/40 bg-muted/40">
        <AlertTitle>Registrasi menunggu tinjauan</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {fmtNum.format(pendingTotal)} registrasi berstatus menunggu tindakan
            di acara yang Anda akses.
          </span>
          <Link
            href="/admin/events?tab=active"
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: "shrink-0",
            })}
          >
            Buka daftar acara
          </Link>
        </AlertDescription>
      </Alert>

      <section aria-labelledby="modul-heading">
        <h2 id="modul-heading" className="sr-only">
          Modul
        </h2>
        <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
          {shortcuts
            .filter((s) => s.enabled)
            .map(({ href, title, description, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block h-full rounded-lg focus-visible:outline-none"
                >
                  <Card
                    className={cn(
                      "h-full transition-colors hover:border-primary/30 hover:bg-muted/30",
                    )}
                  >
                    <CardHeader className="gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-lg leading-snug">
                            {title}
                          </CardTitle>
                          <CardDescription>{description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {nav.settings ? (
        <p className="text-sm text-muted-foreground">
          Pengaturan komite (branding, notifikasi, keamanan) tetap di menu
          samping:{" "}
          <Link
            href="/admin/settings"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Pengaturan
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
