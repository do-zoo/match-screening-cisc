import Papa from "papaparse";

import type { CommitteeAdminDirectoryVm } from "./load-committee-admin-directory";

export function buildCommitteeAdminDirectoryExportCsv(
  directory: CommitteeAdminDirectoryVm,
): string {
  const records = directory.rows.map((r) => ({
    admin_profile_id: r.adminProfileId,
    email: r.email,
    display_name: r.displayName,
    role: r.role,
    management_member_id: r.managementMemberId ?? "",
    member_summary: r.memberSummary ?? "",
    two_factor_enabled: r.twoFactorEnabled ? "true" : "false",
    last_session_activity_iso: r.lastSessionActivityAtIso ?? "",
    event_pic_count: String(r.eventPicCount),
    pic_bank_account_owned_count: String(r.picBankAccountOwnedCount),
  }));

  const body =
    Papa.unparse(records, {
      columns: [
        "admin_profile_id",
        "email",
        "display_name",
        "role",
        "management_member_id",
        "member_summary",
        "two_factor_enabled",
        "last_session_activity_iso",
        "event_pic_count",
        "pic_bank_account_owned_count",
      ],
    }) + "\n";

  return `\ufeff${body}`;
}
