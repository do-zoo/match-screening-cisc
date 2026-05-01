"use server";

import { headers } from "next/headers";

import { normalizeAdminDisplayName } from "@/lib/admin/normalize-admin-display-name";
import { auth } from "@/lib/auth/auth";
import { requireAdminSession } from "@/lib/auth/session";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";

export async function updateAdminDisplayName(
  formData: FormData,
): Promise<ActionResult<void>> {
  await requireAdminSession();

  const raw = formData.get("name");
  const nameStr = typeof raw === "string" ? raw : "";

  const normalized = normalizeAdminDisplayName(nameStr);
  if (!normalized.ok) {
    return fieldError({ name: normalized.message });
  }

  try {
    await auth.api.updateUser({
      body: { name: normalized.value },
      headers: await headers(),
    });
  } catch (e) {
    console.error("[updateAdminDisplayName]", e);
    return rootError(
      "Gagal memperbarui nama. Coba lagi atau hubungi operator.",
    );
  }

  return ok(undefined);
}
