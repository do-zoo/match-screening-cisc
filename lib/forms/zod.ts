import type { ZodError } from "zod";

export function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!key) continue;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
import type { ZodError } from "zod";

export function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!key) continue;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

