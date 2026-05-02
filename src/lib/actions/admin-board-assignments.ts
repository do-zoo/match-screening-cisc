"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  adminBoardAssignmentUpdateSchema,
  adminBoardAssignmentUpsertSchema,
  deleteBoardAssignmentSchema,
} from "@/lib/forms/admin-board-assignment-schema";
import {
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
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

async function seedIdsFromManagementMemberIds(
  tx: Prisma.TransactionClient,
  ids: string[],
): Promise<string[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const rows = await tx.managementMember.findMany({
    where: { id: { in: unique } },
    select: { masterMemberId: true },
  });
  return rows
    .map((r) => r.masterMemberId)
    .filter((id): id is string => id !== null);
}

export async function createBoardAssignment(
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

  const parsed = adminBoardAssignmentUpsertSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const role = await prisma.boardRole.findUnique({
    where: { id: parsed.data.boardRoleId },
    select: { isActive: true },
  });
  if (!role?.isActive) {
    return rootError("Jabatan tidak aktif atau tidak ditemukan.");
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.boardAssignment.create({
        data: {
          boardPeriodId: parsed.data.boardPeriodId,
          managementMemberId: parsed.data.managementMemberId,
          boardRoleId: parsed.data.boardRoleId,
        },
        select: { id: true },
      });
      const seeds = await seedIdsFromManagementMemberIds(tx, [
        parsed.data.managementMemberId,
      ]);
      await recomputeDirectoryManagementFlagsTx(tx, seeds);
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
        action: CLUB_AUDIT_ACTION.BOARD_ASSIGNMENT_CREATED,
        targetType: "board_assignment",
        targetId: row.id,
        metadata: {
          boardPeriodId: parsed.data.boardPeriodId,
          managementMemberId: parsed.data.managementMemberId,
          boardRoleId: parsed.data.boardRoleId,
        },
      });
    }

    revalidatePath("/admin/management");
    return ok({ id: row.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError(
        "Penugasan bentrok: satu orang atau satu jabatan sudah terisi untuk periode ini.",
      );
    }
    console.error(e);
    return rootError("Gagal menyimpan penugasan.");
  }
}

export async function updateBoardAssignment(
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

  const parsed = adminBoardAssignmentUpdateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const before = await prisma.boardAssignment.findUnique({
    where: { id: parsed.data.id },
    select: { managementMemberId: true },
  });
  if (!before) return rootError("Penugasan tidak ditemukan.");

  const role = await prisma.boardRole.findUnique({
    where: { id: parsed.data.boardRoleId },
    select: { isActive: true },
  });
  if (!role?.isActive) {
    return rootError("Jabatan tidak aktif atau tidak ditemukan.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.boardAssignment.update({
        where: { id: parsed.data.id },
        data: {
          boardPeriodId: parsed.data.boardPeriodId,
          managementMemberId: parsed.data.managementMemberId,
          boardRoleId: parsed.data.boardRoleId,
        },
      });
      const seeds = await seedIdsFromManagementMemberIds(tx, [
        before.managementMemberId,
        parsed.data.managementMemberId,
      ]);
      await recomputeDirectoryManagementFlagsTx(tx, seeds);
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError(
        "Penugasan bentrok: satu orang atau satu jabatan sudah terisi untuk periode ini.",
      );
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Penugasan tidak ditemukan.");
    }
    console.error(e);
    return rootError("Gagal memperbarui penugasan.");
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.BOARD_ASSIGNMENT_UPDATED,
      targetType: "board_assignment",
      targetId: parsed.data.id,
      metadata: {
        boardPeriodId: parsed.data.boardPeriodId,
        managementMemberId: parsed.data.managementMemberId,
        boardRoleId: parsed.data.boardRoleId,
      },
    });
  }

  revalidatePath("/admin/management");
  return ok({ id: parsed.data.id });
}

export async function deleteBoardAssignment(
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

  const parsed = deleteBoardAssignmentSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const before = await prisma.boardAssignment.findUnique({
    where: { id: parsed.data.id },
    select: { managementMemberId: true },
  });
  if (!before) return rootError("Penugasan tidak ditemukan.");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.boardAssignment.delete({ where: { id: parsed.data.id } });
      const seeds = await seedIdsFromManagementMemberIds(tx, [
        before.managementMemberId,
      ]);
      await recomputeDirectoryManagementFlagsTx(tx, seeds);
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Penugasan tidak ditemukan.");
    }
    console.error(e);
    return rootError("Gagal menghapus penugasan.");
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.BOARD_ASSIGNMENT_REMOVED,
      targetType: "board_assignment",
      targetId: parsed.data.id,
      metadata: {
        managementMemberId: before.managementMemberId,
      },
    });
  }

  revalidatePath("/admin/management");
  return ok({ deleted: true });
}
