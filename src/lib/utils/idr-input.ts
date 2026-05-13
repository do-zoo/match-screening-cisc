/**
 * Parses a free-text IDR field by keeping digits only (grouping separators,
 * "Rp", spaces, etc. are ignored). Empty → 0.
 */
export function parseIdrDigitsToInt(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}
