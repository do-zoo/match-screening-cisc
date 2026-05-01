import { cache } from "react";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";
import { prisma } from "@/lib/db/prisma";
import { sanitizePublicEventDescriptionHtml } from "@/lib/public/sanitize-event-description";

import {
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
} from "./registration-window";

/** Deduped per request — detail, register route, metadata */
export const getActiveEventRegistrationPageData = cache(async (slug: string) =>
  prisma.event.findFirst({
    where: { slug, status: "active" },
    include: {
      bankAccount: true,
      menuItems: { orderBy: { sortOrder: "asc" } },
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
    const registrationOpen = isRegistrationOpenForEvent({
      event,
      registrationsTowardQuota,
    });
    const registrationClosedMessage = registrationOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          registrationCapacity: event.registrationCapacity,
          registrationsTowardQuota,
        });

    return {
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      descriptionHtml: sanitizePublicEventDescriptionHtml(event.description),
      coverBlobUrl: event.coverBlobUrl,
      venueName: event.venueName,
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
      menuItems: event.menuItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        voucherEligible: m.voucherEligible,
      })),
    };
  },
);
