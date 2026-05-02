"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { requireAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  adminBoardPeriodCreateSchema,
  adminBoardPeriodUpdateSchema,
  deleteBoardPeriodSchema,
} from "@/lib/forms/admin-board-period-schema";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { periodsOverlap } from "@/lib/management/active-period";
import { recomputeAllLinkedDirectoryFlagsTx } from "@/lib/management/recompute-directory-sync";

function parseJsonPayload<T>(formData: FormData): T | null {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function overlapExists(
  candidate: { startsAt: Date; endsAt: Date },
  excludeId?: string,
): Promise<boolean> {
  const rows = await prisma.boardPeriod.findMany({
    select: { id: true, startsAt: true, endsAt: true },
  });
  return rows.some(
    (row) =>
      row.id !== excludeId &&
      periodsOverlap(candidate, row),
  );
}

export async function createBoardPeriod(
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

  const parsed = adminBoardPeriodCreateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  if (await overlapExists(parsed.data)) {
    return rootError("Rentang periode bertabrakan dengan periode lain.");
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.boardPeriod.create({
        data: {
          label: parsed.data.label,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
        },
        select: { id: true },
      });
      await recomputeAllLinkedDirectoryFlagsTx(tx);
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
        action: CLUB_AUDIT_ACTION.BOARD_PERIOD_CREATED,
        targetType: "board_period",
        targetId: row.id,
        metadata: { label: parsed.data.label },
      });
    }

    revalidatePath("/admin/management");
    return ok({ id: row.id });
  } catch (e) {
    console.error(e);
    return rootError("Gagal menyimpan periode.");
  }
}

export async function updateBoardPeriod(
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

  const parsed = adminBoardPeriodUpdateSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  if (
    await overlapExists(
      {
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
      },
      parsed.data.id,
    )
  ) {
    return rootError("Rentang periode bertabrakan dengan periode lain.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.boardPeriod.update({
        where: { id: parsed.data.id },
        data: {
          label: parsed.data.label,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
        },
      });
      await recomputeAllLinkedDirectoryFlagsTx(tx);
    });

    const ctx = await prisma.adminProfile.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true },
    });
    if (ctx) {
      await appendClubAuditLog(prisma, {
        actorProfileId: ctx.id,
        actorAuthUserId: session.user.id,
        action: CLUB_AUDIT_ACTION.BOARD_PERIOD_UPDATED,
        targetType: "board_period",
        targetId: parsed.data.id,
        metadata: { label: parsed.data.label },
      });
    }

    revalidatePath("/admin/management");
    return ok({ id: parsed.data.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Periode tidak ditemukan.");
    }
    console.error(e);
    return rootError("Gagal memperbarui periode.");
  }
}

export async function deleteBoardPeriod(
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

  const parsed = deleteBoardPeriodSchema.safeParse(
    parseJsonPayload(formData),
  );
  if (!parsed.success)
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.boardPeriod.delete({ where: { id: parsed.data.id } });
      await recomputeAllLinkedDirectoryFlagsTx(tx);
    });

    const ctx = await prisma.adminProfile.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true },
    });
    if (ctx) {
      await appendClubAuditLog(prisma, {
        actorProfileId: ctx.id,
        actorAuthUserId: session.user.id,
        action: CLUB_AUDIT_ACTION.BOARD_PERIOD_UPDATED,
        targetType: "board_period",
        targetId: parsed.data.id,
        metadata: { deleted: true },
      });
    }

    revalidatePath("/admin/management");
    return ok({ deleted: true });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return rootError("Periode tidak ditemukan.");
    }
    console.error(e);
    return rootError("Gagal menghapus periode.");
  }
}
