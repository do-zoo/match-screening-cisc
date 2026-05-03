import { z } from "zod";
import {
  EventStatus,
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

/** ISO string or datetime-local-compatible string interpreted in server as absolute instant (store UTC). */

const idrSchema = z.coerce.number().int().nonnegative();

const linkedVenueMenuItemSchema = z.object({
  venueMenuItemId: z.string().min(1),
  /** Urutan tampilan di acara; jika kosong dipakai `VenueMenuItem.sortOrder`. */
  sortOrder: idrSchema.optional(),
});

export type LinkedVenueMenuItemDraft = z.infer<typeof linkedVenueMenuItemSchema>;

export const adminEventUpsertSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    /** Raw HTML sanitized before persistence on server (never trust strip on client-only). */
    descriptionHtml: z.string(),
    venueId: z.string().min(1),
    linkedVenueMenuItems: z.array(linkedVenueMenuItemSchema).min(1),
    /** Accept `new Date(...)` compat strings from serialized JSON payloads. */
    startAtIso: z.string().min(1),
    endAtIso: z.string().min(1),
    registrationCapacity: z.union([idrSchema, z.literal(null)]).optional(),
    registrationManualClosed: z.boolean(),
    status: z.nativeEnum(EventStatus),
    menuMode: z.nativeEnum(MenuMode),
    menuSelection: z.nativeEnum(MenuSelection),
    voucherPriceIdr: z.union([idrSchema, z.literal(null)]),
    pricingSource: z.nativeEnum(PricingSource),
    ticketMemberPrice: idrSchema,
    ticketNonMemberPrice: idrSchema,
    picAdminProfileId: z.string().min(1),
    bankAccountId: z.string().min(1),
    helperAdminProfileIds: z.array(z.string().min(1)),
    acknowledgeSensitiveChanges: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const start = Date.parse(v.startAtIso);
    const end = Date.parse(v.endAtIso);
    if (!Number.isFinite(start)) {
      ctx.addIssue({
        code: "custom",
        path: ["startAtIso"],
        message: "Waktu mulai tidak valid.",
      });
    }
    if (!Number.isFinite(end)) {
      ctx.addIssue({
        code: "custom",
        path: ["endAtIso"],
        message: "Waktu selesai tidak valid.",
      });
    }
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["endAtIso"],
        message: "Waktu selesai harus setelah mulai.",
      });
    }
    if (v.menuMode === "VOUCHER") {
      if (v.voucherPriceIdr === null) {
        ctx.addIssue({
          code: "custom",
          path: ["voucherPriceIdr"],
          message: "Harga voucher wajib untuk mode Voucher.",
        });
      }
    } else if (v.voucherPriceIdr !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["voucherPriceIdr"],
        message: "Kosongkan harga voucher jika Mode Menu bukan Voucher.",
      });
    }

    const seen = new Set<string>();
    for (let i = 0; i < v.linkedVenueMenuItems.length; i++) {
      const row = v.linkedVenueMenuItems[i]!;
      if (seen.has(row.venueMenuItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["linkedVenueMenuItems", i, "venueMenuItemId"],
          message: "Item menu tidak boleh duplikat untuk satu acara.",
        });
      }
      seen.add(row.venueMenuItemId);
    }
  });

export type AdminEventUpsertInput = z.output<typeof adminEventUpsertSchema>;
