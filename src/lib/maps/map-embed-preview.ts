/** Prioritas pencarian embed Google Maps: nama+alamat, lalu fallback URL https. */

export type MapEmbedQuerySource = "place" | "url";

const MAP_EMBED_MAX_QUERY = 1800;

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveMapEmbedSearchQuery(input: {
  placeName?: string;
  placeAddress?: string;
  mapUrl?: string | null;
}): { query: string; source: MapEmbedQuerySource } {
  const parts = [input.placeName?.trim(), input.placeAddress?.trim()].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  const place = parts.join(", ");
  if (place.length > 0) {
    return { query: place, source: "place" };
  }
  const url = input.mapUrl?.trim() ?? "";
  if (url.length > 0 && isHttpUrl(url)) {
    return { query: url, source: "url" };
  }
  return { query: "", source: "place" };
}

export function buildGoogleMapsEmbedSrc(searchQuery: string): string | null {
  const q = searchQuery.trim();
  if (!q || q.length > MAP_EMBED_MAX_QUERY) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed&hl=id&z=15`;
}

export function mapEmbedPreviewCaption(source: MapEmbedQuerySource): string {
  if (source === "place") {
    return "Pratinjau memakai nama dan alamat (pencarian Google Maps).";
  }
  return "Pratinjau memakai teks dari tautan peta; untuk short link hasil bisa kurang tepat — buka tautan untuk memastikan.";
}
