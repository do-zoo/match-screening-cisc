const MIN_LEN = 1;
const MAX_LEN = 120;

export type NormalizeDisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function normalizeAdminDisplayName(raw: string): NormalizeDisplayNameResult {
  const value = raw.trim();
  if (value.length < MIN_LEN) {
    return { ok: false, message: "Nama wajib diisi." };
  }
  if (value.length > MAX_LEN) {
    return {
      ok: false,
      message: `Nama paling banyak ${MAX_LEN} karakter.`,
    };
  }
  return { ok: true, value };
}
