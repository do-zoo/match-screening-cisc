"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";

import { guardOwner, guardOwnerOrAdmin, isAuthError, type OwnerGuardContext } from "@/lib/actions/guard";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { prisma } from "@/lib/db/prisma";
import {
  adminMasterMemberCreateSchema,
  adminMasterMemberUpdateSchema,
  deleteMasterMemberSchema,
} from "@/lib/forms/admin-master-member-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { MAX_MASTER_MEMBER_IMPORT_BYTES } from "@/lib/members/master-member-csv-constants";
import {
  masterMemberCsvPatchToCreateData,
  masterMemberCsvPatchToUpdateData,
} from "@/lib/members/master-member-csv-prisma-data";
import { assertCsvTextSingleLinePhysicalRecords } from "@/lib/members/master-member-csv-single-line-record";
import { parseMasterMemberCsvText } from "@/lib/members/parse-master-member-csv-text";
import { prepareMasterMemberCsvRow } from "@/lib/members/prepare-master-member-csv-row";

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

export type MasterMemberImportResult = {
  successCount: number;
  failureCount: number;
  errorCsvBase64: string | null;
};

type ErrorRowCsv = {
  baris: number;
  member_number: string;
  full_name: string;
  alasan: string;
};

export async function importMasterMembersCsv(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<MasterMemberImportResult>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return rootError("Berkas CSV wajib diunggah.");
  }
  if (file.size > MAX_MASTER_MEMBER_IMPORT_BYTES) {
    return rootError("Berkas terlalu besar (maks. 2 MiB).");
  }

  const text = await file.text();

  try {
    assertCsvTextSingleLinePhysicalRecords(text);
  } catch (e) {
    return rootError(e instanceof Error ? e.message : "Format CSV tidak valid.");
  }

  let rows: ReturnType<typeof parseMasterMemberCsvText>["rows"];
  try {
    rows = parseMasterMemberCsvText(text).rows;
  } catch (e) {
    return rootError(e instanceof Error ? e.message : "CSV tidak dapat dibaca.");
  }

  const memberFirstLine = new Map<string, number>();
  const errors: ErrorRowCsv[] = [];
  let successCount = 0;

  for (const row of rows) {
    const fullNameMirror = row.cells.full_name?.trim() ?? "";
    const prep = prepareMasterMemberCsvRow(
      row.lineNumberPhysical,
      row.cells,
      memberFirstLine,
    );

    if (prep.tag === "duplicate") {
      errors.push({
        baris: prep.lineNumberPhysical,
        member_number: prep.memberNumber,
        full_name: fullNameMirror,
        alasan: `Duplikat nomor member dalam berkas (baris pertama: ${prep.firstLineNumber}).`,
      });
      continue;
    }

    if (prep.tag === "reject") {
      errors.push({
        baris: prep.lineNumberPhysical,
        member_number: fullNameMirror,
        full_name: fullNameMirror,
        alasan: prep.reasons.join(" "),
      });
      continue;
    }

    try {
      const existing = await prisma.masterMember.findFirst({
        where: {
          memberNumber: {
            equals: prep.canonicalMemberNumber,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (existing) {
        const data = masterMemberCsvPatchToUpdateData(prep.patch);
        if (Object.keys(data).length === 0) {
          successCount += 1;
        } else {
          await prisma.masterMember.update({
            where: { id: existing.id },
            data,
          });
          successCount += 1;
        }
      } else if (prep.requiresFullNameForCreate) {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan: "Nama wajib untuk anggota baru.",
        });
      } else {
        const data = masterMemberCsvPatchToCreateData(
          prep.patch,
          prep.canonicalMemberNumber,
        );
        await prisma.masterMember.create({ data });
        successCount += 1;
      }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan: "Konflik unik pada nomor member (duplikat di basis data).",
        });
      } else {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan:
            e instanceof Error
              ? e.message
              : "Galat tidak terduga pada basis data.",
        });
      }
    }
  }

  const failureCount = errors.length;
  const errorCsvBase64 =
    errors.length === 0
      ? null
      : Buffer.from(
          Papa.unparse(errors, {
            columns: ["baris", "member_number", "full_name", "alasan"],
          }),
          "utf8",
        ).toString("base64");

  revalidatePath("/admin/members");
  return ok({ successCount, failureCount, errorCsvBase64 });
}

