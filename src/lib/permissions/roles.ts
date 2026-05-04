export type AdminRole = "Owner" | "Admin" | "Verifier" | "Viewer";

/** Roles that may verify/edit registrations on every event visible to PIC staff (distinct from PIC Helper uplift for Viewer-only accounts). */
const GLOBAL_VERIFIER_ROLES = new Set<AdminRole>(["Owner", "Admin", "Verifier"]);

export function hasGlobalVerifierAccess(role: AdminRole): boolean {
  return GLOBAL_VERIFIER_ROLES.has(role);
}

/** Owner-only advanced settings surfaces (pricing, WhatsApp templates, branding, notifications, ops, security). Direktori Komite boleh diakses lebih luas pada layout utama; mutasi tertentu (undang/peran/admin) tetap Owner-only pada server actions. */
export function canManageCommitteeAdvancedSettings(role: AdminRole): boolean {
  return role === "Owner";
}

/** Owner or Admin: operational backoffice parity (e.g. master members, event management) — excludes {@link canManageCommitteeAdvancedSettings}. */
export function hasOperationalOwnerParity(role: AdminRole): boolean {
  return role === "Owner" || role === "Admin";
}
