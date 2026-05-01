import { cache } from "react";

import type { NotificationOutboundMode } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const CLUB_NOTIFICATION_PREFS_KEY = "default" as const;

export type ClubNotificationPrefsVm = {
  outboundMode: NotificationOutboundMode;
  outboundLabel: string;
};

export const loadClubNotificationPreferences =
  cache(async (): Promise<ClubNotificationPrefsVm> => {
    const row = await prisma.clubNotificationPreferences.findUnique({
      where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
    });
    return {
      outboundMode: row?.outboundMode ?? "log_only",
      outboundLabel: row?.outboundLabel ?? "",
    };
  });
