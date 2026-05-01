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

  it("Verifier: inbox ops but no anggota/pengaturan", () => {
    expect(deriveGlobalSidebarNav(ctx("Verifier"))).toEqual({
      beranda: true,
      acara: true,
      anggota: false,
      pengaturan: false,
    });
  });

  it("Viewer: beranda + acara only by matrix", () => {
    expect(deriveGlobalSidebarNav(ctx("Viewer"))).toEqual({
      beranda: true,
      acara: true,
      anggota: false,
      pengaturan: false,
    });
  });
});
