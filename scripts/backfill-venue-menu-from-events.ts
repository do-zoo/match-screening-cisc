/**
 * Run after M1 migration is applied and BEFORE M2 contract migration.
 * Expects a generated Prisma client matching **schema M1** (Event still has `venueName` /
 * `venueAddress`; `EventMenuItem` exists). This file is excluded from root `tsc` and ESLint
 * because the post-M2 client no longer type-checks it — keep it as a one-off operator script.
 *
 * Creates one Venue per Event, VenueMenuItem from EventMenuItem, EventVenueMenuItem,
 * sets Event.venueId, remaps TicketMenuSelection + Ticket voucher FK row values to new VenueMenuItem ids.
 *
 * Usage (Node 24): pnpm exec tsx scripts/backfill-venue-menu-from-events.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      venueName: true,
      venueAddress: true,
    },
  });

  for (const e of events) {
    const venue = await prisma.venue.create({
      data: {
        name: e.venueName,
        address: e.venueAddress,
      },
    });

    await prisma.event.update({
      where: { id: e.id },
      data: { venueId: venue.id },
    });

    const oldItems = await prisma.eventMenuItem.findMany({
      where: { eventId: e.id },
      orderBy: { sortOrder: "asc" },
    });

    const idMap = new Map<string, string>();

    for (const o of oldItems) {
      const created = await prisma.venueMenuItem.create({
        data: {
          venueId: venue.id,
          name: o.name,
          price: o.price,
          sortOrder: o.sortOrder,
          voucherEligible: o.voucherEligible,
        },
      });
      idMap.set(o.id, created.id);
      await prisma.eventVenueMenuItem.create({
        data: {
          eventId: e.id,
          venueMenuItemId: created.id,
          sortOrder: o.sortOrder,
        },
      });
    }

    for (const [oldId, newId] of idMap) {
      await prisma.ticketMenuSelection.updateMany({
        where: { menuItemId: oldId },
        data: { menuItemId: newId },
      });
      await prisma.ticket.updateMany({
        where: { voucherRedeemedMenuItemId: oldId },
        data: { voucherRedeemedMenuItemId: newId },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
