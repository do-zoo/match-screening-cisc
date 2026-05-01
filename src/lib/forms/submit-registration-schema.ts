import { MenuMode, MenuSelection } from "@prisma/client";
import { z } from "zod";

/** Shared between client serialization and server Prisma payload. */
export type EventValidationContext = {
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  menuItems: { id: string }[];
};

const phone = z.string().trim().min(8, "WhatsApp wajib diisi");

/** Message + guard shared with multi-step UI (subset `trigger` may not surface every superRefine path). */
export const MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE =
  "Foto kartu member wajib jika nomor member diisi." as const;

export const MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE =
  "Nomor member wajib diisi untuk pendaftar member CISC." as const;

const isNonemptyFile = (val: unknown): val is File => {
  return typeof File !== "undefined" && val instanceof File && val.size > 0;
};

/** Same rule as `.superRefine` on memberCardPhoto (client step navigation). */
export function isMemberCardPhotoMissingWhenRequired(values: {
  claimedMemberNumber?: string | undefined;
  memberCardPhoto?: unknown;
}): boolean {
  const claiming = Boolean(String(values.claimedMemberNumber ?? "").trim());
  return claiming && !isNonemptyFile(values.memberCardPhoto);
}

/** Same rule as `.superRefine` on claimedMemberNumber when purchaserIsMember (client step navigation). */
export function isMemberNumberMissingWhenMember(values: {
  purchaserIsMember?: boolean;
  claimedMemberNumber?: string | undefined;
}): boolean {
  return (
    Boolean(values.purchaserIsMember) &&
    !String(values.claimedMemberNumber ?? "").trim()
  );
}

/** Non-empty uploaded file only (FormData omitted key → omit from payload on client). */
const uploadFileRequired = z.custom<File>((val): val is File => isNonemptyFile(val), {
  message: "Unggah bukti transfer wajib.",
});

export function createSubmitRegistrationFormSchema(
  ctx: EventValidationContext,
) {
  return z
    .object({
      slug: z.string().trim().min(1),
      /** Disinkronkan dengan UI; server memaksa konsistensi dengan claimedMemberNumber. */
      purchaserIsMember: z.boolean(),
      contactName: z.string().trim().min(2, "Nama wajib diisi"),
      contactWhatsapp: phone,
      claimedMemberNumber: z.string().trim().optional(),
      qtyPartner: z.union([z.literal(0), z.literal(1)]),
      partnerName: z.string().trim().optional(),
      partnerWhatsapp: z.string().trim().optional(),
      partnerMemberNumber: z.string().trim().optional(),
      selectedMenuItemIds: z.array(z.string()).optional(),
      transferProof: uploadFileRequired,
      memberCardPhoto: z.instanceof(File).optional(),
    })
    .superRefine((data, ctxZod) => {
      const allowedIds = new Set(ctx.menuItems.map((m) => m.id));
      const selectedIds = data.selectedMenuItemIds ?? [];

      if (ctx.menuMode === MenuMode.VOUCHER) {
        if (selectedIds.length > 0) {
          ctxZod.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Menu tidak boleh dipilih untuk mode VOUCHER.",
            path: ["selectedMenuItemIds"],
          });
        }
      } else if (ctx.menuMode === MenuMode.PRESELECT) {
        if (ctx.menuSelection === MenuSelection.SINGLE) {
          if (selectedIds.length !== 1) {
            ctxZod.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Pilih tepat satu menu.",
              path: ["selectedMenuItemIds"],
            });
          } else if (!allowedIds.has(selectedIds[0])) {
            ctxZod.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Menu tidak valid untuk acara ini.",
              path: ["selectedMenuItemIds"],
            });
          }
        } else if (ctx.menuSelection === MenuSelection.MULTI) {
          if (selectedIds.length < 1) {
            ctxZod.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Pilih minimal satu menu.",
              path: ["selectedMenuItemIds"],
            });
          } else {
            const uniqueIds = new Set(selectedIds);
            if (uniqueIds.size !== selectedIds.length) {
              ctxZod.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Terdapat duplikasi pilihan menu.",
                path: ["selectedMenuItemIds"],
              });
            } else {
              for (const id of selectedIds) {
                if (!allowedIds.has(id)) {
                  ctxZod.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Menu tidak valid untuk acara ini.",
                    path: ["selectedMenuItemIds"],
                  });
                  break;
                }
              }
            }
          }
        } else {
          ctxZod.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Konfigurasi jenis pemilihan menu tidak dikenali. Hubungi panitia.",
            path: ["selectedMenuItemIds"],
          });
        }
      } else {
        ctxZod.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Konfigurasi menu acara tidak dikenali. Hubungi panitia.",
          path: ["selectedMenuItemIds"],
        });
      }

      if (data.qtyPartner === 1) {
        if (!data.partnerName || data.partnerName.trim().length < 2) {
          ctxZod.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nama partner wajib jika membawa partner.",
            path: ["partnerName"],
          });
        }
      }

      if (data.purchaserIsMember) {
        if (!data.claimedMemberNumber?.trim()) {
          ctxZod.addIssue({
            code: z.ZodIssueCode.custom,
            message: MEMBER_NUMBER_REQUIRED_WHEN_MEMBER_MESSAGE,
            path: ["claimedMemberNumber"],
          });
        }
      } else if (data.claimedMemberNumber?.trim()) {
        ctxZod.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Hapus nomor member atau ubah status menjadi member CISC.",
          path: ["claimedMemberNumber"],
        });
      }

      const isClaimingMember = Boolean(data.claimedMemberNumber?.trim());
      if (isClaimingMember) {
        if (!isNonemptyFile(data.memberCardPhoto)) {
          ctxZod.addIssue({
            code: z.ZodIssueCode.custom,
            message: MEMBER_CARD_REQUIRED_WHEN_NUMBER_MESSAGE,
            path: ["memberCardPhoto"],
          });
        }
      }

      if (!data.purchaserIsMember && isNonemptyFile(data.memberCardPhoto)) {
        ctxZod.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unggah foto kartu hanya untuk pendaftar member dengan nomor terisi.",
          path: ["memberCardPhoto"],
        });
      }

      const primaryMem = data.claimedMemberNumber?.trim();
      const partnerMem = data.partnerMemberNumber?.trim();
      if (
        data.qtyPartner === 1 &&
        primaryMem &&
        partnerMem &&
        primaryMem === partnerMem
      ) {
        ctxZod.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Nomor member utama dan partner tidak boleh sama dalam satu pendaftaran.",
          path: ["partnerMemberNumber"],
        });
      }
    });
}

export type SubmitRegistrationInput = z.infer<
  ReturnType<typeof createSubmitRegistrationFormSchema>
>;
