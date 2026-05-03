/** Returns Indonesian error message or null when ok. */
export function validateVenueSubsetForEvent(opts: {
  eventVenueId: string;
  venueMenuItemIds: string[];
  catalogById: Map<string, { venueId: string }>;
}): string | null {
  for (const id of opts.venueMenuItemIds) {
    const row = opts.catalogById.get(id);
    if (!row) return "Item menu tidak termasuk dalam katalog venue.";
    if (row.venueId !== opts.eventVenueId) {
      return "Item menu tidak sesuai venue acara.";
    }
  }
  return null;
}

export function linkedVenueMenuSignature(
  rows: { venueMenuItemId: string; sortOrder: number | null }[],
): string {
  return JSON.stringify(
    [...rows]
      .map((r) => ({
        venueMenuItemId: r.venueMenuItemId,
        sortOrder: r.sortOrder,
      }))
      .sort((a, b) => a.venueMenuItemId.localeCompare(b.venueMenuItemId)),
  );
}
