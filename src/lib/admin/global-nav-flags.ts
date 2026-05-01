import type { AdminContext } from "@/lib/permissions/guards";
import {
  canManageCommitteeAdvancedSettings,
  hasOperationalOwnerParity,
} from "@/lib/permissions/roles";

export type GlobalSidebarNav = {
  beranda: true;
  acara: boolean;
  anggota: boolean;
  pengaturan: boolean;
};

/** Sidebar links for authenticated admin chrome; aligns with IA §4.1 matrix when `ctx` is non-null. */
export function deriveGlobalSidebarNav(ctx: AdminContext | null): GlobalSidebarNav {
  return {
    beranda: true,
    acara: ctx !== null,
    anggota: ctx !== null && hasOperationalOwnerParity(ctx.role),
    pengaturan: ctx !== null && canManageCommitteeAdvancedSettings(ctx.role),
  };
}
