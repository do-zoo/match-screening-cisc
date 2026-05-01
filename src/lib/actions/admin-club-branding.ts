"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { clubBrandingTextsSchema } from "@/lib/forms/club-branding-schema";
import {
  ok,
  rootError,
  fieldError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { CLUB_BRANDING_SINGLETON_KEY } from "@/lib/public/load-club-branding";
import { isUploadError } from "@/lib/uploads/errors";
import { uploadClubLogo } from "@/lib/uploads/upload-club-logo";

export async function saveClubBranding(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  let owner: OwnerGuardContext;
  try {
    owner = await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsedTexts = clubBrandingTextsSchema.safeParse({
    clubNameNav: formData.get("clubNameNav"),
    footerPlainText:
      typeof formData.get("footerPlainText") === "string"
        ? (formData.get("footerPlainText") as string)
        : "",
  });

  if (!parsedTexts.success) {
    return fieldError(zodToFieldErrors(parsedTexts.error));
  }

  const footer =
    parsedTexts.data.footerPlainText === ""
      ? null
      : parsedTexts.data.footerPlainText;

  const logo = formData.get("logo");

  const existing = await prisma.clubBranding.findUnique({
    where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
  });

  let nextUrl = existing?.logoBlobUrl ?? null;
  let nextPath = existing?.logoBlobPath ?? null;

  try {
    if (logo instanceof File && logo.size > 0) {
      const uploaded = await uploadClubLogo({
        file: logo,
        previousBlobUrl: existing?.logoBlobUrl,
      });
      nextUrl = uploaded.url;
      nextPath = uploaded.pathname;
    }
  } catch (e) {
    if (isUploadError(e)) return rootError(e.message);
    return rootError("Gagal mengunggah logo.");
  }

  try {
    await prisma.clubBranding.upsert({
      where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
      create: {
        singletonKey: CLUB_BRANDING_SINGLETON_KEY,
        clubNameNav: parsedTexts.data.clubNameNav,
        footerPlainText: footer,
        logoBlobUrl: nextUrl,
        logoBlobPath: nextPath,
      },
      update: {
        clubNameNav: parsedTexts.data.clubNameNav,
        footerPlainText: footer,
        ...(logo instanceof File && logo.size > 0
          ? { logoBlobUrl: nextUrl, logoBlobPath: nextPath }
          : {}),
      },
    });
  } catch {
    if (logo instanceof File && logo.size > 0 && nextUrl?.startsWith("http")) {
      try {
        await del(nextUrl);
      } catch {
        /* ignore */
      }
    }
    return rootError("Tidak dapat menyimpan branding.");
  }

  const changedFields: string[] = [];
  if (!existing || existing.clubNameNav !== parsedTexts.data.clubNameNav) {
    changedFields.push("clubNameNav");
  }
  if (
    (existing?.footerPlainText ?? null) !== footer
  ) {
    changedFields.push("footerPlainText");
  }
  if (logo instanceof File && logo.size > 0) {
    changedFields.push("logo");
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.CLUB_BRANDING_SAVED,
    targetType: "club_branding",
    targetId: CLUB_BRANDING_SINGLETON_KEY,
    metadata: { changed: changedFields.join(",") },
  });

  revalidatePath("/admin/settings/branding");
  revalidatePath("/");
  revalidatePath("/events");
  return ok({ saved: true });
}
