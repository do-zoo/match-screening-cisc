import type { AdminRole } from "@/lib/permissions/roles";

export type AdminContext = {
  role: AdminRole;
  helperEventIds: string[];
};

export function canVerifyEvent(ctx: AdminContext, eventId: string): boolean {
  if (ctx.role === "Owner") return true;
  if (ctx.role === "Verifier") return true;
  return ctx.helperEventIds.includes(eventId);
}
