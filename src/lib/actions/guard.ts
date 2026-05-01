import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent, type AdminContext } from "@/lib/permissions/guards";

export async function guardEvent(eventId: string): Promise<AdminContext> {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (!canVerifyEvent(ctx, eventId)) throw new Error("FORBIDDEN");
  return ctx;
}

/** Committee / advanced configuration only (`/admin/pengaturan`, admin users, PIC banks, defaults, WA templates). */
export async function guardOwner(): Promise<AdminContext> {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (ctx.role !== "Owner") throw new Error("FORBIDDEN");
  return ctx;
}

/** Operational management routes shared by Owner and Admin (everything except committee advanced settings). */
export async function guardOwnerOrAdmin(): Promise<AdminContext> {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (ctx.role !== "Owner" && ctx.role !== "Admin") throw new Error("FORBIDDEN");
  return ctx;
}

/** Returns true if `e` is a known auth/permission error that should be surfaced as "Tidak diizinkan." */
export function isAuthError(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.message === "NO_PROFILE" ||
      e.message === "FORBIDDEN" ||
      e.message === "UNAUTHENTICATED")
  );
}
