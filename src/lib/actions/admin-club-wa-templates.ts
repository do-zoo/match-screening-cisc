"use server";

import { revalidatePath } from "next/cache";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { saveClubWaTemplateFormSchema } from "@/lib/forms/club-wa-template-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { CLUB_WA_DEFAULT_BODIES } from "@/lib/wa-templates/db-default-template-bodies";
import { validateWaTemplateBody } from "@/lib/wa-templates/wa-template-policy";

export async function saveClubWaTemplateBody(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = saveClubWaTemplateFormSchema.safeParse({
    key: formData.get("key"),
    body:
      typeof formData.get("body") === "string"
        ? (formData.get("body") as string)
        : "",
  });

  if (!parsed.success) {
    return fieldError(zodToFieldErrors(parsed.error));
  }

  const { key, body } = parsed.data;
  const policyErr = validateWaTemplateBody(key, body);
  if (policyErr) return fieldError({ body: policyErr });

  try {
    await prisma.clubWaTemplate.upsert({
      where: { key },
      create: { key, body },
      update: { body },
    });
  } catch {
    return rootError("Gagal menyimpan templat.");
  }

  revalidatePath("/admin/settings/whatsapp-templates");
  return ok({ saved: true });
}

export async function resetClubWaTemplateBody(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsedKey = saveClubWaTemplateFormSchema.shape.key.safeParse(
    formData.get("key"),
  );
  if (!parsedKey.success)
    return fieldError({ body: "Jenis templat tidak valid." });

  const body = CLUB_WA_DEFAULT_BODIES[parsedKey.data];

  try {
    await prisma.clubWaTemplate.upsert({
      where: { key: parsedKey.data },
      create: { key: parsedKey.data, body },
      update: { body },
    });
  } catch {
    return rootError("Gagal mengatur ulang templat.");
  }

  revalidatePath("/admin/settings/whatsapp-templates");
  return ok({ saved: true });
}
