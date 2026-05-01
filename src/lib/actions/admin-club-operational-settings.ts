"use server";

import { revalidatePath } from "next/cache";

import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";
import {
  guardOwner,
  isAuthError,
  type OwnerGuardContext,
} from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  clubOperationalSettingsSaveSchema,
} from "@/lib/forms/club-operational-settings-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { CLUB_OPERATIONAL_SINGLETON_KEY } from "@/lib/public/load-club-operational-settings";

export async function saveClubOperationalSettings(
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

  const parsed = clubOperationalSettingsSaveSchema.safeParse({
    registrationGloballyDisabled: formData.get("registrationGloballyDisabled"),
    globalRegistrationClosedMessage: formData.get(
      "globalRegistrationClosedMessage",
    ),
    maintenanceBannerPlainText: formData.get("maintenanceBannerPlainText"),
  });

  if (!parsed.success) return fieldError(zodToFieldErrors(parsed.error));

  try {
    await prisma.clubOperationalSettings.upsert({
      where: { singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY },
      create: {
        singletonKey: CLUB_OPERATIONAL_SINGLETON_KEY,
        registrationGloballyDisabled: parsed.data.registrationGloballyDisabled,
        globalRegistrationClosedMessage:
          parsed.data.globalRegistrationClosedMessage === ""
            ? null
            : parsed.data.globalRegistrationClosedMessage,
        maintenanceBannerPlainText:
          parsed.data.maintenanceBannerPlainText === ""
            ? null
            : parsed.data.maintenanceBannerPlainText,
      },
      update: {
        registrationGloballyDisabled: parsed.data.registrationGloballyDisabled,
        globalRegistrationClosedMessage:
          parsed.data.globalRegistrationClosedMessage === ""
            ? null
            : parsed.data.globalRegistrationClosedMessage,
        maintenanceBannerPlainText:
          parsed.data.maintenanceBannerPlainText === ""
            ? null
            : parsed.data.maintenanceBannerPlainText,
      },
    });
  } catch {
    return rootError("Gagal menyimpan pengaturan.");
  }

  await appendClubAuditLog(prisma, {
    actorProfileId: owner.profileId,
    actorAuthUserId: owner.authUserId,
    action: CLUB_AUDIT_ACTION.CLUB_OPERATIONAL_SAVED,
    targetType: "club_operational_settings",
    targetId: CLUB_OPERATIONAL_SINGLETON_KEY,
    metadata: {
      registrationGloballyDisabled: parsed.data.registrationGloballyDisabled,
    },
  });

  revalidatePath("/admin/settings/operations");
  revalidatePath("/");
  revalidatePath("/events");
  return ok({ saved: true });
}
