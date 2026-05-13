import type { LookupManagementCodeResult } from "@/lib/actions/lookup-management-code-for-registration";
import type { MemberPartnerLookupResult } from "@/lib/actions/lookup-member-partner-eligibility";
import { normalizePublicManagementCode } from "@/lib/management/normalize-public-code";

export type PrimaryPurchaserIdentityDeps = {
  lookupMember: (raw: string) => Promise<MemberPartnerLookupResult>;
  lookupManagement: (raw: string) => Promise<LookupManagementCodeResult>;
};

export type ResolvePrimaryPurchaserIdentityResult =
  | { branch: "empty" }
  | {
      branch: "member";
      inputTrim: string;
      canonicalMemberNumber: string;
      fullName: string;
      whatsapp: string | null;
      isManagementMember: boolean;
    }
  | {
      branch: "management";
      inputTrim: string;
      normalizedCode: string;
      fullName: string;
      managementMemberId: string;
    }
  | { branch: "neither"; inputTrim: string };

export async function resolvePrimaryPurchaserIdentity(
  raw: string,
  deps: PrimaryPurchaserIdentityDeps,
): Promise<ResolvePrimaryPurchaserIdentityResult> {
  const inputTrim = raw.trim();
  if (!inputTrim) {
    return { branch: "empty" };
  }

  const member = await deps.lookupMember(inputTrim);
  if (member.kind === "ok" && member.found) {
    return {
      branch: "member",
      inputTrim,
      canonicalMemberNumber: member.canonicalMemberNumber,
      fullName: member.fullName,
      whatsapp: member.whatsapp,
      isManagementMember: member.isManagementMember,
    };
  }

  const management = await deps.lookupManagement(inputTrim);
  if (management.kind === "ok") {
    return {
      branch: "management",
      inputTrim,
      normalizedCode: normalizePublicManagementCode(inputTrim),
      fullName: management.fullName,
      managementMemberId: management.managementMemberId,
    };
  }

  return { branch: "neither", inputTrim };
}
