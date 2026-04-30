"use server";

import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

async function guard(eventId: string) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (!canVerifyEvent(ctx, eventId)) throw new Error("FORBIDDEN");
}

export async function approveRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const r = await prisma.registration.findFirst({
    where: { id: registrationId, eventId },
  });
  if (!r) return rootError("Pendaftaran tidak ditemukan.");

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.approved,
      rejectionReason: null,
      paymentIssueReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function rejectRegistration(
  eventId: string,
  registrationId: string,
  reason: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const trimmed = reason.trim();
  if (!trimmed) return rootError("Alasan penolakan wajib diisi.");

  await prisma.registration.update({
    where: { id: registrationId, eventId },
    data: {
      status: RegistrationStatus.rejected,
      rejectionReason: trimmed,
      paymentIssueReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function markPaymentIssue(
  eventId: string,
  registrationId: string,
  reason: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const trimmed = reason.trim();
  if (!trimmed) return rootError("Alasan masalah pembayaran wajib diisi.");

  await prisma.registration.update({
    where: { id: registrationId, eventId },
    data: {
      status: RegistrationStatus.payment_issue,
      paymentIssueReason: trimmed,
      rejectionReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
