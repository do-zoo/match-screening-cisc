import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const CLUB_OPERATIONAL_SINGLETON_KEY = "default" as const;

export type ClubOperationalVm = {
  registrationGloballyDisabled: boolean;
  globalRegistrationClosedMessage: string | null;
  maintenanceBannerPlainText: string | null;
};

export const loadClubOperationalSettings = cache(
  async (): Promise<ClubOperationalVm> => {
    const row = await prisma.clubOperationalSettings.findUnique({
      where: { singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY },
    });
    return {
      registrationGloballyDisabled: row?.registrationGloballyDisabled ?? false,
      globalRegistrationClosedMessage:
        row?.globalRegistrationClosedMessage ?? null,
      maintenanceBannerPlainText: row?.maintenanceBannerPlainText ?? null,
    };
  },
);
