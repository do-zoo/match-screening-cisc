import { cache } from 'react'

import type { SerializedEventForRegistration } from '@/components/public/event-serialization'
import { prisma } from '@/lib/db/prisma'
import { mergeGlobalRegistrationClosure } from '@/lib/public/club-operational-policy'
import { loadClubOperationalSettings } from '@/lib/public/load-club-operational-settings'
import { sanitizePublicEventDescriptionHtml } from '@/lib/public/sanitize-event-description'

import {
  countCategoryRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
} from './registration-window'

import { flattenedMenuRowsFromEventVenueLinks } from './flatten-event-venue-menu'

/** Deduped per request — detail, register route, metadata */
export const getActiveEventRegistrationPageData = cache(async (slug: string) =>
  prisma.event.findFirst({
    where: { slug, status: 'active' },
    include: {
      bankAccount: true,
      venue: true,
      eventVenueMenuItems: {
        include: { venueMenuItem: true },
      },
      ticketCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          regularPrice: true,
          memberPrice: true,
          maxQtyPerPerson: true,
          capacity: true,
        },
      },
    },
  }),
)

export const getSerializedEventForPublicRegistration = cache(
  async (slug: string): Promise<SerializedEventForRegistration | null> => {
    const event = await getActiveEventRegistrationPageData(slug)
    if (!event) return null

    let registrationOpen = isRegistrationOpenForEvent({ event })
    let registrationClosedMessage = registrationOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          openRegistrationAt: event.openRegistrationAt,
          closeRegistrationAt: event.closeRegistrationAt,
        })

    const ops = await loadClubOperationalSettings()
    const merged = mergeGlobalRegistrationClosure({
      registrationOpen,
      registrationClosedMessage,
      registrationGloballyDisabled: ops.registrationGloballyDisabled,
      globalRegistrationClosedMessage: ops.globalRegistrationClosedMessage,
    })
    registrationOpen = merged.registrationOpen
    registrationClosedMessage = merged.registrationClosedMessage

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      descriptionHtml: sanitizePublicEventDescriptionHtml(event.description),
      coverBlobUrl: event.coverBlobUrl,
      venueName: event.venue.name,
      venueAddress: event.venue.address,
      venueMapUrl: event.venue.mapUrl ?? null,
      openRegistrationAtIso: event.openRegistrationAt.toISOString(),
      closeRegistrationAtIso: event.closeRegistrationAt.toISOString(),
      openGateAtIso: event.openGateAt.toISOString(),
      kickOffAtIso: event.kickOffAt.toISOString(),
      registrationOpen,
      registrationClosedMessage,
      mandatoryMenuItemIds: [...event.mandatoryMenuItemIds],
      ticketCategories: await Promise.all(
        event.ticketCategories.map(async c => {
          let remainingSlots: number | null = null
          if (c.capacity != null && c.capacity > 0) {
            const count = await countCategoryRegistrationsTowardQuota(prisma, c.id)
            remainingSlots = Math.max(0, c.capacity - count)
          }
          return {
            id: c.id,
            name: c.name,
            regularPrice: c.regularPrice,
            memberPrice: c.memberPrice,
            maxQtyPerPerson: c.maxQtyPerPerson,
            capacity: c.capacity,
            remainingSlots,
          }
        }),
      ),
      menuRequired: event.mandatoryMenuItemIds.length > 0,
      bankAccount: {
        bankName: event.bankAccount.bankName,
        accountNumber: event.bankAccount.accountNumber,
        accountName: event.bankAccount.accountName,
      },
      menuItems: flattenedMenuRowsFromEventVenueLinks(event.eventVenueMenuItems),
      mandatoryMenuItems: flattenedMenuRowsFromEventVenueLinks(event.eventVenueMenuItems).filter(row =>
        event.mandatoryMenuItemIds.includes(row.id),
      ),
      requireAllHolderData: event.requireAllHolderData,
      memberAccessMode: event.memberAccessMode,
    }
  },
)
