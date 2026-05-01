import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const CLUB_BRANDING_SINGLETON_KEY = "default" as const;

export type PublicClubBrandingVm = {
  clubNameNav: string;
  footerPlainText: string | null;
  logoBlobUrl: string | null;
};

const FALLBACK_NAME = "CISC Nobar";

export const loadPublicClubBranding = cache(
  async (): Promise<PublicClubBrandingVm> => {
    const row = await prisma.clubBranding.findUnique({
      where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
    });

    const defaults = {
      clubNameNav: FALLBACK_NAME,
      footerPlainText: null as string | null,
      logoBlobUrl: null as string | null,
    };

    if (!row) return defaults;

    return {
      clubNameNav:
        row.clubNameNav.trim() === ""
          ? defaults.clubNameNav
          : row.clubNameNav,
      footerPlainText: row.footerPlainText,
      logoBlobUrl: row.logoBlobUrl,
    };
  },
);
