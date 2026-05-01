"use server";

import { revalidatePath } from "next/cache";

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
  addCommitteeAdminByEmailSchema,
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
import { AdminRole } from "@prisma/client";

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

export async function addCommitteeAdminByEmail(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ created: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = addCommitteeAdminByEmailSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: parsed.data.email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!user) {
    return rootError(
      "Tidak ada pengguna dengan email tersebut. Pengguna harus sudah punya akun masuk.",
    );
  }

  const existing = await prisma.adminProfile.findUnique({
    where: { authUserId: user.id },
    select: { id: true },
  });
  if (existing) {
    return rootError("Akun ini sudah terdaftar sebagai admin.");
  }

  const created = await prisma.adminProfile.create({
    data: {
      authUserId: user.id,
      role: AdminRole.Viewer,
    },
    select: { id: true },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_CREATED_UI,
    targetType: "admin_profile",
    targetId: created.id,
    metadata: { targetAuthUserId: user.id, email: parsed.data.email },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ created: true });
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
    memberId: formData.get("memberId") ?? "",
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const target = await prisma.adminProfile.findUnique({
    where: { id: parsed.data.adminProfileId },
    select: {
      id: true,
      authUserId: true,
      memberId: true,
    },
  });
  if (!target) {
    return rootError("Profil admin tidak ditemukan.");
  }

  let nextMemberId: string | null = parsed.data.memberId;
  if (nextMemberId) {
    const member = await prisma.masterMember.findUnique({
      where: { id: nextMemberId },
      select: { id: true },
    });
    if (!member) return rootError("Anggota yang dipilih tidak ditemukan.");
  } else {
    nextMemberId = null;
  }

  const prevMemberId = target.memberId;

  await prisma.adminProfile.update({
    where: { id: target.id },
    data: { memberId: nextMemberId },
  });

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_MEMBER_LINK_CHANGED,
    targetType: "admin_profile",
    targetId: target.id,
    metadata: {
      targetAuthUserId: target.authUserId,
      prevMemberId,
      nextMemberId,
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
      memberId: null,
    },
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
      toRole: AdminRole.Viewer,
      memberIdCleared: true,
    },
  });

  revalidatePath("/admin/settings/committee");
  return ok({ saved: true });
}
