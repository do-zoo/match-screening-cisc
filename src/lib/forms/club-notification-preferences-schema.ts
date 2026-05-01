import { z } from "zod";

export const clubNotificationPreferencesSaveSchema = z.object({
  outboundMode: z.enum(["off", "log_only", "live"]),
  outboundLabel: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v === "" ? "" : v.slice(0, 120))),
});
