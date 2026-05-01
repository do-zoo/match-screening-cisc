import { describe, expect, test } from "vitest";

import {
  ADMIN_TABLE_PAGE_SIZE,
  parseAdminTablePage,
  resolveClampedPage,
} from "./admin-pagination";

describe("admin-pagination", () => {
  test("parses valid page strings", () => {
    expect(parseAdminTablePage(undefined)).toBe(1);
    expect(parseAdminTablePage("")).toBe(1);
    expect(parseAdminTablePage("3")).toBe(3);
    expect(parseAdminTablePage(["9"])).toBe(9);
    expect(parseAdminTablePage("0")).toBe(1);
    expect(parseAdminTablePage("-2")).toBe(1);
    expect(parseAdminTablePage("nope")).toBe(1);
  });

  test("clamps page to totalPages", () => {
    expect(resolveClampedPage(1, 0, ADMIN_TABLE_PAGE_SIZE)).toBe(1);
    expect(resolveClampedPage(400, 25, ADMIN_TABLE_PAGE_SIZE)).toBe(2);
    expect(resolveClampedPage(1, 40, ADMIN_TABLE_PAGE_SIZE)).toBe(1);
    expect(resolveClampedPage(2, 40, ADMIN_TABLE_PAGE_SIZE)).toBe(2);
  });
});
