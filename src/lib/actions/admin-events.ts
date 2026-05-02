"use server";

import { randomUUID } from "node:crypto";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { AdminRole, Prisma } from "@prisma/client";

import { guardOwner, guardOwnerOrAdmin, isAuthError, type OwnerGuardContext } from "@/lib/actions/guard";
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import { prisma } from "@/lib/db/prisma";
import { allocateUniqueEventSlug } from "@/lib/events/generate-event-slug";
import { resolveCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";
import {
  findLockedViolations,
  needsSensitiveAcknowledgement,
  type EventIntegritySnapshot,
} from "@/lib/events/event-edit-guards";
import {
  adminEventUpsertSchema,
  type AdminEventUpsertInput,
} from "@/lib/forms/admin-event-form-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { sanitizePublicEventDescriptionHtml } from "@/lib/public/sanitize-event-description";
import { isUploadError } from "@/lib/uploads/errors";
import { uploadEventHeroCover } from "@/lib/uploads/upload-event-cover";

const MENU_DELETE_BLOCKED = "__EVENT_MENU_DELETE_BLOCKED__";
const INVALID_MENU_ITEM_ID = "__INVALID_MENU_ITEM_ID__";

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

function parsePayloadField(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function ticketPricesForWrite(opts: {
  pricingSource: AdminEventUpsertInput["pricingSource"];
  parsedMember: number;
  parsedNonMember: number;
}): Promise<{ ticketMemberPrice: number; ticketNonMemberPrice: number }> {
  if (opts.pricingSource === "global_default") {
    const d = await resolveCommitteeTicketDefaults(prisma);
    return {
      ticketMemberPrice: d.ticketMemberPrice,
      ticketNonMemberPrice: d.ticketNonMemberPrice,
    };
  }
  return {
    ticketMemberPrice: opts.parsedMember,
    ticketNonMemberPrice: opts.parsedNonMember,
  };
}

async function validatePicBankAndHelpers(opts: Pick<
  AdminEventUpsertInput,
  "picAdminProfileId" | "bankAccountId" | "helperMasterMemberIds"
>): Promise<ActionResult<void>> {
  const pic = await prisma.adminProfile.findUnique({
    where: { id: opts.picAdminProfileId },
    select: { id: true, role: true, memberId: true },
  });

  if (!pic || pic.role === AdminRole.Viewer) {
    return fieldError({
      picAdminProfileId: "PIC tidak valid atau tidak boleh menjadi PIC.",
    });
  }

  const bank = await prisma.picBankAccount.findFirst({
    where: {
      id: opts.bankAccountId,
      ownerAdminProfileId: opts.picAdminProfileId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!bank) {
    return fieldError({
      bankAccountId: "Rekening tidak milik PIC atau tidak aktif.",
    });
  }

  const helperIds = [...new Set(opts.helperMasterMemberIds)].filter((id) =>
    pic.memberId ? id !== pic.memberId : true,
  );

  if (helperIds.length > 0) {
    const rows = await prisma.masterMember.findMany({
      where: { id: { in: helperIds }, isActive: true },
      select: { id: true },
    });
    if (rows.length !== helperIds.length) {
      return fieldError({
        helperMasterMemberIds:
          "Salah satu PIC helper tidak aktif atau tidak ditemukan.",
      });
    }
  }

  return ok(undefined);
}

function uniqueHelperMemberIdsExcludingPicLinkedMember(
  helperMasterMemberIds: string[],
  picLinkedMemberId: string | null,
): string[] {
  return [...new Set(helperMasterMemberIds)].filter((id) =>
    picLinkedMemberId ? id !== picLinkedMemberId : true,
  );
}

export async function createAdminEvent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ eventId: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = parsePayloadField(formData);
  if (rawPayload === null) return rootError("Format data tidak valid.");

  const parsed = adminEventUpsertSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error));
  }

  const data = parsed.data;

  const cover = formData.get("cover");
  const coverFile =
    cover instanceof File && cover.size > 0 ? cover : undefined;
  if (!coverFile) return rootError("Sampul acara wajib diunggah.");

  const vPic = await validatePicBankAndHelpers({
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
    helperMasterMemberIds: data.helperMasterMemberIds,
  });
  if (!vPic.ok) return vPic;

  const picForHelpers = await prisma.adminProfile.findUnique({
    where: { id: data.picAdminProfileId },
    select: { memberId: true },
  });

  const { ticketMemberPrice, ticketNonMemberPrice } = await ticketPricesForWrite({
    pricingSource: data.pricingSource,
    parsedMember: data.ticketMemberPrice,
    parsedNonMember: data.ticketNonMemberPrice,
  });

  const helperIds = uniqueHelperMemberIdsExcludingPicLinkedMember(
    data.helperMasterMemberIds,
    picForHelpers?.memberId ?? null,
  );

  const id = randomUUID();

  let slug: string;
  try {
    slug = await allocateUniqueEventSlug(prisma, data.title);
  } catch (e) {
    throw e;
  }

  let coverPut: { url: string; pathname: string };
  try {
    coverPut = await uploadEventHeroCover({ eventId: id, file: coverFile });
  } catch (e) {
    if (isUploadError(e)) return rootError(e.message);
    throw e;
  }

  const description = sanitizePublicEventDescriptionHtml(data.descriptionHtml);
  const voucherPrice = data.menuMode === "VOUCHER" ? data.voucherPriceIdr : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.event.create({
        data: {
          id,
          slug,
          title: data.title,
          summary: data.summary,
          description,
          startAt: new Date(data.startAtIso),
          endAt: new Date(data.endAtIso),
          venueName: data.venueName,
          venueAddress: data.venueAddress,
          coverBlobUrl: coverPut.url,
          coverBlobPath: coverPut.pathname,
          registrationManualClosed: data.registrationManualClosed,
          registrationCapacity:
            data.registrationCapacity === undefined
              ? null
              : data.registrationCapacity,
          status: data.status,
          ticketMemberPrice,
          ticketNonMemberPrice,
          pricingSource: data.pricingSource,
          menuMode: data.menuMode,
          menuSelection: data.menuSelection,
          voucherPrice,
          picAdminProfileId: data.picAdminProfileId,
          bankAccountId: data.bankAccountId,
        },
      });

      await tx.eventMenuItem.createMany({
        data: data.menuItems.map((m, idx) => ({
          eventId: id,
          name: m.name,
          price: m.priceIdr,
          sortOrder: m.sortOrder ?? idx + 1,
          voucherEligible: m.voucherEligible,
        })),
      });

      if (helperIds.length > 0) {
        await tx.eventPicHelper.createMany({
          data: helperIds.map((memberId) => ({ eventId: id, memberId })),
          skipDuplicates: true,
        });
      }
    });
  } catch {
    try {
      await del(coverPut.url);
    } catch {
      // ignore
    }
    return rootError("Gagal menyimpan acara.");
  }

  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath("/");

  return ok({ eventId: id });
}

