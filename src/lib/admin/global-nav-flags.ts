import type { AdminContext } from "@/lib/permissions/guards";
import {
  canManageCommitteeAdvancedSettings,
  hasOperationalOwnerParity,
} from "@/lib/permissions/roles";

export type GlobalSidebarNav = {
  beranda: true;
  acara: boolean;
  venues: boolean;
  members: boolean;
  management: boolean;
  settings: boolean;
};

/** Sidebar links for authenticated admin chrome; aligns with IA §4.1 matrix when `ctx` is non-null. */
export function deriveGlobalSidebarNav(ctx: AdminContext | null): GlobalSidebarNav {
  return {
    beranda: true,
    acara: ctx !== null && hasOperationalOwnerParity(ctx.role),
    venues: ctx !== null && hasOperationalOwnerParity(ctx.role),
    members: ctx !== null && hasOperationalOwnerParity(ctx.role),
    management: ctx !== null && hasOperationalOwnerParity(ctx.role),
    settings: ctx !== null && canManageCommitteeAdvancedSettings(ctx.role),
  };
}
