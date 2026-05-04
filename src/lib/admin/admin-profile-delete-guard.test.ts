import { describe, expect, it } from "vitest";

import { formatAdminProfileDeleteBlockedMessage } from "./admin-profile-delete-guard";

describe("formatAdminProfileDeleteBlockedMessage", () => {
  it("returns null when both counts are zero", () => {
    expect(
      formatAdminProfileDeleteBlockedMessage({
        eventPicCount: 0,
        picBankAccountOwnedCount: 0,
      }),
    ).toBeNull();
  });

  it("mentions PIC events when pic count positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 2,
      picBankAccountOwnedCount: 0,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("PIC");
    expect(msg).toContain("2");
  });

  it("mentions bank accounts when ownership count positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 0,
      picBankAccountOwnedCount: 1,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("rekening");
  });

  it("combines both reasons when both positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 1,
      picBankAccountOwnedCount: 3,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("PIC");
    expect(msg).toContain("rekening");
    expect(msg).toContain("; ");
  });
});
