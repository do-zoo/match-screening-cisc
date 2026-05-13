"use server";

import { del } from "@vercel/blob";
import { Prisma, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import {
  createSubmitRegistrationFormSchema,
  MEMBER_NOT_IN_DIRECTORY_MESSAGE,
} from "@/lib/forms/submit-registration-schema";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";
import { normalizePublicManagementCode } from "@/lib/management/normalize-public-code";
import { resolveManagementMemberForPublicRegistration } from "@/lib/management/resolve-management-member-for-registration";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";
import { UploadError } from "@/lib/uploads/errors";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";
import {
  assertRegistrationAcceptableOrThrowForTx,
  countRegistrationsTowardQuota,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from "@/lib/events/registration-window";
import { flattenedMenuRowsFromEventVenueLinks } from "@/lib/events/flatten-event-venue-menu";
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from "@/lib/public/club-operational-policy";
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";

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
  if (code === "blob_store_private") {
    return "Konfigurasi penyimpanan unggahan sedang tidak sesuai (Blob store private). Hubungi admin untuk mengubah store menjadi public atau gunakan token dari store public.";
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
    include: {
      eventVenueMenuItems: {
        include: { venueMenuItem: true },
      },
    },
  });

  if (!event) {
    return rootError("Event tidak tersedia atau belum aktif.");
  }

  type PublicMenuRow = {
    id: string;
    name: string;
    price: number;
    voucherEligible: boolean;
  };
  const menuRowList: PublicMenuRow[] = flattenedMenuRowsFromEventVenueLinks(
    event.eventVenueMenuItems,
  );

  const registrationsTowardQuotaPreview = await countRegistrationsTowardQuota(
    prisma,
    event.id,
  );
  const locallyOpen = isRegistrationOpenForEvent({
    event,
    registrationsTowardQuota: registrationsTowardQuotaPreview,
  });
  const opsGate = await loadClubOperationalSettings();
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

  // 2. Siapkan Payload & Parse dengan Factory Zod
  const raw = Object.fromEntries(formData.entries());
  const qtyPartnerNorm: 0 | 1 =
    String(raw.qtyPartner ?? "0").trim() === "1" ? 1 : 0;

  const purchaserIsMember =
    String(raw.purchaserIsMember ?? "")
      .trim()
      .toLowerCase() === "1";

  const partnerIsMember =
    qtyPartnerNorm === 1 &&
    String(raw.partnerIsMember ?? "")
      .trim()
      .toLowerCase() === "1";

  const payload = {
    slug: coerceForSchema(raw.slug),
    purchaserIsMember,
    contactName: coerceForSchema(raw.contactName),
    contactWhatsapp: coerceForSchema(raw.contactWhatsapp),
    claimedMemberNumber: coerceForSchema(raw.claimedMemberNumber),
    managementPublicCode: coerceForSchema(raw.managementPublicCode),
    qtyPartner: qtyPartnerNorm,
    partnerIsMember,
    partnerName: coerceForSchema(raw.partnerName),
    partnerWhatsapp: coerceForSchema(raw.partnerWhatsapp),
    partnerMemberNumber: coerceForSchema(raw.partnerMemberNumber),
    primaryMandatoryMenuItemId: coerceForSchema(
      raw.primaryMandatoryMenuItemId,
    ),
    partnerMandatoryMenuItemId: coerceForSchema(
      raw.partnerMandatoryMenuItemId,
    ),
    transferProof: optionalFile(formData.get("transferProof")),
    memberCardPhoto: optionalFile(formData.get("memberCardPhoto")),
    partnerMemberCardPhoto: optionalFile(
      formData.get("partnerMemberCardPhoto"),
    ),
  };

  const schema = createSubmitRegistrationFormSchema({
    mandatoryMenuItemIds: event.mandatoryMenuItemIds,
  });
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
  const partnerMemberCard = data.partnerMemberCardPhoto;

  const includePartner = data.qtyPartner === 1;
  const primaryMemberNumberInput =
    data.claimedMemberNumber?.trim() || undefined;
  const partnerMemberNumberRaw =
    includePartner && data.partnerIsMember
      ? data.partnerMemberNumber?.trim() || undefined
      : undefined;

  const primaryDirectoryRow = primaryMemberNumberInput
    ? await getActiveMasterMemberByMemberNumber(primaryMemberNumberInput)
    : null;

  if (primaryMemberNumberInput && !primaryDirectoryRow) {
    return fieldError({
      claimedMemberNumber: MEMBER_NOT_IN_DIRECTORY_MESSAGE,
    });
  }

  const managementPublicCodeTrim =
    data.managementPublicCode?.trim() || undefined;

  let primaryManagementMemberId: string | null = null;
  let claimedManagementPublicCodeStored: string | null = null;

  if (managementPublicCodeTrim) {
    const norm = normalizePublicManagementCode(managementPublicCodeTrim);
    const resolved = await resolveManagementMemberForPublicRegistration(norm);
    if (!resolved.ok) {
      return fieldError({
        managementPublicCode:
          resolved.reason === "not_found"
            ? "Kode pengurus tidak dikenali."
            : "Pengurus tidak terdaftar dalam kepengurusan aktif untuk periode ini.",
      });
    }
    primaryManagementMemberId = resolved.managementMemberId;
    claimedManagementPublicCodeStored = norm;
  }

  /** Kanonis dari direktori (penulisan di DB); mencegah mismatch kapitalisasi vs unique tiket. */
  const primaryMemberNumber = primaryDirectoryRow
    ? primaryDirectoryRow.memberNumber
    : primaryMemberNumberInput;

  let canonicalPartnerMemberNumber: string | undefined;
  if (partnerMemberNumberRaw) {
    const partnerRow =
      await getActiveMasterMemberByMemberNumber(partnerMemberNumberRaw);
    if (!partnerRow) {
      return fieldError({
        partnerMemberNumber: MEMBER_NOT_IN_DIRECTORY_MESSAGE,
      });
    }
    canonicalPartnerMemberNumber = partnerRow.memberNumber;
  }

  const candidates = [primaryMemberNumber, canonicalPartnerMemberNumber].filter(
    Boolean,
  ) as string[];

  // Validasi DB: Duplikat member & hak akses Pengurus
  const dup = await findDuplicateMemberNumbers(event.id, candidates);
  if (dup.length > 0) {
    return rootError(duplicateMemberMessage(dup));
  }

  if (includePartner) {
    const primaryEligibleForPartner =
      Boolean(primaryDirectoryRow?.isManagementMember) ||
      Boolean(primaryManagementMemberId);
    if (!primaryEligibleForPartner) {
      return rootError(
        "Tiket partner hanya untuk pengurus (komite) — validasi identitas utama."
      );
    }
  }

  const primaryIsMemberPrice =
    Boolean(primaryMemberNumber) || Boolean(primaryManagementMemberId);
  const partnerTicketPriceType = data.partnerIsMember ? "member" : "non_member";

  const primaryMenuRow = menuRowList.find(
    (m) => m.id === data.primaryMandatoryMenuItemId,
  );
  if (!primaryMenuRow) {
    return rootError(
      "Konfigurasi menu acara tidak konsisten atau berubah. Muat ulang halaman ini.",
    );
  }

  let partnerMenuRow: PublicMenuRow | undefined;
  if (includePartner) {
    const pid = data.partnerMandatoryMenuItemId?.trim();
    partnerMenuRow = menuRowList.find((m) => m.id === pid);
    if (!partnerMenuRow) {
      return rootError(
        "Konfigurasi menu partner tidak konsisten atau berubah. Muat ulang halaman ini.",
      );
    }
  }

  let pricing: ReturnType<typeof computeSubmitTotal>;
  try {
    pricing = computeSubmitTotal({
      event: {
        ticketMemberPrice: event.ticketMemberPrice,
        ticketNonMemberPrice: event.ticketNonMemberPrice,
      },
      primaryPriceType: primaryIsMemberPrice ? "member" : "non_member",
      primaryMandatoryMenu: {
        name: primaryMenuRow.name,
        price: primaryMenuRow.price,
      },
      ...(includePartner
        ? {
            partnerPriceType: partnerTicketPriceType,
            partnerMandatoryMenu: {
              name: partnerMenuRow!.name,
              price: partnerMenuRow!.price,
            },
          }
        : {}),
    });
  } catch (e) {
    console.error(e);
    return rootError("Gagal menghitung total pendaftaran. Hubungi panitia.");
  }

  let registrationId = "";
  let activeUploadField:
    | "transferProof"
    | "memberCardPhoto"
    | "partnerMemberCardPhoto"
    | null = null;

  try {
    const reg = await prisma.$transaction(async (tx) => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event);

      const primary = await tx.registration.create({
        data: {
          eventId: event.id,
          contactName: data.contactName,
          contactWhatsapp: data.contactWhatsapp,
          claimedMemberNumber: primaryMemberNumber ?? null,
          primaryManagementMemberId,
          claimedManagementPublicCode: claimedManagementPublicCodeStored,
          ticketRole: "primary",
          ticketPriceType: primaryIsMemberPrice ? "member" : "non_member",
          mandatoryMenuItemId: data.primaryMandatoryMenuItemId,
          ticketPriceApplied: pricing.primaryTicketPrice,
          mandatoryMenuPriceApplied: pricing.primaryMenuPrice,
          computedTotalAtSubmit: pricing.primaryTotal,
          status: RegistrationStatus.submitted,
        },
      });

      registrationId = primary.id;

      let partner: { id: string } | null = null;
      if (includePartner && data.partnerName?.trim() && partnerMenuRow) {
        partner = await tx.registration.create({
          data: {
            eventId: event.id,
            primaryRegistrationId: primary.id,
            contactName: data.partnerName.trim(),
            contactWhatsapp: data.partnerWhatsapp?.trim() || "",
            claimedMemberNumber: canonicalPartnerMemberNumber ?? null,
            ticketRole: "partner",
            ticketPriceType: partnerTicketPriceType,
            mandatoryMenuItemId: data.partnerMandatoryMenuItemId!.trim(),
            ticketPriceApplied: pricing.partnerTicketPrice ?? 0,
            mandatoryMenuPriceApplied: pricing.partnerMenuPrice ?? 0,
            computedTotalAtSubmit: pricing.partnerTotal ?? 0,
            status: RegistrationStatus.submitted,
          },
        });
      }

      return { primary, partner };
    });

    activeUploadField = "transferProof";
    await uploadImageForRegistration({
      purpose: "transfer_proof",
      registrationId: reg.primary.id,
      file: transferProof,
    });
    activeUploadField = null;

    if (memberCard instanceof File) {
      activeUploadField = "memberCardPhoto";
      await uploadImageForRegistration({
        purpose: "member_card_photo",
        registrationId: reg.primary.id,
        file: memberCard,
      });
      activeUploadField = null;
    }

    if (includePartner && partnerMemberCard instanceof File) {
      activeUploadField = "partnerMemberCardPhoto";
      await uploadImageForRegistration({
        purpose: "partner_member_card_photo",
        registrationId: reg.primary.id,
        file: partnerMemberCard,
      });
      activeUploadField = null;
    }

    const idsToConfirm = [reg.primary.id, ...(reg.partner ? [reg.partner.id] : [])];
    await prisma.registration.updateMany({
      where: { id: { in: idsToConfirm } },
      data: { status: RegistrationStatus.pending_review },
    });

    return ok({ registrationId: reg.primary.id });
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
