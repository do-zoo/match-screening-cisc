import { describe, expect, it } from "vitest";

import {
  buildAdminVenuesIndexUrl,
  parseVenuesIndexTab,
} from "@/lib/admin/admin-venues-index";

describe("admin-venues-index", () => {
  it("parseVenuesIndexTab", () => {
    expect(parseVenuesIndexTab("active")).toBe("active");
    expect(parseVenuesIndexTab("inactive")).toBe("inactive");
    expect(parseVenuesIndexTab(undefined)).toBe("all");
    expect(parseVenuesIndexTab("")).toBe("all");
  });

  it("buildAdminVenuesIndexUrl", () => {
    expect(buildAdminVenuesIndexUrl({ tab: "all", view: "cards" })).toBe(
      "/admin/venues?tab=all",
    );
    expect(
      buildAdminVenuesIndexUrl({ tab: "active", view: "table", q: "foo" }),
    ).toBe("/admin/venues?tab=active&view=tabel&q=foo");
    expect(
      buildAdminVenuesIndexUrl({ tab: "inactive", view: "cards", page: 2 }),
    ).toBe("/admin/venues?tab=inactive&page=2");
  });
});
