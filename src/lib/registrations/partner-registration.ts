import { TicketRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

/** Baris `Registration` utama untuk pendaftaran ini (diri sendiri jika sudah primary). */
export async function getPrimaryRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { primaryRegistration: true },
  });
  if (!reg) return null;
  if (reg.primaryRegistrationId && reg.primaryRegistration) {
    return reg.primaryRegistration;
  }
  return reg;
}

/** Semua tiket partner milik pembeli utama `primaryId`. */
export async function getPartnerRegistrationsForPrimary(primaryId: string) {
  return prisma.registration.findMany({
    where: { primaryRegistrationId: primaryId },
    orderBy: { createdAt: "asc" },
  });
}

/** Alias nama dari dokumen rencana (`getPartnerRegistrations`). */
export const getPartnerRegistrations = getPartnerRegistrationsForPrimary;

/**
 * Pembeli utama + daftar partner pada grup yang sama.
 */
export async function getRegistrationPair(registrationId: string) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      primaryRegistration: {
        include: {
          partnerRegistrations: { orderBy: { createdAt: "asc" } },
        },
      },
      partnerRegistrations: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!reg) return null;

  if (reg.ticketRole === TicketRole.primary) {
    return {
      primary: reg,
      partners: reg.partnerRegistrations,
    };
  }

  const primary = reg.primaryRegistration;
  if (!primary) return null;

  return {
    primary,
    partners: primary.partnerRegistrations,
  };
}
