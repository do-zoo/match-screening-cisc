"use server";

import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

const CANCEL_BLOCKED_FROM: RegistrationStatus[] = [
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
];

const REFUND_ALLOWED_FROM: RegistrationStatus[] = [
  RegistrationStatus.approved,
  RegistrationStatus.cancelled,
];

export async function cancelRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  });

  if (!existing || existing.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }
  if (CANCEL_BLOCKED_FROM.includes(existing.status)) {
    return rootError(`Tidak dapat membatalkan pendaftaran dengan status "${existing.status}".`);
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.cancelled },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function refundRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  });

  if (!existing || existing.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }
  if (!REFUND_ALLOWED_FROM.includes(existing.status)) {
    return rootError(`Refund hanya untuk pendaftaran dengan status "approved" atau "cancelled".`);
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.refunded },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
