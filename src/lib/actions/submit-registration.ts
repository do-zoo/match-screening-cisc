"use server";

import { del } from "@vercel/blob";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { submitRegistrationSchema } from "@/lib/forms/submit-registration-schema";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { UploadError } from "@/lib/uploads/errors";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";
import {
  assertRegistrationAcceptableOrThrowForTx,
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from "@/lib/events/registration-window";
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from "@/lib/public/club-operational-policy";
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";

export type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

function uploadErrorMessage(err: UploadError): string {
  const code =
    (err as UploadError & { meta?: { code?: string } }).meta?.code ?? err.code;

  if (code === "invalid_content_type") {
    return "File harus berupa gambar JPG, PNG, WebP, HEIC, atau HEIF.";
  }
  if (code === "file_too_large") {
    return "Ukuran file terlalu besar. Maksimal 8 MB.";
  }
  if (code === "blob_store_private") {
    return "Konfigurasi penyimpanan unggahan sedang tidak sesuai (Blob store private). Hubungi admin untuk mengubah store menjadi public atau gunakan token dari store public.";
  }
  return "Gagal mengunggah gambar. Coba unggah ulang.";
}

export async function submitRegistration(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  // 1. Parse holders from JSON
  let holdersRaw: unknown;
  try {
    holdersRaw = JSON.parse(formData.get("holders") as string);
  } catch {
    return rootError("Data peserta tidak valid.");
  }

  const rawInput = {
    ticketCategoryId: formData.get("ticketCategoryId"),
    ticketQty: Number(formData.get("ticketQty")),
    holders: holdersRaw,
    contactWhatsapp: formData.get("contactWhatsapp"),
    transferProof: formData.get("transferProof"),
  };

  const parsed = submitRegistrationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return rootError(firstIssue?.message ?? "Data tidak valid.");
  }

  const input = parsed.data;

  // 2. Fetch event + category + club settings in parallel
  const [event, opsGate] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        registrationManualClosed: true,
        openRegistrationAt: true,
        closeRegistrationAt: true,
        registrationCapacity: true,
        ticketCategories: {
          where: { id: input.ticketCategoryId, isActive: true },
          select: {
            id: true,
            regularPrice: true,
            memberPrice: true,
            maxQtyPerPerson: true,
          },
        },
      },
    }),
    loadClubOperationalSettings(),
  ]);

  if (!event) return rootError("Acara tidak ditemukan.");

  // 3. Check registration window (local + global)
  const registrationsTowardQuotaPreview = await countRegistrationsTowardQuota(
    prisma,
    event.id,
  );
  const locallyOpen = isRegistrationOpenForEvent({
    event,
    registrationsTowardQuota: registrationsTowardQuotaPreview,
  });
  const mergedGate = mergeGlobalRegistrationClosure({
    registrationOpen: locallyOpen,
    registrationClosedMessage: locallyOpen
      ? null
      : registrationBlockMessageForPublic({
          eventStatus: event.status,
          registrationManualClosed: event.registrationManualClosed,
          registrationCapacity: event.registrationCapacity,
          registrationsTowardQuota: registrationsTowardQuotaPreview,
          openRegistrationAt: event.openRegistrationAt,
          closeRegistrationAt: event.closeRegistrationAt,
        }),
    registrationGloballyDisabled: opsGate.registrationGloballyDisabled,
    globalRegistrationClosedMessage: opsGate.globalRegistrationClosedMessage,
  });
  if (!mergedGate.registrationOpen) {
    return rootError(
      mergedGate.registrationClosedMessage ?? DEFAULT_GLOBAL_REGISTRATION_CLOSED,
    );
  }

  // 4. Validate category
  const category = event.ticketCategories[0];
  if (!category) return rootError("Kategori tiket tidak tersedia.");

  if (
    category.maxQtyPerPerson !== null &&
    input.ticketQty > category.maxQtyPerPerson
  ) {
    return rootError(
      `Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`,
    );
  }

  if (input.holders.length !== input.ticketQty) {
    return rootError("Jumlah data peserta tidak sesuai dengan jumlah tiket.");
  }

  // 5. Compute pricing — all holders start as "unknown"; admin validates later
  const pricing = computeSubmitTotal({
    holders: input.holders.map((h) => ({
      memberValidation: "unknown" as const,
      category: {
        regularPrice: category.regularPrice,
        memberPrice: category.memberPrice,
      },
      menuItem: h.mandatoryMenuItemId ? { price: 0, name: "" } : null,
    })),
  });

  // 6. Create Registration + RegistrationHolder[] in a transaction, then upload
  let registrationId = "";

  try {
    const reg = await prisma.$transaction(async (tx) => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event);

      // contactName comes from the first holder
      const contactName = input.holders[0].holderName;

      const created = await tx.registration.create({
        data: {
          eventId: event.id,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName,
          contactWhatsapp: input.contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: input.holders.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              claimedMemberNumber: h.claimedMemberNumber?.trim() || null,
              ticketPriceApplied: pricing.lines[i]!.ticketPrice,
              mandatoryMenuItemId: h.mandatoryMenuItemId?.trim() || null,
              mandatoryMenuPriceApplied: null,
            })),
          },
        },
      });

      return created;
    });

    registrationId = reg.id;

    // 7. Upload transfer proof after transaction (so registrationId exists)
    await uploadImageForRegistration({
      purpose: "transfer_proof",
      registrationId: reg.id,
      file: input.transferProof,
    });

    // 8. Move to pending_review
    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: RegistrationStatus.pending_review },
    });

    return ok({ registrationId: reg.id });
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message);
    }

    // Blob rollback: delete any uploaded blobs then clean up the DB row
    let cleanupFailed = false;
    if (registrationId) {
      const uploads = await prisma.upload.findMany({
        where: { registrationId },
        select: { blobUrl: true },
      });
      for (const u of uploads) {
        try {
          await del(u.blobUrl);
        } catch {
          cleanupFailed = true;
        }
      }
      if (cleanupFailed) {
        console.error(e);
        return rootError(
          `Gagal menyimpan pendaftaran dan membersihkan unggahan. Laporkan ID pendaftaran ${registrationId} ke panitia.`,
        );
      }
      await prisma.registration
        .delete({ where: { id: registrationId } })
        .catch(() => {});
    }

    if (e instanceof UploadError) {
      return rootError(uploadErrorMessage(e));
    }
    console.error(e);
    return rootError("Gagal menyimpan pendaftaran. Coba lagi.");
  }
}
