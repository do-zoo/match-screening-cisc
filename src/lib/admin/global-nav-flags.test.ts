import { describe, expect, it } from "vitest";

import type { AdminContext } from "@/lib/permissions/guards";
import { deriveGlobalSidebarNav } from "@/lib/admin/global-nav-flags";

function ctx(role: AdminContext["role"]): AdminContext {
  return { role, helperEventIds: [] };
}

describe("deriveGlobalSidebarNav", () => {
  it("null context: beranda only (no PIC profile)", () => {
    expect(deriveGlobalSidebarNav(null)).toEqual({
      beranda: true,
      acara: false,
      anggota: false,
      pengaturan: false,
    });
  });

  it("Owner: beranda + acara + anggota + pengaturan", () => {
    expect(deriveGlobalSidebarNav(ctx("Owner"))).toEqual({
      beranda: true,
      acara: true,
      anggota: true,
      pengaturan: true,
    });
  });

  it("Admin: operational parity minus pengaturan", () => {
    expect(deriveGlobalSidebarNav(ctx("Admin"))).toEqual({
      beranda: true,
      acara: true,
      anggota: true,
      pengaturan: false,
    });
  });

  it("Verifier: beranda only for global CRUD sidebar (inbox via dashboard cards)", () => {
    expect(deriveGlobalSidebarNav(ctx("Verifier"))).toEqual({
      beranda: true,
      acara: false,
      anggota: false,
      pengaturan: false,
    });
  });

  it("Viewer: same global CRUD parity as Verifier — no operational Acara list link", () => {
    expect(deriveGlobalSidebarNav(ctx("Viewer"))).toEqual({
      beranda: true,
      acara: false,
      anggota: false,
      pengaturan: false,
    });
  });
});
