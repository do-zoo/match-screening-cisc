import type { Metadata } from "next";
import Link from "next/link";

import { ClubNotificationPreferencesForm } from "@/components/admin/club-notification-preferences-form";

export const metadata: Metadata = { title: "Notifikasi" };
import { prisma } from "@/lib/db/prisma";
import { CLUB_NOTIFICATION_PREFS_KEY } from "@/lib/public/load-club-notification-preferences";

export default async function NotificationsSettingsPage() {
  const row = await prisma.clubNotificationPreferences.findUnique({
    where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Notifikasi</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Notifikasi</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Preferensi saluran keluar untuk pekerjaan operasional mendatang. Pengiriman
          transaksional oleh Better Auth (mis. tautan magic) tidak diatur di sini.
        </p>
      </div>
      <ClubNotificationPreferencesForm
        initialMode={row?.outboundMode ?? "log_only"}
        initialLabel={row?.outboundLabel ?? ""}
      />
    </div>
  );
}
