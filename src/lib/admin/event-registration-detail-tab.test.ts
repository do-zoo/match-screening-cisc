import { RegistrationStatus } from "@prisma/client";
import { describe, expect, test } from "vitest";

import {
  buildRegistrationDetailPath,
  defaultRegistrationDetailTab,
  parseRegistrationDetailTab,
} from "@/lib/admin/event-registration-detail-tab";

describe("parseRegistrationDetailTab", () => {
  test("returns null for undefined, empty, or unknown", () => {
    expect(parseRegistrationDetailTab(undefined)).toBeNull();
    expect(parseRegistrationDetailTab("")).toBeNull();
    expect(parseRegistrationDetailTab([])).toBeNull();
    expect(parseRegistrationDetailTab([""])).toBeNull();
    expect(parseRegistrationDetailTab("foo")).toBeNull();
  });

  test("accepts valid slugs", () => {
    expect(parseRegistrationDetailTab("ringkasan")).toBe("ringkasan");
    expect(parseRegistrationDetailTab("verifikasi")).toBe("verifikasi");
    expect(parseRegistrationDetailTab("operasi")).toBe("operasi");
    expect(parseRegistrationDetailTab(["operasi"])).toBe("operasi");
  });
});

describe("defaultRegistrationDetailTab", () => {
  test("submitted, pending_review, payment_issue → verifikasi", () => {
    for (const status of [
      RegistrationStatus.submitted,
      RegistrationStatus.pending_review,
      RegistrationStatus.payment_issue,
    ]) {
      expect(
        defaultRegistrationDetailTab({
          status,
          hasUnpaidAdjustment: false,
        }),
      ).toBe("verifikasi");
    }
  });

  test("approved without unpaid → ringkasan", () => {
    expect(
      defaultRegistrationDetailTab({
        status: RegistrationStatus.approved,
        hasUnpaidAdjustment: false,
      }),
    ).toBe("ringkasan");
  });

  test("approved with unpaid → operasi", () => {
    expect(
      defaultRegistrationDetailTab({
        status: RegistrationStatus.approved,
        hasUnpaidAdjustment: true,
      }),
    ).toBe("operasi");
  });

  test("rejected, cancelled, refunded → ringkasan", () => {
    for (const status of [
      RegistrationStatus.rejected,
      RegistrationStatus.cancelled,
      RegistrationStatus.refunded,
    ]) {
      expect(
        defaultRegistrationDetailTab({
          status,
          hasUnpaidAdjustment: false,
        }),
      ).toBe("ringkasan");
    }
  });
});

describe("buildRegistrationDetailPath", () => {
  const eventId = "evt_1";
  const registrationId = "reg_1";

  test("without tab omits query string", () => {
    expect(buildRegistrationDetailPath(eventId, registrationId)).toBe(
      "/admin/events/evt_1/registrants/reg_1",
    );
  });

  test("with tab appends ?tab=", () => {
    expect(buildRegistrationDetailPath(eventId, registrationId, "verifikasi")).toBe(
      "/admin/events/evt_1/registrants/reg_1?tab=verifikasi",
    );
  });
});
