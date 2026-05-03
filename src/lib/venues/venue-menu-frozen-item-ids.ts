import type { PrismaClient } from "@prisma/client";

/** VenueMenuItem ids on any event that already has ≥1 Registration (spec strict freeze). */
export async function venueMenuItemIdsFrozenByExistingRegistrations(
  db: Pick<PrismaClient, "eventVenueMenuItem">,
): Promise<Set<string>> {
  const rows = await db.eventVenueMenuItem.findMany({
    where: {
      event: {
        registrations: { some: {} },
      },
    },
    select: { venueMenuItemId: true },
    distinct: ["venueMenuItemId"],
  });
  return new Set(rows.map((r) => r.venueMenuItemId));
}
