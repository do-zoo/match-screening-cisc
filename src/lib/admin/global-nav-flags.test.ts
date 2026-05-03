import { describe, expect, it } from "vitest";

import type { AdminContext } from "@/lib/permissions/guards";
import { deriveGlobalSidebarNav } from "@/lib/admin/global-nav-flags";

function ctx(role: AdminContext["role"]): AdminContext {
  return { profileId: "prof_test", role, helperEventIds: [] };
}

describe("deriveGlobalSidebarNav", () => {
  it("null context: beranda only (no PIC profile)", () => {
    expect(deriveGlobalSidebarNav(null)).toEqual({
      beranda: true,
      acara: false,
      venues: false,
      members: false,
      management: false,
      settings: false,
    });
  });

  it("Owner: beranda + acara + members + settings", () => {
    expect(deriveGlobalSidebarNav(ctx("Owner"))).toEqual({
      beranda: true,
      acara: true,
      venues: true,
      members: true,
      management: true,
      settings: true,
    });
  });

  it("Admin: operational parity minus settings", () => {
    expect(deriveGlobalSidebarNav(ctx("Admin"))).toEqual({
      beranda: true,
      acara: true,
      venues: true,
      members: true,
      management: true,
      settings: false,
    });
  });

  it("Verifier: beranda only for global CRUD sidebar (inbox via dashboard cards)", () => {
    expect(deriveGlobalSidebarNav(ctx("Verifier"))).toEqual({
      beranda: true,
      acara: false,
      venues: false,
      members: false,
      management: false,
      settings: false,
    });
  });

  it("Viewer: same global CRUD parity as Verifier — no operational Acara list link", () => {
    expect(deriveGlobalSidebarNav(ctx("Viewer"))).toEqual({
      beranda: true,
      acara: false,
      venues: false,
      members: false,
      management: false,
      settings: false,
    });
  });
});
