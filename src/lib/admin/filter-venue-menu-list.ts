import type { VenueMenuLockFilter } from "@/lib/admin/admin-venue-menu-list";

export type VenueMenuListRowLike = {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
};

export function venueMenuRowMatchesSearch(
  row: VenueMenuListRowLike,
  qNormalized: string,
): boolean {
  if (qNormalized.length === 0) return true;
  const name = row.name.toLowerCase();
  const desc = (row.description ?? "").toLowerCase();
  const priceStr = String(row.price);
  return (
    name.includes(qNormalized) ||
    desc.includes(qNormalized) ||
    priceStr.includes(qNormalized)
  );
}

export function venueMenuRowMatchesLockFilter(
  row: { id?: string },
  filter: VenueMenuLockFilter,
  frozenIds: Set<string>,
): boolean {
  if (filter === "all") return true;
  const locked = row.id ? frozenIds.has(row.id) : false;
  if (filter === "locked") return locked;
  return !locked;
}
