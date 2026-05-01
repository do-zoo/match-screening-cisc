"use server";

import { revalidatePath } from "next/cache";
import { AttendanceStatus, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function setAttendance(
  eventId: string,
  registrationId: string,
  attendanceStatus: AttendanceStatus,
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
  if (existing.status !== RegistrationStatus.approved) {
    return rootError("Kehadiran hanya dapat dicatat untuk pendaftaran yang sudah disetujui.");
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { attendanceStatus },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
