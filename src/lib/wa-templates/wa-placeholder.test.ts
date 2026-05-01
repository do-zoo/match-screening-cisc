import { describe, expect, it } from "vitest";

import { applyWaPlaceholders } from "@/lib/wa-templates/wa-placeholder";

describe("applyWaPlaceholders", () => {
  it("substitutes tokens", () => {
    expect(
      applyWaPlaceholders("Halo {nama}, acara *{judul}*.", {
        nama: "Budi",
        judul: "Nobar Final",
      }),
    ).toBe("Halo Budi, acara *Nobar Final*.");
  });

  it("throws on unknown token lookup", () => {
    expect(() =>
      applyWaPlaceholders("Halo {nama}.", {}),
    ).toThrow(/nilai hilang/i);
  });

  it("throws on stray braces after replace", () => {
    expect(() =>
      applyWaPlaceholders("Invalid {nama", { nama: "x" }),
    ).toThrow(/Template berisi|Tidak dikenali|kurung/);
  });
});
