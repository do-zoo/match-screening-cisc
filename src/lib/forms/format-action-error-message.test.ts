import { describe, expect, it } from "vitest";

import type { ActionErr } from "@/lib/forms/action-result";
import { formatActionErrorMessage } from "@/lib/forms/format-action-error-message";

describe("formatActionErrorMessage", () => {
  it("prefers rootError over fieldErrors", () => {
    const err: ActionErr = {
      ok: false,
      rootError: "Tidak diizinkan.",
      fieldErrors: { email: "Invalid" },
    };
    expect(formatActionErrorMessage(err)).toBe("Tidak diizinkan.");
  });

  it("joins fieldErrors when rootError absent", () => {
    const err: ActionErr = {
      ok: false,
      fieldErrors: { a: "satu", b: "dua" },
    };
    expect(formatActionErrorMessage(err)).toBe("a: satu · b: dua");
  });

  it("uses fallback when empty err", () => {
    expect(formatActionErrorMessage({ ok: false })).toBe("Terjadi kesalahan.");
    expect(formatActionErrorMessage({ ok: false }, "Fallback khusus")).toBe(
      "Fallback khusus",
    );
  });
});
