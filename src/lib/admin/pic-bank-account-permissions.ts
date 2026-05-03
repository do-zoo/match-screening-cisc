import type { AdminRole } from "@/lib/permissions/roles";

/** Sesuai spec: pembaca bisa semua yang sudah akses konteks Komite — gate pada route/halaman. */
export function canViewPicBankListDetails(_viewerRole: AdminRole): boolean {
  return true;
}

/**
 * Mutasi CRUD-ish rekening:
 * - Owner / Admin: semua target
 * - Verifier: hanya profil milik sendiri (`targetOwnerProfileId === viewerProfileId`)
 * - Viewer: tidak boleh mutasi
 */
export function canMutatePicBankForTarget(
  viewerRole: AdminRole,
  viewerProfileId: string,
  targetOwnerProfileId: string,
): boolean {
  if (viewerRole === "Viewer") return false;
  if (viewerRole === "Owner" || viewerRole === "Admin") return true;
  return viewerProfileId === targetOwnerProfileId;
}

export function viewerMayUseOwnerOnlyCommitteeControls(
  viewerRole: AdminRole,
): boolean {
  return viewerRole === "Owner";
}
