"use server";

import { del } from "@vercel/blob";
import { MenuMode, MenuSelection, RegistrationStatus } from "@prisma/client";
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

  const primaryMemberNumber = data.claimedMemberNumber?.trim() || undefined;
  const partnerMemberNumber = data.partnerMemberNumber?.trim() || undefined;

  const candidates = [primaryMemberNumber, partnerMemberNumber].filter(
    Boolean,
  ) as string[];

  const dup = await findDuplicateMemberNumbers(event.id, candidates);
  if (dup.length > 0) {
    return rootError(
      `Nomor member berikut sudah terdaftar untuk acara ini: ${dup.join(", ")}`,
    );
  }

  let picMaster = null as { isPengurus: boolean } | null;
  if (primaryMemberNumber) {
    picMaster = await prisma.masterMember.findFirst({
      where: { memberNumber: primaryMemberNumber, isActive: true },
      select: { isPengurus: true },
    });
  }

  if (data.qtyPartner === 1) {
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
    menuParts.push({ mode: "VOUCHER" });
    if (data.qtyPartner === 1) menuParts.push({ mode: "VOUCHER" });
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
    if (data.qtyPartner === 1) {
      menuParts.push({
        mode: "PRESELECT",
        selectedMenuItems: items.map((i) => ({ price: i.price })),
      });
    }
  }

  const pricing = computeSubmitTotal({
    event: {
      ticketMemberPrice: event.ticketMemberPrice,
      ticketNonMemberPrice: event.ticketNonMemberPrice,
      menuMode: event.menuMode,
      voucherPrice: event.voucherPrice,
    },
    primaryPriceType: primaryIsMemberPrice ? "member" : "non_member",
    includePartner: data.qtyPartner === 1,
    perTicketMenu: menuParts,
  });

  let registrationId = "";

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

      if (data.qtyPartner === 1 && data.partnerName) {
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

    await uploadImageForRegistration({
      purpose: "transfer_proof",
      registrationId: reg.id,
      file: transferProof,
    });

    if (claimingMember && memberCard instanceof File) {
      await uploadImageForRegistration({
        purpose: "member_card_photo",
        registrationId: reg.id,
        file: memberCard,
      });
    }

    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: RegistrationStatus.pending_review },
    });

    return ok({ registrationId: reg.id });
  } catch (e) {
    if (registrationId) {
      const uploads = await prisma.upload.findMany({
        where: { registrationId },
        select: { blobUrl: true },
      });
      for (const u of uploads) {
        try {
          await del(u.blobUrl);
        } catch {
          /* best-effort */
        }
      }
      await prisma.registration
        .delete({ where: { id: registrationId } })
        .catch(() => {});
    }
    console.error(e);
    return rootError("Gagal menyimpan pendaftaran. Coba lagi.");
  }
}
