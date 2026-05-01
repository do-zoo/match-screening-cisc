import { z } from "zod";

export const clubBrandingTextsSchema = z.object({
  clubNameNav: z.string().trim().min(1).max(120),
  footerPlainText: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v === "" ? "" : v.slice(0, 500))),
});
