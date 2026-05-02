"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  adminBoardRoleCreateSchema,
  adminBoardRoleUpdateSchema,
  deleteBoardRoleSchema,
} from "@/lib/forms/admin-board-role-schema";
import {
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";

function parseJsonPayload<T>(formData: FormData): T | null {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function createBoardRole(
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

  const parsed = adminBoardRoleCreateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const row = await prisma.boardRole.create({
    data: {
      title: parsed.data.title,
      sortOrder: parsed.data.sortOrder,
    },
    select: { id: true },
  });

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.BOARD_ROLE_CREATED,
      targetType: "board_role",
      targetId: row.id,
      metadata: { title: parsed.data.title },
    });
  }

  revalidatePath("/admin/management");
  return ok({ id: row.id });
}

export async function updateBoardRole(
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

  const parsed = adminBoardRoleUpdateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  try {
    await prisma.boardRole.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        sortOrder: parsed.data.sortOrder,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Jabatan tidak ditemukan.");
    }
    throw e;
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.BOARD_ROLE_UPDATED,
      targetType: "board_role",
      targetId: parsed.data.id,
      metadata: { title: parsed.data.title },
    });
  }

  revalidatePath("/admin/management");
  return ok({ id: parsed.data.id });
}

export async function deactivateBoardRole(
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

  const parsed = deleteBoardRoleSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  const assignCount = await prisma.boardAssignment.count({
    where: { boardRoleId: parsed.data.id },
  });
  if (assignCount > 0) {
    return rootError(
      `Jabatan masih dipakai di ${assignCount} penugasan. Hapus atau pindahkan penugasan terlebih dahulu.`,
    );
  }

  try {
    await prisma.boardRole.update({
      where: { id: parsed.data.id },
      data: { isActive: false },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Jabatan tidak ditemukan.");
    }
    throw e;
  }

  const ctx = await prisma.adminProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { id: true },
  });
  if (ctx) {
    await appendClubAuditLog(prisma, {
      actorProfileId: ctx.id,
      actorAuthUserId: session.user.id,
      action: CLUB_AUDIT_ACTION.BOARD_ROLE_DEACTIVATED,
      targetType: "board_role",
      targetId: parsed.data.id,
      metadata: {},
    });
  }

  revalidatePath("/admin/management");
  return ok({ id: parsed.data.id });
}