export async function updateAdminEvent(
  eventId: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ eventId: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = parsePayloadField(formData);
  if (rawPayload === null) return rootError("Format data tidak valid.");

  const parsed = adminEventUpsertSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error));
  }

  const data = parsed.data;

  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      menuItems: { select: { id: true } },
      helpers: { select: { memberId: true } },
      _count: { select: { registrations: true } },
    },
  });

  if (!existing) return rootError("Acara tidak ditemukan.");

  const persistedIntegrity: EventIntegritySnapshot = {
    slug: existing.slug,
    menuMode: existing.menuMode,
    menuSelection: existing.menuSelection,
    ticketMemberPrice: existing.ticketMemberPrice,
    ticketNonMemberPrice: existing.ticketNonMemberPrice,
    voucherPrice: existing.voucherPrice,
    pricingSource: existing.pricingSource,
    picAdminProfileId: existing.picAdminProfileId,
    bankAccountId: existing.bankAccountId,
  };

  const locked = findLockedViolations({
    registrationCount: existing._count.registrations,
    persisted: persistedIntegrity,
    candidate: {
      menuMode: data.menuMode,
      menuSelection: data.menuSelection,
    },
  });
  if (locked.length > 0) {
    return rootError(
      `Bidang tidak dapat diubah karena sudah ada pendaftaran: ${locked.join(", ")}.`,
    );
  }

  const { ticketMemberPrice, ticketNonMemberPrice } = await ticketPricesForWrite({
    pricingSource: data.pricingSource,
    parsedMember: data.ticketMemberPrice,
    parsedNonMember: data.ticketNonMemberPrice,
  });

  const candidateSensitivity: Partial<EventIntegritySnapshot> = {
    ticketMemberPrice,
    ticketNonMemberPrice,
    voucherPrice: data.menuMode === "VOUCHER" ? data.voucherPriceIdr : null,
    pricingSource: data.pricingSource,
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
  };

  const sens = needsSensitiveAcknowledgement({
    persisted: persistedIntegrity,
    candidate: candidateSensitivity,
  });
  if (sens && !data.acknowledgeSensitiveChanges) {
    return rootError(
      "Centang pengakuan untuk mengubah harga tiket/voucher, PIC utama, atau rekening pembayaran.",
    );
  }

  const vPic = await validatePicBankAndHelpers({
    picAdminProfileId: data.picAdminProfileId,
    bankAccountId: data.bankAccountId,
    helperMasterMemberIds: data.helperMasterMemberIds,
  });
  if (!vPic.ok) return vPic;

  const picForHelpersUpdate = await prisma.adminProfile.findUnique({
    where: { id: data.picAdminProfileId },
    select: { memberId: true },
  });
  const helperIds = uniqueHelperMemberIdsExcludingPicLinkedMember(
    data.helperMasterMemberIds,
    picForHelpersUpdate?.memberId ?? null,
  );

  const cover = formData.get("cover");
  const coverFile =
    cover instanceof File && cover.size > 0 ? cover : undefined;

  let coverPut: { url: string; pathname: string } | null = null;
  if (coverFile) {
    try {
      coverPut = await uploadEventHeroCover({
        eventId,
        file: coverFile,
        previousBlobUrl: existing.coverBlobUrl,
        deletePreviousBlob: false,
      });
    } catch (e) {
      if (isUploadError(e)) return rootError(e.message);
      throw e;
    }
  }

  const description = sanitizePublicEventDescriptionHtml(data.descriptionHtml);
  const voucherPrice = data.menuMode === "VOUCHER" ? data.voucherPriceIdr : null;

  const prevCoverUrl = existing.coverBlobUrl;
  const existingMenuIds = new Set(existing.menuItems.map((m) => m.id));
  const incomingMenuIds = new Set(
    data.menuItems.flatMap((m) => (m.id ? [m.id] : [])),
  );

  try {
    await prisma.$transaction(async (tx) => {
      for (const oldId of existingMenuIds) {
        if (!incomingMenuIds.has(oldId)) {
          try {
            await tx.eventMenuItem.delete({ where: { id: oldId } });
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2003"
            ) {
              throw new Error(MENU_DELETE_BLOCKED);
            }
            throw e;
          }
        }
      }

      for (const row of data.menuItems) {
        if (row.id && !existingMenuIds.has(row.id)) {
          throw new Error(INVALID_MENU_ITEM_ID);
        }
        if (row.id && existingMenuIds.has(row.id)) {
          await tx.eventMenuItem.update({
            where: { id: row.id },
            data: {
              name: row.name,
              price: row.priceIdr,
              sortOrder: row.sortOrder,
              voucherEligible: row.voucherEligible,
            },
          });
        } else if (!row.id) {
          await tx.eventMenuItem.create({
            data: {
              eventId,
              name: row.name,
              price: row.priceIdr,
              sortOrder: row.sortOrder,
              voucherEligible: row.voucherEligible,
            },
          });
        }
      }

      await tx.eventPicHelper.deleteMany({ where: { eventId } });
      if (helperIds.length > 0) {
        await tx.eventPicHelper.createMany({
          data: helperIds.map((memberId) => ({ eventId, memberId })),
          skipDuplicates: true,
        });
      }

      await tx.event.update({
        where: { id: eventId },
        data: {
          title: data.title,
          summary: data.summary,
          description,
          startAt: new Date(data.startAtIso),
          endAt: new Date(data.endAtIso),
          venueName: data.venueName,
          venueAddress: data.venueAddress,
          ...(coverPut
            ? {
                coverBlobUrl: coverPut.url,
                coverBlobPath: coverPut.pathname,
              }
            : {}),
          registrationManualClosed: data.registrationManualClosed,
          registrationCapacity:
            data.registrationCapacity === undefined
              ? undefined
              : data.registrationCapacity,
          status: data.status,
          ticketMemberPrice,
          ticketNonMemberPrice,
          pricingSource: data.pricingSource,
          menuMode: data.menuMode,
          menuSelection: data.menuSelection,
          voucherPrice,
          picAdminProfileId: data.picAdminProfileId,
          bankAccountId: data.bankAccountId,
        },
      });
    });

    if (coverPut && prevCoverUrl.startsWith("http")) {
      try {
        await del(prevCoverUrl);
      } catch {
        // ignore
      }
    }
  } catch (e) {
    if (
      typeof e === "object" &&
      e instanceof Error &&
      e.message === MENU_DELETE_BLOCKED
    ) {
      if (coverPut) {
        try {
          await del(coverPut.url);
        } catch {
          // ignore
        }
      }
      return rootError(
        "Menu masih digunakan di pendaftaran — menghapus item ini tidak boleh.",
      );
    }
    if (
      typeof e === "object" &&
      e instanceof Error &&
      e.message === INVALID_MENU_ITEM_ID
    ) {
      if (coverPut) {
        try {
          await del(coverPut.url);
        } catch {
          // ignore
        }
      }
      return fieldError({
        menuItems: "Ada id menu tidak dikenal untuk acara ini.",
      });
    }
    if (coverPut) {
      try {
        await del(coverPut.url);
      } catch {
        // ignore
      }
    }
    throw e;
  }

  const publicSlug = existing.slug;

  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath(`/events/${publicSlug}`);
  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/edit`);

  return ok({ eventId });
}

export async function deleteAdminEvent(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ deleted: true }>> {
  const gate = await requireOwner();
  if (!("owner" in gate)) return gate;

  const eventId = formData.get("eventId");
  if (!eventId || typeof eventId !== "string" || eventId.trim() === "") {
    return rootError("ID acara tidak valid.");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId.trim() },
    select: {
      id: true,
      title: true,
      coverBlobUrl: true,
      _count: { select: { registrations: true } },
    },
  });
  if (!event) return rootError("Acara tidak ditemukan.");

  if (event._count.registrations > 0) {
    return rootError(
      `Acara tidak bisa dihapus karena memiliki ${event._count.registrations} registrasi.`,
    );
  }

  await del(event.coverBlobUrl).catch(() => undefined);

  try {
    await prisma.event.delete({ where: { id: event.id } });
  } catch {
    return rootError("Gagal menghapus acara. Coba lagi atau periksa apakah ada registrasi baru.");
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: gate.owner.profileId,
    actorAuthUserId: gate.owner.authUserId,
    action: CLUB_AUDIT_ACTION.EVENT_DELETED_UI,
    targetType: "event",
    targetId: event.id,
    metadata: { title: event.title },
  });

  revalidatePath("/admin/events");
  revalidatePath("/");
  revalidatePath("/events");
  return ok({ deleted: true });
}
