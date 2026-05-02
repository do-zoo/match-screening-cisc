import type {
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

export type EventIntegritySnapshot = {
  slug: string;
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  voucherPrice: number | null;
  pricingSource: PricingSource;
  picAdminProfileId: string;
  bankAccountId: string;
};

export type EventIntegrityPatch = Partial<EventIntegritySnapshot>;

export function findLockedViolations(opts: {
  registrationCount: number;
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): Array<keyof Pick<
  EventIntegritySnapshot,
  "slug" | "menuMode" | "menuSelection"
>> {
  if (opts.registrationCount === 0) return [];

  const out: Array<"slug" | "menuMode" | "menuSelection"> = [];

  const nextSlug = opts.candidate.slug ?? opts.persisted.slug;
  if (nextSlug !== opts.persisted.slug) out.push("slug");

  const nextMode = opts.candidate.menuMode ?? opts.persisted.menuMode;
  if (nextMode !== opts.persisted.menuMode) out.push("menuMode");

  const nextSel =
    opts.candidate.menuSelection ?? opts.persisted.menuSelection;
  if (nextSel !== opts.persisted.menuSelection) out.push("menuSelection");

  return out;
}

export function needsSensitiveAcknowledgement(opts: {
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): boolean {
  const merged = { ...opts.persisted, ...opts.candidate };

  const pricingChanged =
    merged.ticketMemberPrice !== opts.persisted.ticketMemberPrice ||
    merged.ticketNonMemberPrice !== opts.persisted.ticketNonMemberPrice ||
    merged.voucherPrice !== opts.persisted.voucherPrice ||
    merged.pricingSource !== opts.persisted.pricingSource;

  const financeActorChanged =
    merged.picAdminProfileId !== opts.persisted.picAdminProfileId ||
    merged.bankAccountId !== opts.persisted.bankAccountId;

  return pricingChanged || financeActorChanged;
}
