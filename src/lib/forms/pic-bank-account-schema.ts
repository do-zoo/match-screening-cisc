import { z } from "zod";

export const createPicBankAccountSchema = z.object({
  ownerAdminProfileId: z.string().min(1),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi."),
  accountNumber: z.string().trim().min(1, "Nomor rekening wajib diisi."),
  accountName: z.string().trim().min(1, "Nama pemilik rekening wajib diisi."),
});

export const updatePicBankAccountSchema = z.object({
  bankAccountId: z.string().min(1),
  ownerAdminProfileId: z.string().min(1),
  bankName: z.string().trim().min(1, "Nama bank wajib diisi."),
  accountNumber: z.string().trim().min(1, "Nomor rekening wajib diisi."),
  accountName: z.string().trim().min(1, "Nama pemilik rekening wajib diisi."),
});

export const targetPicBankOwnerSchema = z.object({
  bankAccountId: z.string().min(1),
  ownerAdminProfileId: z.string().min(1),
});
