import { WaTemplateKey } from "@prisma/client";
import { z } from "zod";

export const saveClubWaTemplateFormSchema = z.object({
  key: z.nativeEnum(WaTemplateKey),
  body: z.string().trim().min(1).max(4000),
});
