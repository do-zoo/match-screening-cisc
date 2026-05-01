import { z } from "zod";

function checkboxToBoolean(value: unknown): boolean {
  if (value === "on" || value === true || value === "true" || value === "1")
    return true;
  return false;
}

export const clubOperationalSettingsSaveSchema = z.object({
  registrationGloballyDisabled: z.preprocess(
    checkboxToBoolean,
    z.boolean(),
  ),
  globalRegistrationClosedMessage: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v === "" ? "" : v.slice(0, 500))),
  maintenanceBannerPlainText: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v === "" ? "" : v.slice(0, 800))),
});
