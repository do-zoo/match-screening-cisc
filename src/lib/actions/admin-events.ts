"use server";

import { randomUUID } from "node:crypto";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { allocateUniqueEventSlug } from "@/lib/events/generate-event-slug";
import { getCommitteeTicketDefaults } from "@/lib/events/event-admin-defaults";
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

function parsePayloadField(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function ticketPricesForWrite(opts: {
  pricingSource: AdminEventUpsertInput["pricingSource"];
  parsedMember: number;
  parsedNonMember: number;
}): { ticketMemberPrice: number; ticketNonMemberPrice: number } {
  if (opts.pricingSource === "global_default") {
    const d = getCommitteeTicketDefaults();
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
  "picMasterMemberId" | "bankAccountId" | "helperMasterMemberIds"
>): Promise<ActionResult<void>> {
  const pic = await prisma.masterMember.findUnique({
    where: { id: opts.picMasterMemberId },
    select: { id: true, canBePIC: true, isActive: true },
  });

  if (!pic || !pic.isActive || !pic.canBePIC) {
    return fieldError({
      picMasterMemberId: "PIC tidak valid atau tidak boleh menjadi PIC.",
    });
  }

  const bank = await prisma.picBankAccount.findFirst({
    where: {
      id: opts.bankAccountId,
      ownerMemberId: opts.picMasterMemberId,
      isActive: true,
    },
    select: { id: true },
  });
  if (!bank) {
    return fieldError({
      bankAccountId: "Rekening tidak milik PIC atau tidak aktif.",
    });
  }

  const helperIds = [...new Set(opts.helperMasterMemberIds)].filter(
    (id) => id !== opts.picMasterMemberId,
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
    picMasterMemberId: data.picMasterMemberId,
    bankAccountId: data.bankAccountId,
    helperMasterMemberIds: data.helperMasterMemberIds,
  });
  if (!vPic.ok) return vPic;

  const { ticketMemberPrice, ticketNonMemberPrice } = ticketPricesForWrite({
    pricingSource: data.pricingSource,
    parsedMember: data.ticketMemberPrice,
    parsedNonMember: data.ticketNonMemberPrice,
  });

  const helperIds = [...new Set(data.helperMasterMemberIds)].filter(
    (id) => id !== data.picMasterMemberId,
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
          picMasterMemberId: data.picMasterMemberId,
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
    picMasterMemberId: existing.picMasterMemberId,
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

  const { ticketMemberPrice, ticketNonMemberPrice } = ticketPricesForWrite({
    pricingSource: data.pricingSource,
    parsedMember: data.ticketMemberPrice,
    parsedNonMember: data.ticketNonMemberPrice,
  });

  const candidateSensitivity: Partial<EventIntegritySnapshot> = {
    ticketMemberPrice,
    ticketNonMemberPrice,
    voucherPrice: data.menuMode === "VOUCHER" ? data.voucherPriceIdr : null,
    pricingSource: data.pricingSource,
    picMasterMemberId: data.picMasterMemberId,
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
    picMasterMemberId: data.picMasterMemberId,
    bankAccountId: data.bankAccountId,
    helperMasterMemberIds: data.helperMasterMemberIds,
  });
  if (!vPic.ok) return vPic;

  const helperIds = [...new Set(data.helperMasterMemberIds)].filter(
    (id) => id !== data.picMasterMemberId,
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
          picMasterMemberId: data.picMasterMemberId,
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
