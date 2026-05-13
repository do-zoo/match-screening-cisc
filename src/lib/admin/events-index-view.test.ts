import { describe, expect, it } from "vitest";

import { parseEventsIndexViewParam } from "./events-index-view";

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
