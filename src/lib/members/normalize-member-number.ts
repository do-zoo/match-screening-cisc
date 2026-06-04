/** Satu aturan: trim spasi ASCII, huruf besar A–Z untuk keunikan stabil. */
export function normalizeMemberNumber(raw: string): string {
  return raw.trim().toUpperCase()
}
