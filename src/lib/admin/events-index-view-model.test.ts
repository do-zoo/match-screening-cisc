import { describe, expect, it } from "vitest";

import {
  buildAdminEventSummaries,
  filterAdminEventSummariesBySearch,
  filterAdminEventSummariesByTab,
  groupByResultToCountMap,
  parseEventsIndexStatusTab,
  sortAdminEventSummaries,
  sumPendingReviewForSummaries,
  type AdminEventIndexRow,
  type AdminEventSummary,
} from "./events-index-view-model";

const d = (iso: string) => new Date(iso);

describe("parseEventsIndexStatusTab", () => {
  it("defaults to active", () => {
    expect(parseEventsIndexStatusTab(undefined)).toBe("active");
    expect(parseEventsIndexStatusTab("")).toBe("active");
    expect(parseEventsIndexStatusTab("nope")).toBe("active");
  });

  it("accepts valid tabs", () => {
    expect(parseEventsIndexStatusTab("all")).toBe("all");
    expect(parseEventsIndexStatusTab("finished")).toBe("finished");
  });
});

describe("groupByResultToCountMap", () => {
  it("merges rows", () => {
    expect(
      groupByResultToCountMap([
        { eventId: "a", count: 2 },
        { eventId: "b", count: 0 },
      ]),
    ).toEqual({ a: 2, b: 0 });
  });
});

describe("build + sort + filter + recap", () => {
  const rows: AdminEventIndexRow[] = [
    {
      id: "e1",
      slug: "past-active",
      title: "Past active",
      status: "active",
      startAt: d("2026-06-01T10:00:00Z"),
      venueName: "A",
    },
    {
      id: "e2",
      slug: "soon-draft",
      title: "Soon draft",
      status: "draft",
      startAt: d("2026-07-01T10:00:00Z"),
      venueName: "B",
    },
    {
      id: "e3",
      slug: "later-active",
      title: "Later active",
      status: "active",
      startAt: d("2026-08-01T10:00:00Z"),
      venueName: "C",
    },
  ];

  const pending = { e1: 3, e2: 1, e3: 0 };
  const approved = { e1: 10, e2: 0, e3: 2 };
  const total = { e1: 15, e2: 2, e3: 5 };

  it("maps counts with zeros for missing keys", () => {
    const sparse = buildAdminEventSummaries([rows[0]], {}, {}, {});
    expect(sparse[0].pendingReview).toBe(0);
    expect(sparse[0].approved).toBe(0);
    expect(sparse[0].total).toBe(0);
  });

  it("sorts active before draft before finished; then startAt asc within group", () => {
    const withFinished: AdminEventIndexRow[] = [
      ...rows,
      {
        id: "e4",
        slug: "done",
        title: "Done",
        status: "finished",
        startAt: d("2026-05-01T10:00:00Z"),
        venueName: "D",
      },
    ];
    const items = sortAdminEventSummaries(
      buildAdminEventSummaries(withFinished, pending, approved, {
        ...total,
        e4: 1,
      }),
    );
    const order = items.map((c) => c.id);
    expect(order.indexOf("e1")).toBeLessThan(order.indexOf("e3"));
    expect(order.indexOf("e3")).toBeLessThan(order.indexOf("e2"));
    expect(order.indexOf("e2")).toBeLessThan(order.indexOf("e4"));
  });

  it("tab active excludes draft/finished", () => {
    const items = sortAdminEventSummaries(
      buildAdminEventSummaries(rows, pending, approved, total),
    );
    const filtered = filterAdminEventSummariesByTab(items, "active");
    expect(filtered.map((c) => c.id).sort()).toEqual(["e1", "e3"]);
    expect(sumPendingReviewForSummaries(filtered)).toBe(3);
  });

  it("recap sums pending only on visible tab rows", () => {
    const items: AdminEventSummary[] = [
      {
        ...rows[0],
        pendingReview: 5,
        approved: 1,
        total: 10,
      },
      {
        ...rows[1],
        pendingReview: 7,
        approved: 0,
        total: 2,
      },
    ];
    expect(
      sumPendingReviewForSummaries(filterAdminEventSummariesByTab(items, "all")),
    ).toBe(12);
    expect(
      sumPendingReviewForSummaries(filterAdminEventSummariesByTab(items, "draft")),
    ).toBe(7);
  });
});

describe("filterAdminEventSummariesBySearch", () => {
  const rows: AdminEventSummary[] = [
    {
      id: "a",
      slug: "demo-foo",
      title: "Demo Foo",
      status: "active",
      startAt: d("2026-01-01T00:00:00Z"),
      venueName: "Venue X",
      pendingReview: 0,
      approved: 0,
      total: 0,
    },
    {
      id: "b",
      slug: "other",
      title: "Lain",
      status: "active",
      startAt: d("2026-01-02T00:00:00Z"),
      venueName: "Kafe Z",
      pendingReview: 0,
      approved: 0,
      total: 0,
    },
  ];

  it("returns all when query empty", () => {
    expect(filterAdminEventSummariesBySearch(rows, "  ")).toEqual(rows);
  });

  it("matches title slug venue case-insensitive", () => {
    expect(filterAdminEventSummariesBySearch(rows, "DEMO").map((r) => r.id)).toEqual(["a"]);
    expect(filterAdminEventSummariesBySearch(rows, "foo").map((r) => r.id)).toEqual(["a"]);
    expect(filterAdminEventSummariesBySearch(rows, "kafe").map((r) => r.id)).toEqual(["b"]);
  });
});
