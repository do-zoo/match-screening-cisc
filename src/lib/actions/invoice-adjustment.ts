"use server";

import { revalidatePath } from "next/cache";
import { InvoiceAdjustmentType, InvoiceAdjustmentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, fieldError, type ActionResult } from "@/lib/forms/action-result";

const createSchema = z.object({
  registrationId: z.string().min(1),
  type: z.nativeEnum(InvoiceAdjustmentType),
  amount: z.number().int().positive("Jumlah harus lebih dari 0"),
});

export async function createInvoiceAdjustment(
  eventId: string,
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ adjustmentId: string }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string") fe[p] = issue.message;
    }
    return fieldError(fe);
  }

  const reg = await prisma.registration.findUnique({
    where: { id: parsed.data.registrationId },
    select: { eventId: true },
  });
  if (!reg || reg.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }

  const adj = await prisma.invoiceAdjustment.create({
    data: {
      registrationId: parsed.data.registrationId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      status: InvoiceAdjustmentStatus.unpaid,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${parsed.data.registrationId}`);
  return ok({ adjustmentId: adj.id });
}

export async function markAdjustmentPaid(
  eventId: string,
  adjustmentId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  await prisma.invoiceAdjustment.update({
    where: { id: adjustmentId },
    data: { status: InvoiceAdjustmentStatus.paid, paidAt: new Date() },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ ok: true });
}

export async function markAdjustmentUnpaid(
  eventId: string,
  adjustmentId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  await prisma.invoiceAdjustment.update({
    where: { id: adjustmentId },
    data: { status: InvoiceAdjustmentStatus.unpaid, paidAt: null },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ ok: true });
}
