export type EventsIndexViewMode = "cards" | "table";

export function parseEventsIndexViewParam(
  raw: string | string[] | undefined,
): EventsIndexViewMode {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "tabel" || v === "table") return "table";
  return "cards";
}
