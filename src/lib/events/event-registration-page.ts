import { cache } from "react";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { prisma } from "@/lib/db/prisma";
import { mergeGlobalRegistrationClosure } from "@/lib/public/club-operational-policy";
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";
import { sanitizePublicEventDescriptionHtml } from "@/lib/public/sanitize-event-description";

import {
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
} from "./registration-window";

import { flattenedMenuRowsFromEventVenueLinks } from "./flatten-event-venue-menu";

/** Deduped per request — detail, register route, metadata */
export const getActiveEventRegistrationPageData = cache(async (slug: string) =>
  prisma.event.findFirst({
    where: { slug, status: "active" },
    include: {
      bankAccount: true,
      venue: true,
      eventVenueMenuItems: {
        include: { venueMenuItem: true },
      },
    },
  }),
);

export const getSerializedEventForPublicRegistration = cache(
  async (slug: string): Promise<SerializedEventForRegistration | null> => {
    const event = await getActiveEventRegistrationPageData(slug);
    if (!event) return null;

    const registrationsTowardQuota = await countRegistrationsTowardQuota(
      prisma,
      event.id,
    );
    let registrationOpen = isRegistrationOpenForEvent({
      event,
      registrationsTowardQuota,
    });
    let registrationClosedMessage = registrationOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          registrationCapacity: event.registrationCapacity,
          registrationsTowardQuota,
        });

    const ops = await loadClubOperationalSettings();
    const merged = mergeGlobalRegistrationClosure({
      registrationOpen,
      registrationClosedMessage,
      registrationGloballyDisabled: ops.registrationGloballyDisabled,
      globalRegistrationClosedMessage: ops.globalRegistrationClosedMessage,
    });
    registrationOpen = merged.registrationOpen;
    registrationClosedMessage = merged.registrationClosedMessage;

    return {
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      descriptionHtml: sanitizePublicEventDescriptionHtml(event.description),
      coverBlobUrl: event.coverBlobUrl,
      venueName: event.venue.name,
      startAtIso: event.startAt.toISOString(),
      endAtIso: event.endAt.toISOString(),
      registrationOpen,
      registrationClosedMessage,
      menuMode: event.menuMode,
      menuSelection: event.menuSelection,
      voucherPrice: event.voucherPrice,
      ticketMemberPrice: event.ticketMemberPrice,
      ticketNonMemberPrice: event.ticketNonMemberPrice,
      bankAccount: {
        bankName: event.bankAccount.bankName,
        accountNumber: event.bankAccount.accountNumber,
        accountName: event.bankAccount.accountName,
      },
      menuItems: flattenedMenuRowsFromEventVenueLinks(event.eventVenueMenuItems),
    };
  },
);
