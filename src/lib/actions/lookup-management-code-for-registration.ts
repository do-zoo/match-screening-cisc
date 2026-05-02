"use server";

import { resolveManagementMemberForPublicRegistration } from "@/lib/management/resolve-management-member-for-registration";
import { normalizePublicManagementCode } from "@/lib/management/normalize-public-code";

export type LookupManagementCodeResult =
  | { kind: "empty" }
  | { kind: "not_found" }
  | { kind: "not_assigned" }
  | { kind: "ok"; fullName: string; managementMemberId: string };

export async function lookupManagementCodeForRegistration(
  raw: string,
): Promise<LookupManagementCodeResult> {
  const code = normalizePublicManagementCode(raw);
  if (!code) return { kind: "empty" };

  const r = await resolveManagementMemberForPublicRegistration(code);
  if (!r.ok) {
    return r.reason === "not_found"
      ? { kind: "not_found" }
      : { kind: "not_assigned" };
  }

  return {
    kind: "ok",
    fullName: r.fullName,
    managementMemberId: r.managementMemberId,
  };
}
