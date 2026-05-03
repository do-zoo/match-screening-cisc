"use server";

import { revalidatePath } from "next/cache";

import {
  formatAdminProfileDeleteBlockedMessage,
  loadAdminProfileDeletionBlockers,
} from "@/lib/admin/admin-profile-delete-guard";
import { roleChangePreservesAtLeastOneOwner } from "@/lib/admin/committee-owner-invariants";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  deleteCommitteeAdminSchema,
  revokeCommitteeAdminAccessSchema,
  updateCommitteeAdminMemberLinkSchema,
  updateCommitteeAdminRoleSchema,
} from "@/lib/forms/committee-admin-profiles-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { AdminRole, Prisma } from "@prisma/client";

async function requireOwner(): Promise<
  ActionResult<never> | { owner: OwnerGuardContext }
> {
  try {
    const owner = await guardOwner();
    return { owner };
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
}

async function listOwnerAuthUserIds(): Promise<string[]> {
  const owners = await prisma.adminProfile.findMany({
    where: { role: AdminRole.Owner },
    select: { authUserId: true },
  });
  return owners.map((o) => o.authUserId);
}

export async function updateCommitteeAdminRole(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = updateCommitteeAdminRoleSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: parsed.data.role,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Tambahkan Owner lain sebelum mengubah peran ini.",
    );
  }

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_ROLE_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      fromRole: target.role,
      toRole: parsed.data.role,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}

export async function updateCommitteeAdminMemberLink(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = updateCommitteeAdminMemberLinkSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
    managementMemberId: formData.get("managementMemberId") ?? "",
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, managementMemberId: true },
  });
  if (!target) return rootError("Profil admin tidak ditemukan.");

  let nextManagementMemberId: string | null =
    parsed.data.managementMemberId;
  if (nextManagementMemberId) {
    const member = await prisma.managementMember.findUnique({
      where: { id: nextManagementMemberId },
      select: { id: true },
    });
    if (!member) return rootError("Pengurus yang dipilih tidak ditemukan.");
  } else {
    nextManagementMemberId = null;
  }

  const prevManagementMemberId = target.managementMemberId;

  try {
    await prisma.adminProfile.update({
      where: { id: target.id },
      data: { managementMemberId: nextManagementMemberId },
    });
  } catch (e) {
    // P2002 = unique constraint: another admin already linked to this ManagementMember
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return rootError("Pengurus ini sudah dikaitkan ke akun admin lain.");
    }
    throw e;
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_MEMBER_LINK_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      prevManagementMemberId,
      nextManagementMemberId,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}

export async function revokeCommitteeAdminMeaningfulAccess(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = revokeCommitteeAdminAccessSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: AdminRole.Viewer,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Transfer kepemilikan sebelum mencabut akses Owner ini.",
    );
  }

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: {
      role: AdminRole.Viewer,
      managementMemberId: null,
    },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_ACCESS_REVOKED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      fromRole: target.role,
      toRole: AdminRole.Viewer,
      memberIdCleared: true,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}

export async function deleteCommitteeAdmin(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = deleteCommitteeAdminSchema.safeParse({
    adminProfileId: formData.get("adminProfileId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: { id: true, authUserId: true, role: true },
  });
  if (!target) return rootError("Profil admin tidak ditemukan.");

  if (target.authUserId === gate.owner.authUserId) {
    return rootError("Tidak bisa menghapus profil sendiri.");
  }

  const ownerIds = await listOwnerAuthUserIds();
  if (
    !roleChangePreservesAtLeastOneOwner({
      ownerAuthUserIds: ownerIds,
      targetAuthUserId: target.authUserId,
      previousRole: target.role,
      nextRole: AdminRole.Viewer,
    })
  ) {
    return rootError(
      "Minimal harus ada satu Owner. Tambahkan Owner lain sebelum menghapus Owner ini.",
    );
  }

  const blockers = await loadAdminProfileDeletionBlockers(target.id);
  const blockedMessage = formatAdminProfileDeleteBlockedMessage(blockers);
  if (blockedMessage) {
    return rootError(blockedMessage);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminProfile.delete({ where: { id: target.id } });
      await tx.user.delete({ where: { id: target.authUserId } });
    });
  } catch (e) {
    console.error("[deleteCommitteeAdmin]", e);
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2003" || e.code === "P2014")
    ) {
      return rootError(
        "Tidak bisa menghapus — masih ada data yang bergantung pada profil ini (mis. undangan yang dibuat). Sesuaikan data terlebih dahulu.",
      );
    }
    return rootError(
      "Gagal menghapus profil atau akun masuk. Coba lagi atau hubungi operator.",
    );
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_DELETED_UI,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: { targetAuthUserId: target.authUserId },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ deleted: true });
}
