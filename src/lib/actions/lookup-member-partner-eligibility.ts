"use server";

import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";

export type MemberPartnerLookupResult =
  | { kind: "empty" }
  | { kind: "ok"; found: boolean; isPengurus: boolean };

/**
 * Public lookup: whether the given member number resolves to an active pengurus
 * (committee) who may add a partner ticket on the registration form.
 */
export async function lookupMemberPartnerEligibility(
  memberNumberRaw: string,
): Promise<MemberPartnerLookupResult> {
  const trimmed = memberNumberRaw.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }

  const row = await getActiveMasterMemberByMemberNumber(trimmed);
  if (!row) {
    return { kind: "ok", found: false, isPengurus: false };
  }
  return { kind: "ok", found: true, isPengurus: row.isPengurus };
}
