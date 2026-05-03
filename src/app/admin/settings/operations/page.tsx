import type { Metadata } from "next";
import Link from "next/link";

import { ClubOperationalSettingsForm } from "@/components/admin/club-operational-settings-form";

export const metadata: Metadata = { title: "Operasional" };
import { prisma } from "@/lib/db/prisma";
import { CLUB_OPERATIONAL_SINGLETON_KEY } from "@/lib/public/load-club-operational-settings";

export default async function OperationsSettingsPage() {
  const row = await prisma.clubOperationalSettings.findUnique({
    where: { singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Operasional</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Operasional</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Penutupan pendaftaran di seluruh situs pengunjung dan banner teks untuk
          pengumuman singkat (misalnya pemeliharaan).
        </p>
      </div>
      <ClubOperationalSettingsForm
        initialRegistrationGloballyDisabled={
          row?.registrationGloballyDisabled ?? false
        }
        initialGlobalRegistrationClosedMessage={
          row?.globalRegistrationClosedMessage ?? ""
        }
        initialMaintenanceBannerPlainText={
          row?.maintenanceBannerPlainText ?? ""
        }
      />
    </div>
  );
}
