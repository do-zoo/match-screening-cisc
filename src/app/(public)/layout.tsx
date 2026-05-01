import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { effectiveMaintenanceBanner } from "@/lib/public/club-operational-policy";
import { loadPublicClubBranding } from "@/lib/public/load-club-branding";
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";
import type { ReactNode } from "react";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [branding, ops] = await Promise.all([
    loadPublicClubBranding(),
    loadClubOperationalSettings(),
  ]);
  const bannerText = effectiveMaintenanceBanner(ops.maintenanceBannerPlainText);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader
        clubNameNav={branding.clubNameNav}
        logoUrl={branding.logoBlobUrl}
      />
      {bannerText ? (
        <div className="border-b bg-muted/50 px-4 py-3">
          <Alert>
            <AlertTitle>Pemberitahuan</AlertTitle>
            <AlertDescription>{bannerText}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicFooter footerPlainText={branding.footerPlainText} />
    </div>
  );
}
