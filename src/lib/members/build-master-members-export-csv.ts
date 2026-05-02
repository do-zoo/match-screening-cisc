import Papa from "papaparse";

import { MASTER_MEMBER_CSV_COLUMNS } from "./master-member-csv-constants";
import type { AdminMasterMemberRowVm } from "./query-admin-master-members";

/**
 * CSV konsisten kolom dengan template impor direktori (UTF-8 + BOM untuk Excel).
 */
export function buildMasterMembersExportCsv(
  rows: AdminMasterMemberRowVm[],
): string {
  const records = rows.map((r) => ({
    member_number: r.memberNumber,
    full_name: r.fullName,
    whatsapp: r.whatsapp ?? "",
    is_active: r.isActive ? "true" : "false",
    is_management_member: r.isManagementMember ? "true" : "false",
  }));

  const body =
    Papa.unparse(records, {
      columns: [...MASTER_MEMBER_CSV_COLUMNS],
    }) + "\n";

  return `\ufeff${body}`;
}
