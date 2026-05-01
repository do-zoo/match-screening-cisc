/**
 * Sel kosong ⇒ undefined (jangan ubah field).
 * Teks tidak dikenali ⇒ undefined (bukan error), selaras spesifikasi CSV direktori.
 */
export function interpretMasterMemberCsvBoolean(
  cell: string | undefined | null,
): boolean | undefined {
  if (cell === undefined || cell === null) return undefined;
  const t = cell.trim();
  if (!t) return undefined;
  const u = t.toLowerCase();
  if (["true", "1", "yes", "y", "iya"].includes(u)) return true;
  if (["false", "0", "no", "n", "tidak"].includes(u)) return false;
  return undefined;
}
