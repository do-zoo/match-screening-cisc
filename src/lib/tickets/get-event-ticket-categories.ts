import { prisma } from "@/lib/db/prisma";

export type EventTicketCategoryRow = {
  id: string;
  name: string;
  regularPrice: number;
  memberPrice: number;
  maxQtyPerPerson: number | null;
  sortOrder: number;
  isActive: boolean;
  registrationCount: number;
};

export async function getEventTicketCategories(
  eventId: string,
): Promise<EventTicketCategoryRow[]> {
  const rows = await prisma.eventTicketCategory.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      memberPrice: true,
      maxQtyPerPerson: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { registrations: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    regularPrice: r.regularPrice,
    memberPrice: r.memberPrice,
    maxQtyPerPerson: r.maxQtyPerPerson,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    registrationCount: r._count.registrations,
  }));
}

/** Active categories only — for the public registration form. */
export async function getActiveEventTicketCategories(
  eventId: string,
): Promise<Omit<EventTicketCategoryRow, "registrationCount">[]> {
  const rows = await prisma.eventTicketCategory.findMany({
    where: { eventId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      memberPrice: true,
      maxQtyPerPerson: true,
      sortOrder: true,
      isActive: true,
    },
  });
  return rows;
}
