import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { loadPublicClubBranding } from "@/lib/public/load-club-branding";
import type { ReactNode } from "react";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const branding = await loadPublicClubBranding();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader
        clubNameNav={branding.clubNameNav}
        logoUrl={branding.logoBlobUrl}
      />
      <div className="flex flex-1 flex-col">{children}</div>
      <PublicFooter footerPlainText={branding.footerPlainText} />
    </div>
  );
}
