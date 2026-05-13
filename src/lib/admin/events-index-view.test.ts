import { describe, expect, it } from "vitest";

import {
  buildAdminEventsIndexUrl,
  parseEventsIndexSearchQuery,
  parseEventsIndexViewParam,
} from "./events-index-view";

describe("parseEventsIndexViewParam", () => {
  it("defaults to cards", () => {
    expect(parseEventsIndexViewParam(undefined)).toBe("cards");
    expect(parseEventsIndexViewParam("")).toBe("cards");
    expect(parseEventsIndexViewParam("kartu")).toBe("cards");
  });

  it("accepts table aliases", () => {
    expect(parseEventsIndexViewParam("tabel")).toBe("table");
    expect(parseEventsIndexViewParam("table")).toBe("table");
  });

  it("uses first array entry", () => {
    expect(parseEventsIndexViewParam(["tabel", "x"])).toBe("table");
  });
});

describe("parseEventsIndexSearchQuery", () => {
  it("trims and caps length", () => {
    expect(parseEventsIndexSearchQuery(undefined)).toBe("");
    expect(parseEventsIndexSearchQuery("  x  ")).toBe("x");
    const long = "a".repeat(300);
    expect(parseEventsIndexSearchQuery(long).length).toBe(200);
  });
});

describe("buildAdminEventsIndexUrl", () => {
  it("includes tab view q page", () => {
    expect(
      buildAdminEventsIndexUrl({
        tab: "active",
        view: "cards",
        q: "nobar",
        page: 2,
      }),
    ).toBe("/admin/events?tab=active&q=nobar&page=2");
    expect(
      buildAdminEventsIndexUrl({ tab: "all", view: "table", q: "  " }),
    ).toBe("/admin/events?tab=all&view=tabel");
  });
});
