"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  adminManagementMemberCreateSchema,
  adminManagementMemberUpdateSchema,
  deleteManagementMemberSchema,
} from "@/lib/forms/admin-management-member-schema";
import {
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { normalizePublicManagementCode } from "@/lib/management/normalize-public-code";
import { recomputeDirectoryManagementFlagsTx } from "@/lib/management/recompute-directory-sync";

function parseJsonPayload<T>(formData: FormData): T | null {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function masterMemberIdOrNull(
  v: string | null | undefined,
): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function createManagementMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const session = await requireAdminSession();

  const parsed = adminManagementMemberCreateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const publicCode = normalizePublicManagementCode(parsed.data.publicCode);
  const masterMemberId = masterMemberIdOrNull(
    parsed.data.masterMemberId ?? null,
  );

  const whatsappStored =
    parsed.data.whatsapp && parsed.data.whatsapp.trim().length > 0
      ? parsed.data.whatsapp.trim()
      : null;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.managementMember.create({
        data: {
          publicCode,
          fullName: parsed.data.fullName.trim(),
          whatsapp: whatsappStored,
          masterMemberId,
        },
        select: { id: true, masterMemberId: true },
      });
      await recomputeDirectoryManagementFlagsTx(
        tx,
        created.masterMemberId ? [created.masterMemberId] : [],
      );
      return created;
    });

    const ctx = await prisma.adminProfile.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true },
    });
    if (ctx) {
      await appendClubAuditLog(prisma, {
        actorProfileId: ctx.id,
        actorAuthUserId: session.user.id,
        action: CLUB_AUDIT_ACTION.MANAGEMENT_MEMBER_CREATED,
        targetType: "management_member",
        targetId: row.id,
        metadata: { publicCode, fullName: parsed.data.fullName.trim() },
      });
    }

    revalidatePath("/admin/management");
    return ok({ id: row.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError("Kode publik atau tautan anggota sudah dipakai.");
    }
    console.error(e);
    return rootError("Gagal menyimpan pengurus.");
  }
}

export async function updateManagementMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const session = await requireAdminSession();

  const parsed = adminManagementMemberUpdateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const before = await prisma.managementMember.findUnique({
    where: { id: parsed.data.id },
    select: { publicCode: true, masterMemberId: true },
  });
  if (!before) return rootError("Data pengurus tidak ditemukan.");

  const publicCode = normalizePublicManagementCode(parsed.data.publicCode);
  const masterMemberId = masterMemberIdOrNull(
    parsed.data.masterMemberId ?? null,
  );

  const whatsappStored =
    parsed.data.whatsapp && parsed.data.whatsapp.trim().length > 0
      ? parsed.data.whatsapp.trim()
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.managementMember.update({
        where: { id: parsed.data.id },
        data: {
          publicCode,
          fullName: parsed.data.fullName.trim(),
          whatsapp: whatsappStored,
          masterMemberId,
        },
      });
      const seeds = [before.masterMemberId, masterMemberId].filter(
        (x): x is string => Boolean(x),
      );
      await recomputeDirectoryManagementFlagsTx(tx, seeds);
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError("Kode publik atau tautan anggota sudah dipakai.");
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Data pengurus tidak ditemukan.");
    }
    console.error(e);
    return rootError("Gagal memperbarui pengurus.");
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    if (before.publicCode !== publicCode) {
      await appendClubAuditLog(prisma, {
        actorProfileId: ctx.id,
        actorAuthUserId: session.user.id,
        action: CLUB_AUDIT_ACTION.MANAGEMENT_MEMBER_PUBLIC_CODE_CHANGED,
        targetType: "management_member",
        targetId: parsed.data.id,
        metadata: {
          previousPublicCode: before.publicCode,
          nextPublicCode: publicCode,
        },
      });
    } else {
      await appendClubAuditLog(prisma, {
        actorProfileId: ctx.id,
        actorAuthUserId: session.user.id,
        action: CLUB_AUDIT_ACTION.MANAGEMENT_MEMBER_UPDATED,
        targetType: "management_member",
        targetId: parsed.data.id,
        metadata: { publicCode, fullName: parsed.data.fullName.trim() },
      });
    }
  }

  revalidatePath("/admin/management");
  return ok({ id: parsed.data.id });
}

export async function deleteManagementMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const session = await requireAdminSession();

  const parsed = deleteManagementMemberSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const before = await prisma.managementMember.findUnique({
    where: { id: parsed.data.id },
    select: { masterMemberId: true },
  });
  if (!before) return rootError("Data pengurus tidak ditemukan.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.managementMember.delete({ where: { id: parsed.data.id } });
      await recomputeDirectoryManagementFlagsTx(
        tx,
        before.masterMemberId ? [before.masterMemberId] : [],
      );
    });
  } catch (e) {
    console.error(e);
    return rootError("Gagal menghapus pengurus.");
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.MANAGEMENT_MEMBER_UPDATED,
      targetType: "management_member",
      targetId: parsed.data.id,
      metadata: { deleted: true },
    });
  }

  revalidatePath("/admin/management");
  return ok({ deleted: true });
}
