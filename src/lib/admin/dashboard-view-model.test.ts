import { describe, expect, it } from "vitest";

import {
  buildDashboardEventCards,
  filterDashboardCardsByTab,
  groupByResultToCountMap,
  parseDashboardEventTab,
  sortDashboardEventCards,
  sumPendingReviewForCards,
  type AdminDashboardEventCard,
  type DashboardEventRow,
} from "./dashboard-view-model";

const d = (iso: string) => new Date(iso);

describe("parseDashboardEventTab", () => {
  it("defaults to active", () => {
    expect(parseDashboardEventTab(undefined)).toBe("active");
    expect(parseDashboardEventTab("")).toBe("active");
    expect(parseDashboardEventTab("nope")).toBe("active");
  });

  it("accepts valid tabs", () => {
    expect(parseDashboardEventTab("all")).toBe("all");
    expect(parseDashboardEventTab("finished")).toBe("finished");
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
  const rows: DashboardEventRow[] = [
    {
      id: "e1",
      title: "Past active",
      status: "active",
      startAt: d("2026-06-01T10:00:00Z"),
      venueName: "A",
    },
    {
      id: "e2",
      title: "Soon draft",
      status: "draft",
      startAt: d("2026-07-01T10:00:00Z"),
      venueName: "B",
    },
    {
      id: "e3",
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
    const sparse = buildDashboardEventCards(
      [rows[0]],
      {},
      {},
      {},
    );
    expect(sparse[0].pendingReview).toBe(0);
    expect(sparse[0].approved).toBe(0);
    expect(sparse[0].total).toBe(0);
  });

  it("sorts active before draft before finished; then startAt asc within group", () => {
    const withFinished: DashboardEventRow[] = [
      ...rows,
      {
        id: "e4",
        title: "Done",
        status: "finished",
        startAt: d("2026-05-01T10:00:00Z"),
        venueName: "D",
      },
    ];
    const cards = sortDashboardEventCards(
      buildDashboardEventCards(withFinished, pending, approved, {
        ...total,
        e4: 1,
      }),
    );
    const order = cards.map((c) => c.id);
    expect(order.indexOf("e1")).toBeLessThan(order.indexOf("e3")); // active, earlier date first
    expect(order.indexOf("e3")).toBeLessThan(order.indexOf("e2")); // active before draft
    expect(order.indexOf("e2")).toBeLessThan(order.indexOf("e4")); // draft before finished
  });

  it("tab active excludes draft/finished", () => {
    const cards = sortDashboardEventCards(
      buildDashboardEventCards(rows, pending, approved, total),
    );
    const filtered = filterDashboardCardsByTab(cards, "active");
    expect(filtered.map((c) => c.id).sort()).toEqual(["e1", "e3"]);
    expect(sumPendingReviewForCards(filtered)).toBe(3);
  });

  it("recap sums pending only on visible tab rows", () => {
    const cards: AdminDashboardEventCard[] = [
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
    expect(sumPendingReviewForCards(filterDashboardCardsByTab(cards, "all"))).toBe(
      12,
    );
    expect(sumPendingReviewForCards(filterDashboardCardsByTab(cards, "draft"))).toBe(
      7,
    );
  });
});
