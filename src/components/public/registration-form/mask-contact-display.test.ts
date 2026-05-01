import { describe, expect, it } from "vitest";

import {
  contactInitials,
  maskDisplayName,
  maskDisplayWhatsapp,
} from "./mask-contact-display";

describe("maskDisplayName", () => {
  it("masks longer names preserving a short prefix", () => {
    expect(maskDisplayName("Budi Santoso")).toMatch(/^Bu•+$/);
    expect(maskDisplayName("Yi")).toBe("Y•");
    expect(maskDisplayName("")).toBe("•••");
    expect(maskDisplayName("AB")).toBe("A•");
  });
});

describe("maskDisplayWhatsapp", () => {
  it("masks phone-like strings preserving partial ends", () => {
    expect(maskDisplayWhatsapp("08123456789")).toMatch(/^0812•+/);
    expect(maskDisplayWhatsapp("08123456789")).toMatch(/89$/);
    expect(maskDisplayWhatsapp("+6281380013800")).toContain("•");
    expect(maskDisplayWhatsapp("+6281380013800")).toMatch(/^6281•+/);
    expect(maskDisplayWhatsapp("")).toBe("•••");
  });
});

describe("contactInitials", () => {
  it("extracts initials", () => {
    expect(contactInitials("Demo PIC Pengurus")).toBe("DP");
    expect(contactInitials("X")).toBe("X");
    expect(contactInitials("")).toBe("?");
  });
});
