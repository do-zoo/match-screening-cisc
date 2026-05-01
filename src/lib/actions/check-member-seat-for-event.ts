"use server";

import { prisma } from "@/lib/db/prisma";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";

/**
 * Untuk formulir publik: cek tiket utama yang membawa `memberNumber` kanonis
 * untuk event aktif (slug). Tidak mengembalikan data registrasi apa pun selain fakta blokir.
 */
export async function primaryMemberSeatTakenForActiveEventSlug(
  eventSlug: string,
  canonicalMemberNumber: string,
): Promise<boolean> {
  const slug = eventSlug.trim();
  const member = canonicalMemberNumber.trim();
  if (!slug || !member) return false;

  const event = await prisma.event.findFirst({
    where: { slug, status: "active" },
    select: { id: true },
  });
  if (!event) return false;

  const dup = await findDuplicateMemberNumbers(event.id, [member]);
  return dup.length > 0;
}
