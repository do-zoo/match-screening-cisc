"use server";

import { del } from "@vercel/blob";
import { MenuMode, Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { createSubmitRegistrationFormSchema } from "@/lib/forms/submit-registration-schema";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";
import { UploadError } from "@/lib/uploads/errors";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";
import {
  assertRegistrationAcceptableOrThrowForTx,
  countRegistrationsTowardQuota,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from "@/lib/events/registration-window";

export type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

const duplicateMemberMessage = (memberNumbers: string[]) =>
  `Nomor member berikut sudah terdaftar untuk acara ini: ${memberNumbers.join(", ")}`;

function uploadErrorMessage(err: UploadError): string {
  const code =
    (err as UploadError & { meta?: { code?: string } }).meta?.code ?? err.code;

  if (code === "invalid_content_type") {
    return "File harus berupa gambar JPG, PNG, WebP, HEIC, atau HEIF.";
  }
  if (code === "file_too_large") {
    return "Ukuran file terlalu besar. Maksimal 8 MB.";
  }
  return "Gagal mengunggah gambar. Coba unggah ulang.";
}

/** FormData / Object.fromEntries can yield string | Blob; keep scalars predictable for Zod. */
function coerceForSchema(value: unknown): unknown {
  if (typeof value === "object" && value instanceof File) return value;
  if (typeof value === "number") return String(value);
  return value;
}

function optionalFile(entry: FormDataEntryValue | null): File | undefined {
  return entry instanceof File ? entry : undefined;
}

function isTicketMemberUniqueConstraintError(err: unknown): boolean {
  if (
    !(err instanceof Prisma.PrismaClientKnownRequestError) ||
    err.code !== "P2002"
  ) {
    return false;
  }

  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("eventId") && target.includes("memberNumber");
  }

  return (
    typeof target === "string" &&
    target.includes("eventId") &&
    target.includes("memberNumber")
  );
}

export async function submitRegistration(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ registrationId: string }>> {
  const slug = formData.get("slug");
  if (typeof slug !== "string" || slug.trim().length === 0) {
    return fieldError({
      slug: "Slug acara hilang atau tidak valid. Muat ulang halaman ini.",
    });
  }

  // 1. Ambil Event Terlebih Dahulu
  const event = await prisma.event.findFirst({
    where: { slug, status: "active" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });

  if (!event) {
    return rootError("Event tidak tersedia atau belum aktif.");
  }

  const registrationsTowardQuotaPreview = await countRegistrationsTowardQuota(
    prisma,
    event.id
  );
  const registrationBlockedPreview = registrationBlockMessageForPublic({
    eventStatus: event.status,
    registrationManualClosed: event.registrationManualClosed,
    registrationCapacity: event.registrationCapacity,
    registrationsTowardQuota: registrationsTowardQuotaPreview,
  });
  if (registrationBlockedPreview) {
    return rootError(registrationBlockedPreview);
  }

  // 2. Siapkan Payload & Parse dengan Factory Zod
  const raw = Object.fromEntries(formData.entries());
  const qtyPartnerNorm: 0 | 1 =
    String(raw.qtyPartner ?? "0").trim() === "1" ? 1 : 0;
  const selectedMenuItemIds = formData
    .getAll("selectedMenuItemIds")
    .map(String)
    .filter(Boolean);

  const purchaserIsMember =
    String(raw.purchaserIsMember ?? "")
      .trim()
      .toLowerCase() === "1";

  const payload = {
    slug: coerceForSchema(raw.slug),
    purchaserIsMember,
    contactName: coerceForSchema(raw.contactName),
    contactWhatsapp: coerceForSchema(raw.contactWhatsapp),
    claimedMemberNumber: coerceForSchema(raw.claimedMemberNumber),
    qtyPartner: qtyPartnerNorm,
    partnerName: coerceForSchema(raw.partnerName),
    partnerWhatsapp: coerceForSchema(raw.partnerWhatsapp),
    partnerMemberNumber: coerceForSchema(raw.partnerMemberNumber),
    selectedMenuItemIds,
    transferProof: optionalFile(formData.get("transferProof")),
    memberCardPhoto: optionalFile(formData.get("memberCardPhoto")),
  };

  const schema = createSubmitRegistrationFormSchema(event);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string") fe[p] = issue.message;
    }
    return fieldError(fe);
  }

  const data = parsed.data;

  // 3. Persiapan Data Lanjutan
  const transferProof = data.transferProof;
  const memberCard = data.memberCardPhoto;

  const includePartner = data.qtyPartner === 1;
  const primaryMemberNumberInput =
    data.claimedMemberNumber?.trim() || undefined;
  const partnerMemberNumber = includePartner
    ? data.partnerMemberNumber?.trim() || undefined
    : undefined;

  const picMaster = primaryMemberNumberInput
    ? await getActiveMasterMemberByMemberNumber(primaryMemberNumberInput)
    : null;

  if (primaryMemberNumberInput && !picMaster) {
    return fieldError({
      claimedMemberNumber:
        "Nomor member tidak dikenali atau tidak aktif di direktori kami.",
    });
  }

  /** Kanonis dari direktori (penulisan di DB); mencegah mismatch kapitalisasi vs unique tiket. */
  const primaryMemberNumber = picMaster
    ? picMaster.memberNumber
    : primaryMemberNumberInput;

  const candidates = [primaryMemberNumber, partnerMemberNumber].filter(
    Boolean
  ) as string[];

  // Validasi DB: Duplikat member & hak akses Pengurus
  const dup = await findDuplicateMemberNumbers(event.id, candidates);
  if (dup.length > 0) {
    return rootError(duplicateMemberMessage(dup));
  }

  if (includePartner) {
    if (!picMaster?.isPengurus) {
      return rootError(
        "Tiket partner hanya untuk pengurus (komite) — validasi nomor member utama."
      );
    }
  }

  const primaryIsMemberPrice = Boolean(primaryMemberNumber);

  // Konstruksi menu berdasarkan skema yang sudah valid (aman dari manipulasi)
  const menuParts: Parameters<typeof computeSubmitTotal>[0]["perTicketMenu"] =
    [];

  if (event.menuMode === MenuMode.VOUCHER) {
    if (event.voucherPrice == null) {
      return rootError(
        "Konfigurasi voucher acara belum lengkap. Hubungi panitia."
      );
    }
    menuParts.push({ mode: "VOUCHER" });
    if (includePartner) menuParts.push({ mode: "VOUCHER" });
  } else {
    const ids = data.selectedMenuItemIds ?? [];
    const items = event.menuItems.filter((m) => ids.includes(m.id));
    if (items.length !== ids.length) {
      return rootError(
        "Konfigurasi menu acara tidak konsisten atau berubah. Muat ulang halaman ini."
      );
    }

    menuParts.push({
      mode: "PRESELECT",
      selectedMenuItems: items.map((i) => ({ name: i.name, price: i.price })),
    });
    if (includePartner) {
      menuParts.push({
        mode: "PRESELECT",
        selectedMenuItems: items.map((i) => ({ name: i.name, price: i.price })),
      });
    }
  }

  let pricing: ReturnType<typeof computeSubmitTotal>;
  try {
    pricing = computeSubmitTotal({
      event: {
        ticketMemberPrice: event.ticketMemberPrice,
        ticketNonMemberPrice: event.ticketNonMemberPrice,
        menuMode: event.menuMode,
        voucherPrice: event.voucherPrice,
      },
      primaryPriceType: primaryIsMemberPrice ? "member" : "non_member",
      includePartner,
      perTicketMenu: menuParts,
    });
  } catch (e) {
    console.error(e);
    return rootError("Gagal menghitung total pendaftaran. Hubungi panitia.");
  }

  let registrationId = "";
  let activeUploadField: "transferProof" | "memberCardPhoto" | null = null;

  try {
    const reg = await prisma.$transaction(async (tx) => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event);

      const registration = await tx.registration.create({
        data: {
          eventId: event.id,
          contactName: data.contactName,
          contactWhatsapp: data.contactWhatsapp,
          claimedMemberNumber: primaryMemberNumber ?? null,
          ticketMemberPriceApplied: pricing.ticketMemberPriceApplied,
          ticketNonMemberPriceApplied: pricing.ticketNonMemberPriceApplied,
          voucherPriceApplied: pricing.voucherPriceApplied,
          computedTotalAtSubmit: pricing.computedTotalAtSubmit,
          status: RegistrationStatus.submitted,
        },
      });

      registrationId = registration.id;

      await tx.ticket.create({
        data: {
          registrationId: registration.id,
          eventId: event.id,
          role: "primary",
          fullName: data.contactName,
          whatsapp: data.contactWhatsapp,
          memberNumber: primaryMemberNumber ?? null,
          ticketPriceType: primaryIsMemberPrice ? "member" : "non_member",
        },
      });

      if (includePartner && data.partnerName) {
        await tx.ticket.create({
          data: {
            registrationId: registration.id,
            eventId: event.id,
            role: "partner",
            fullName: data.partnerName.trim(),
            whatsapp: data.partnerWhatsapp?.trim() || null,
            memberNumber: partnerMemberNumber ?? null,
            ticketPriceType: "privilege_partner_member_price",
          },
        });
      }

      if (event.menuMode === MenuMode.PRESELECT) {
        const tickets = await tx.ticket.findMany({
          where: { registrationId: registration.id },
        });
        const idsMenu = data.selectedMenuItemIds ?? [];
        for (const t of tickets) {
          for (const mid of idsMenu) {
            await tx.ticketMenuSelection.create({
              data: { ticketId: t.id, menuItemId: mid },
            });
          }
        }
      }

      return registration;
    });

    activeUploadField = "transferProof";
    await uploadImageForRegistration({
      purpose: "transfer_proof",
      registrationId: reg.id,
      file: transferProof,
    });
    activeUploadField = null;

    if (memberCard instanceof File) {
      activeUploadField = "memberCardPhoto";
      await uploadImageForRegistration({
        purpose: "member_card_photo",
        registrationId: reg.id,
        file: memberCard,
      });
      activeUploadField = null;
    }

    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: RegistrationStatus.pending_review },
    });

    return ok({ registrationId: reg.id });
  } catch (e) {
    if (e instanceof RegistrationNotAcceptableError) {
      return rootError(e.message);
    }
    if (isTicketMemberUniqueConstraintError(e)) {
      const memberNumbers =
        candidates.length > 0 ? candidates : ["nomor member"];
      return rootError(duplicateMemberMessage(memberNumbers));
    }

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
          `Gagal menyimpan pendaftaran dan membersihkan unggahan. Laporkan ID pendaftaran ${registrationId} ke panitia.`
        );
      }
      await prisma.registration
        .delete({ where: { id: registrationId } })
        .catch(() => {});
    }

    if (e instanceof UploadError && activeUploadField) {
      return fieldError({ [activeUploadField]: uploadErrorMessage(e) });
    }
    console.error(e);
    return rootError("Gagal menyimpan pendaftaran. Coba lagi.");
  }
}
