"use server";

import { getActiveMasterMemberByMemberNumber } from "@/lib/members/lookup-master-member";

export type MemberPartnerLookupResult =
  | { kind: "empty" }
  | { kind: "ok"; found: false; isPengurus: false }
  | {
      kind: "ok";
      found: true;
      isPengurus: boolean;
      /** Sesuai kolom `MasterMember.memberNumber` (penulisan kanonis). */
      canonicalMemberNumber: string;
      fullName: string;
      whatsapp: string | null;
    };

/**
 * Public lookup: directory row for pricing/autofill plus whether pengurus may add partner ticket.
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
  return {
    kind: "ok",
    found: true,
    isPengurus: row.isPengurus,
    canonicalMemberNumber: row.memberNumber,
    fullName: row.fullName,
    whatsapp: row.whatsapp,
  };
}