export async function createMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = formData.get("payload");
  let parsed: unknown = null;
  if (typeof rawPayload === "string") {
    try {
      parsed = JSON.parse(rawPayload) as unknown;
    } catch {
      parsed = null;
    }
  }
  const z = adminMasterMemberCreateSchema.safeParse(parsed);
  if (!z.success) return { ok: false, fieldErrors: zodToFieldErrors(z.error) };

  const whatsappStored =
    z.data.whatsapp && z.data.whatsapp.trim().length > 0
      ? z.data.whatsapp.trim()
      : null;

  try {
    const row = await prisma.masterMember.create({
      data: {
        memberNumber: z.data.memberNumber.trim(),
        fullName: z.data.fullName.trim(),
        whatsapp: whatsappStored,
        isActive: z.data.isActive,
      },
      select: { id: true },
    });
    revalidatePath("/admin/members");
    return ok({ id: row.id });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return fieldError({
        memberNumber: "Nomor member sudah dipakai.",
      });
    }
    throw e;
  }
}

export async function updateMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = formData.get("payload");
  let parsed: unknown = null;
  if (typeof rawPayload === "string") {
    try {
      parsed = JSON.parse(rawPayload) as unknown;
    } catch {
      parsed = null;
    }
  }
  const z = adminMasterMemberUpdateSchema.safeParse(parsed);
  if (!z.success) return { ok: false, fieldErrors: zodToFieldErrors(z.error) };

  const whatsappStored =
    z.data.whatsapp && z.data.whatsapp.trim().length > 0
      ? z.data.whatsapp.trim()
      : null;

  await prisma.masterMember.update({
    where: { id: z.data.id },
    data: {
      fullName: z.data.fullName.trim(),
      whatsapp: whatsappStored,
      isActive: z.data.isActive,
    },
    select: { id: true },
  });
  revalidatePath("/admin/members");
  return ok({ id: z.data.id });
}

export async function deleteMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const parsed = deleteMasterMemberSchema.safeParse({
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  const member = await prisma.masterMember.findUnique({
    where: { id: parsed.data.memberId },
    select: {
      id: true,
      fullName: true,
      memberNumber: true,
    },
  });
  if (!member) return rootError("Anggota tidak ditemukan.");

  const [eventsAsPic, bankCount] = await Promise.all([
    prisma.event.count({
      where: {
        picAdminProfile: {
          managementMember: { masterMemberId: member.id },
        },
      },
    }),
    prisma.picBankAccount.count({
      where: {
        ownerAdmin: {
          managementMember: { masterMemberId: member.id },
        },
      },
    }),
  ]);

  if (eventsAsPic > 0) {
    return rootError(
      `Anggota tidak bisa dihapus karena terkait ke akun admin yang dipakai sebagai PIC di ${eventsAsPic} acara. Ganti PIC atau lepaskan tautan admin–anggota terlebih dahulu.`,
    );
  }

  if (bankCount > 0) {
    return rootError(
      `Anggota tidak bisa dihapus karena rekening PIC di bawah profil admin yang terhubung ke anggota ini masih ada (${bankCount}). Hapus rekening terlebih dahulu.`,
    );
  }

  try {
    await prisma.masterMember.delete({ where: { id: member.id } });
  } catch {
    return rootError("Gagal menghapus anggota. Coba lagi atau periksa apakah ada data terkait yang baru ditambahkan.");
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.MASTER_MEMBER_DELETED_UI,
    targetType: "master_member",
    targetId: member.id,
    metadata: {
      memberNumber: member.memberNumber,
      fullName: member.fullName,
    },
  });

  revalidatePath("/admin/members");
  return ok({ deleted: true });
}
