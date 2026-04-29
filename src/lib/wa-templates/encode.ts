/**
 * Normalize Indonesian WhatsApp digits to international form without '+' (wa.me expects country code numeric only).
 */
export function normalizeIdPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.length >= 9) return `62${digits}`;
  return digits;
}

export function waMeLink(phone: string, message: string): string {
  const n = normalizeIdPhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
