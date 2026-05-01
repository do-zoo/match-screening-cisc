const MAX_KEYS = 16;
const MAX_STRING = 200;

export function sanitizeAuditMetadata(
  input: unknown,
): Record<string, string | number | boolean | null> | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  let count = 0;
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (++count > MAX_KEYS) break;
    if (typeof val === "string") {
      out[key] =
        val.length > MAX_STRING ? `${val.slice(0, MAX_STRING)}...` : val;
    } else if (typeof val === "number" || typeof val === "boolean") {
      out[key] = val;
    } else if (val === null) {
      out[key] = null;
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      out[key] = "[nested]";
    } else {
      out[key] = String(val);
    }
  }
  return out;
}
