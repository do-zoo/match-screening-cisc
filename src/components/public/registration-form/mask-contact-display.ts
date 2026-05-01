/**
 * Teks disamarkan untuk tampilan publik pada kartu kontak (bukan enkripsi kriptografi).
 */
export function maskDisplayName(fullName: string): string {
  const t = fullName.normalize("NFKC").trim();
  if (t.length === 0) return "•••";
  if (t.length <= 2) return `${t[0]}•`;
  const vis = Math.min(2, t.length);
  const hidden = Math.min(Math.max(4, t.length - vis), 12);
  return `${t.slice(0, vis)}${"•".repeat(hidden)}`;
}

export function maskDisplayWhatsapp(whatsapp: string): string {
  const d = whatsapp.replace(/\D/g, "");
  const n = d.length;
  if (n === 0) return "•••";
  if (n <= 5) return `${d[0]}${"•".repeat(Math.max(3, n - 2))}${d.slice(-1)}`;
  /** Awal ±4 digit, akhir 2 digit; sisanya bullets (seperti nomor panjang Indo). */
  const headLen = Math.min(4, n - 3);
  const start = d.slice(0, headLen);
  const end = d.slice(-2);
  const midDots = Math.min(10, Math.max(4, n - headLen - 2));
  return `${start}${"•".repeat(midDots)}${end}`;
}

export function contactInitials(name: string, maxLetters = 2): string {
  const parts = name
    .normalize("NFKC")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const w = parts[0]!;
    return w.slice(0, maxLetters).toUpperCase();
  }
  return (
    (parts[0]![0] ?? "") +
    (parts[1]?.[0] ?? parts[0]![1] ?? "")
  ).toUpperCase().slice(0, maxLetters);
}
