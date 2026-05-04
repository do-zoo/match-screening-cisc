"use server";

import { revalidatePath } from "next/cache";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  targetPicBankOwnerSchema,
  createPicBankAccountSchema,
  updatePicBankAccountSchema,
} from "@/lib/forms/pic-bank-account-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import type { AdminRole } from "@/lib/permissions/roles";
import { canMutatePicBankForTarget } from "@/lib/admin/pic-bank-account-permissions";

async function requirePicBankMutationContext(ownerAdminProfileId: string): Promise<
  ActionResult<never> | {
    viewerProfileId: string;
    role: AdminRole;
    authUserId: string;
  }
> {
  try {
    const session = await requireAdminSession();
    const ctx = await getAdminContext(session.user.id);
    if (!ctx) return rootError("Tidak diizinkan.");
    if (
      !canMutatePicBankForTarget(ctx.role, ctx.profileId, ownerAdminProfileId)
    ) {
      return rootError("Tidak diizinkan.");
    }
    return {
      viewerProfileId: ctx.profileId,
      role: ctx.role,
      authUserId: session.user.id,
    };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}

export async function createPicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createPicBankAccountSchema.safeParse({
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const row = await prisma.picBankAccount.create({
    data: {
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
      isActive: true,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_CREATED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: { ownerAdminProfileId: parsed.data.ownerAdminProfileId },
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events");
  return ok({ id: row.id });
}

export async function updatePicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = updatePicBankAccountSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const existing = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!existing) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.update({
    where: { id: parsed.data.bankAccountId },
    data: {
      bankName: parsed.data.bankName,
      accountNumber: parsed.data.accountNumber,
      accountName: parsed.data.accountName,
    },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_UPDATED,
    targetType: "pic_bank_account",
    targetId: parsed.data.bankAccountId,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events");
  return ok({ saved: true });
}

export async function deactivatePicBankAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const parsed = targetPicBankOwnerSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const row = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!row) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.update({
    where: { id: row.id },
    data: { isActive: false },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_DEACTIVATED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events");
  return ok({ saved: true });
}

export async function deletePicBankAccountPermanent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const parsed = targetPicBankOwnerSchema.safeParse({
    bankAccountId: formData.get("bankAccountId"),
    ownerAdminProfileId: formData.get("ownerAdminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const gate = await requirePicBankMutationContext(parsed.data.ownerAdminProfileId);
  if (!("viewerProfileId" in gate)) return gate;

  const used = await prisma.event.count({
    where: { bankAccountId: parsed.data.bankAccountId },
  });
  if (used > 0) {
    return rootError(
      "Rekening masih dipakai oleh satu atau lebih acara. Ganti rekening di acara tersebut atau nonaktifkan saja.",
    );
  }

  const row = await prisma.picBankAccount.findFirst({
    where: {
      id: parsed.data.bankAccountId,
      ownerAdminProfileId: parsed.data.ownerAdminProfileId,
    },
    select: { id: true },
  });
  if (!row) return rootError("Rekening tidak ditemukan.");

  await prisma.picBankAccount.delete({ where: { id: row.id } });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.viewerProfileId,
    actorAuthUserId: gate.authUserId,
    action: CLUB_AUDIT_ACTION.PIC_BANK_DELETED,
    targetType: "pic_bank_account",
    targetId: row.id,
    metadata: {},
  });

  revalidatePath("/admin/settings/committee");
  revalidatePath("/admin/events");
  return ok({ deleted: true });
}
