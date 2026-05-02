import type { Prisma } from "@prisma/client";

import type { MasterMemberCsvWritablePatch } from "./prepare-master-member-csv-row";

export function masterMemberCsvPatchToUpdateData(
  patch: MasterMemberCsvWritablePatch,
): Prisma.MasterMemberUpdateInput {
  const data: Prisma.MasterMemberUpdateInput = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.whatsapp !== undefined) data.whatsapp = patch.whatsapp;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  return data;
}

export function masterMemberCsvPatchToCreateData(
  patch: MasterMemberCsvWritablePatch,
  canonicalMemberNumber: string,
): Prisma.MasterMemberCreateInput {
  if (!patch.fullName?.trim()) {
    throw new Error("INTERNAL: fullName harus ada sebelum create");
  }
  return {
    memberNumber: canonicalMemberNumber,
    fullName: patch.fullName.trim(),
    whatsapp: patch.whatsapp ?? null,
    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
  };
}
