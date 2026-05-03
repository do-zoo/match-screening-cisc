import type { Metadata } from "next";
import Link from "next/link";

import { ClubBrandingSettingsForm } from "@/components/admin/club-branding-settings-form";

export const metadata: Metadata = { title: "Branding" };
import { prisma } from "@/lib/db/prisma";
import { CLUB_BRANDING_SINGLETON_KEY } from "@/lib/public/load-club-branding";

export default async function BrandingSettingsPage() {
  const row = await prisma.clubBranding.findUnique({
    where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Branding</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Branding publik
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Nama singkat untuk header situs pengunjung, teks footer polos opsional, dan logo
          (disimpan sebagai WebP publik sama seperti sampul acara).
        </p>
      </div>
      <ClubBrandingSettingsForm
        initialClubName={row?.clubNameNav?.trim() || "CISC Nobar"}
        initialFooter={row?.footerPlainText ?? ""}
        logoUrl={row?.logoBlobUrl ?? null}
      />
    </div>
  );
}
