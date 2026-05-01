import { describe, expect, test } from "vitest";
import { canVerifyEvent, type AdminContext } from "@/lib/permissions/guards";

const base: AdminContext = {
  role: "Viewer",
  helperEventIds: [],
};

describe("permissions: canVerifyEvent", () => {
  test("Owner can verify any event", () => {
    expect(canVerifyEvent({ ...base, role: "Owner" }, "e1")).toBe(true);
  });

  test("Verifier can verify any event", () => {
    expect(canVerifyEvent({ ...base, role: "Verifier" }, "e1")).toBe(true);
  });

  test("Admin can verify any event", () => {
    expect(canVerifyEvent({ ...base, role: "Admin" }, "e1")).toBe(true);
  });

  test("Viewer cannot verify without PIC helper grant", () => {
    expect(canVerifyEvent({ ...base, role: "Viewer" }, "e1")).toBe(false);
  });

  test("Viewer can verify for assigned event only", () => {
    expect(
      canVerifyEvent({ ...base, role: "Viewer", helperEventIds: ["e1"] }, "e1"),
    ).toBe(true);
    expect(
      canVerifyEvent({ ...base, role: "Viewer", helperEventIds: ["e1"] }, "e2"),
    ).toBe(false);
  });
});
