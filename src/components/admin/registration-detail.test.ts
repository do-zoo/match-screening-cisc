import { describe, expect, test } from "vitest";
import { TicketRole } from "@prisma/client";

import { buildPriceSnapshotSummary, isAdditivePriceSnapshot } from "@/components/admin/registration-detail-panels/tab-summary/price-snapshot-section";
import {
  formatCurrencyIdr,
  formatUploadPurpose,
} from "@/components/admin/registration-detail-panels/shared/format";

describe("registration detail presentation helpers", () => {
  test("formats submitted totals as Indonesian rupiah", () => {
    expect(formatCurrencyIdr(150000)).toBe("Rp150.000");
  });

  test("formats upload purposes for admins", () => {
    expect(formatUploadPurpose("transfer_proof")).toBe("Bukti transfer");
    expect(formatUploadPurpose("member_card_photo")).toBe("Foto kartu member");
    expect(formatUploadPurpose("partner_member_card_photo")).toBe(
      "Foto kartu member (partner)",
    );
    expect(formatUploadPurpose("invoice_adjustment_proof")).toBe(
      "Bukti penyesuaian invoice",
    );
  });

  test("summarizes submitted price snapshots across primary and partner tickets", () => {
    const summary = buildPriceSnapshotSummary([
      {
        id: "primary-1",
        role: TicketRole.primary,
        fullName: "Budi",
        ticketPriceApplied: 350_000,
        mandatoryMenuItemName: "Ayam panggang",
        mandatoryMenuPriceApplied: 300_000,
        computedTotalAtSubmit: 650_000,
      },
      {
        id: "partner-1",
        role: TicketRole.partner,
        fullName: "Sari",
        ticketPriceApplied: 400_000,
        mandatoryMenuItemName: "Ikan bakar",
        mandatoryMenuPriceApplied: 200_000,
        computedTotalAtSubmit: 600_000,
      },
    ]);

    expect(summary.total).toBe(1_250_000);
    expect(summary.rows).toEqual([
      {
        id: "primary-1",
        label: "Utama - Budi",
        ticketPriceApplied: 350_000,
        mandatoryMenuItemName: "Ayam panggang",
        mandatoryMenuPriceApplied: 300_000,
        computedTotalAtSubmit: 650_000,
      },
      {
        id: "partner-1",
        label: "Partner - Sari",
        ticketPriceApplied: 400_000,
        mandatoryMenuItemName: "Ikan bakar",
        mandatoryMenuPriceApplied: 200_000,
        computedTotalAtSubmit: 600_000,
      },
    ]);
    expect(isAdditivePriceSnapshot(summary.rows[0]!)).toBe(true);
    expect(isAdditivePriceSnapshot(summary.rows[1]!)).toBe(true);
  });

  test("detects inclusive ticket snapshot rows", () => {
    const row = {
      id: "p1",
      label: "Utama - Andi",
      ticketPriceApplied: 500_000,
      mandatoryMenuItemName: "Nasi goreng",
      mandatoryMenuPriceApplied: 150_000,
      computedTotalAtSubmit: 500_000,
    };
    expect(isAdditivePriceSnapshot(row)).toBe(false);
  });
});
