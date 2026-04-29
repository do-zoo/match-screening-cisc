"use server";

import { del } from "@vercel/blob";
import {
  MenuMode,
  MenuSelection,
  Prisma,
  RegistrationStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";
import { UploadError } from "@/lib/uploads/errors";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";

const phone = z.string().trim().min(8, "WhatsApp wajib diisi");

const baseSchema = z.object({
  slug: z.string().trim().min(1),
  contactName: z.string().trim().min(2, "Nama wajib diisi"),
  contactWhatsapp: phone,
  claimedMemberNumber: z.string().trim().optional(),
  qtyPartner: z.union([z.literal(0), z.literal(1)]),
  partnerName: z.string().trim().optional(),
  partnerWhatsapp: z.string().trim().optional(),
  partnerMemberNumber: z.string().trim().optional(),
  selectedMenuItemIds: z.array(z.string()).optional(),
});

export type SubmitRegistrationInput = z.infer<typeof baseSchema>;

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
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const qtyPartnerNorm: 0 | 1 =
    String(raw.qtyPartner ?? "0").trim() === "1" ? 1 : 0;
  const selectedMenuItemIds = formData
    .getAll("selectedMenuItemIds")
    .map(String)
    .filter(Boolean);

  const parsed = baseSchema.safeParse({
    ...raw,
    qtyPartner: qtyPartnerNorm,
    selectedMenuItemIds,
  });

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string") fe[p] = issue.message;
    }
    return fieldError(fe);
  }

  const data = parsed.data;

  const event = await prisma.event.findFirst({
    where: { slug: data.slug, status: "active" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) {
    return rootError("Event tidak tersedia atau belum aktif.");
  }

  const transferProof = formData.get("transferProof");
  const memberCard = formData.get("memberCardPhoto");

  if (!(transferProof instanceof File) || transferProof.size === 0) {
    return fieldError({ transferProof: "Unggah bukti transfer wajib." });
  }

  const claimingMember = Boolean(data.claimedMemberNumber?.trim());
  if (claimingMember) {
    if (!(memberCard instanceof File) || memberCard.size === 0) {
      return fieldError({
        memberCardPhoto: "Foto kartu member wajib jika nomor member diisi.",
      });
    }
  }

  const includePartner = data.qtyPartner === 1;
  const primaryMemberNumber = data.claimedMemberNumber?.trim() || undefined;
  const partnerMemberNumber = includePartner
    ? data.partnerMemberNumber?.trim() || undefined
    : undefined;

  if (
    includePartner &&
    primaryMemberNumber &&
    partnerMemberNumber &&
    primaryMemberNumber === partnerMemberNumber
  ) {
    return rootError(
      "Nomor member utama dan partner tidak boleh sama dalam satu pendaftaran.",
    );
  }

  const candidates = [primaryMemberNumber, partnerMemberNumber].filter(
    Boolean,
  ) as string[];

  const dup = await findDuplicateMemberNumbers(event.id, candidates);
  if (dup.length > 0) {
    return rootError(duplicateMemberMessage(dup));
  }

  let picMaster = null as { isPengurus: boolean } | null;
  if (primaryMemberNumber) {
    picMaster = await prisma.masterMember.findFirst({
      where: { memberNumber: primaryMemberNumber, isActive: true },
      select: { isPengurus: true },
    });
  }

  if (includePartner) {
    if (!data.partnerName?.trim()) {
      return fieldError({
        partnerName: "Nama partner wajib jika membawa partner.",
      });
    }
    if (!picMaster?.isPengurus) {
      return rootError(
        "Tiket partner hanya untuk pengurus (komite) — validasi nomor member utama.",
      );
    }
  }

  const primaryIsMemberPrice = Boolean(primaryMemberNumber);

  const menuParts: Parameters<typeof computeSubmitTotal>[0]["perTicketMenu"] =
    [];

  if (event.menuMode === MenuMode.VOUCHER) {
    if (event.voucherPrice == null) {
      return rootError(
        "Konfigurasi voucher acara belum lengkap. Hubungi panitia.",
      );
    }
    menuParts.push({ mode: "VOUCHER" });
    if (includePartner) menuParts.push({ mode: "VOUCHER" });
  } else {
    const ids = data.selectedMenuItemIds ?? [];
    if (event.menuSelection === MenuSelection.SINGLE && ids.length !== 1) {
      return fieldError({
        selectedMenuItemIds: "Pilih tepat satu menu.",
      });
    }
    if (event.menuSelection === MenuSelection.MULTI && ids.length < 1) {
      return fieldError({ selectedMenuItemIds: "Pilih minimal satu menu." });
    }
    const items = event.menuItems.filter((m) => ids.includes(m.id));
    if (items.length !== ids.length) {
      return rootError("Menu tidak valid untuk acara ini.");
    }
    menuParts.push({
      mode: "PRESELECT",
      selectedMenuItems: items.map((i) => ({ price: i.price })),
    });
    if (includePartner) {
      menuParts.push({
        mode: "PRESELECT",
        selectedMenuItems: items.map((i) => ({ price: i.price })),
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

    if (claimingMember && memberCard instanceof File) {
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
          `Gagal menyimpan pendaftaran dan membersihkan unggahan. Laporkan ID pendaftaran ${registrationId} ke panitia.`,
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
