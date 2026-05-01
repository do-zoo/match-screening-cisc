export type AdminRole = "Owner" | "Admin" | "Verifier" | "Viewer";

/** Roles that may verify/edit registrations on every event visible to PIC staff (distinct from PIC Helper uplift for Viewer-only accounts). */
const GLOBAL_VERIFIER_ROLES = new Set<AdminRole>(["Owner", "Admin", "Verifier"]);

export function hasGlobalVerifierAccess(role: AdminRole): boolean {
  return GLOBAL_VERIFIER_ROLES.has(role);
}
