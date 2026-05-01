import {
  type AdminRole,
  hasGlobalVerifierAccess,
} from "@/lib/permissions/roles";

export type AdminContext = {
  role: AdminRole;
  helperEventIds: string[];
};

export function canVerifyEvent(ctx: AdminContext, eventId: string): boolean {
  if (hasGlobalVerifierAccess(ctx.role)) return true;
  return ctx.helperEventIds.includes(eventId);
}
