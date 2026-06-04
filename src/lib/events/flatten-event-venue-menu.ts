/** Sorted menu untuk acara: urutan dari join `sortOrder`, fallback ke `VenueMenuItem.sortOrder`. */
export function flattenedMenuRowsFromEventVenueLinks<
  L extends {
    sortOrder: number | null
    venueMenuItem: {
      id: string
      name: string
      description: string | null
      imageBlobUrl: string | null
      price: number
      sortOrder: number
    }
  },
>(
  links: L[],
): Array<{
  id: string
  name: string
  description: string | null
  imageBlobUrl: string | null
  price: number
}> {
  return [...links]
    .sort((a, b) => (a.sortOrder ?? a.venueMenuItem.sortOrder) - (b.sortOrder ?? b.venueMenuItem.sortOrder))
    .map(x => ({
      id: x.venueMenuItem.id,
      name: x.venueMenuItem.name,
      description: x.venueMenuItem.description,
      imageBlobUrl: x.venueMenuItem.imageBlobUrl,
      price: x.venueMenuItem.price,
    }))
}
