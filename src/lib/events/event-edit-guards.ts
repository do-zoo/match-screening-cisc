export type EventIntegritySnapshot = {
  slug: string;
  venueId: string;
  mandatoryMenuItemIds: string[];
  picAdminProfileId: string;
  bankAccountId: string;
};

export type EventIntegrityPatch = Partial<EventIntegritySnapshot>;

function sortedMenuKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function findLockedViolations(opts: {
  registrationCount: number;
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): Array<keyof Pick<EventIntegritySnapshot, "slug" | "venueId">> {
  if (opts.registrationCount === 0) return [];

  const out: Array<"slug" | "venueId"> = [];

  const nextSlug = opts.candidate.slug ?? opts.persisted.slug;
  if (nextSlug !== opts.persisted.slug) out.push("slug");

  const nextVenue = opts.candidate.venueId ?? opts.persisted.venueId;
  if (nextVenue !== opts.persisted.venueId) out.push("venueId");

  return out;
}

export function findMandatoryMenuLockedViolation(opts: {
  registrationCount: number;
  persisted: EventIntegritySnapshot;
  candidateMandatoryMenuItemIds: string[] | undefined;
}): boolean {
  if (opts.registrationCount === 0) return false;
  if (opts.candidateMandatoryMenuItemIds === undefined) return false;
  return (
    sortedMenuKey(opts.candidateMandatoryMenuItemIds) !==
    sortedMenuKey(opts.persisted.mandatoryMenuItemIds)
  );
}

export function needsSensitiveAcknowledgement(opts: {
  persisted: EventIntegritySnapshot;
  candidate: EventIntegrityPatch;
}): boolean {
  const merged = { ...opts.persisted, ...opts.candidate };

  const financeActorChanged =
    merged.picAdminProfileId !== opts.persisted.picAdminProfileId ||
    merged.bankAccountId !== opts.persisted.bankAccountId;

  return financeActorChanged;
}
