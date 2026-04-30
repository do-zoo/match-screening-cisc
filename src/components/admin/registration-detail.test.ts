import { describe, expect, test } from "vitest";
import {
  formatCurrencyIdr,
  formatUploadPurpose,
} from "@/components/admin/registration-detail";

describe("registration detail presentation helpers", () => {
  test("formats submitted totals as Indonesian rupiah", () => {
    expect(formatCurrencyIdr(150000)).toBe("Rp150.000");
  });

  test("formats upload purposes for admins", () => {
    expect(formatUploadPurpose("transfer_proof")).toBe("Bukti transfer");
    expect(formatUploadPurpose("member_card_photo")).toBe("Foto kartu member");
    expect(formatUploadPurpose("invoice_adjustment_proof")).toBe(
      "Bukti penyesuaian invoice",
    );
  });
});
