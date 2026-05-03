/** Sorted menu untuk acara: urutan dari join `sortOrder`, fallback ke `VenueMenuItem.sortOrder`. */
export function flattenedMenuRowsFromEventVenueLinks<
  L extends {
    sortOrder: number | null;
    venueMenuItem: {
      id: string;
      name: string;
      price: number;
      voucherEligible: boolean;
      sortOrder: number;
    };
  },
>(
  links: L[],
): Array<{
  id: string;
  name: string;
  price: number;
  voucherEligible: boolean;
}> {
  return [...links]
    .sort(
      (a, b) =>
        (a.sortOrder ?? a.venueMenuItem.sortOrder) -
        (b.sortOrder ?? b.venueMenuItem.sortOrder),
    )
    .map((x) => ({
      id: x.venueMenuItem.id,
      name: x.venueMenuItem.name,
      price: x.venueMenuItem.price,
      voucherEligible: x.venueMenuItem.voucherEligible,
    }));
}
