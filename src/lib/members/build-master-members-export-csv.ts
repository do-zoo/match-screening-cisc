import Papa from 'papaparse'

import { MASTER_MEMBER_CSV_COLUMNS } from './master-member-csv-constants'
import type { AdminMasterMemberRowVm } from './query-admin-master-members'

/** Kolom ekspor: template impor + `id` internal (diabaikan saat impor ulang). */
export const MASTER_MEMBER_EXPORT_CSV_COLUMNS = ['id', ...MASTER_MEMBER_CSV_COLUMNS] as const

/**
 * CSV konsisten kolom dengan template impor direktori (UTF-8 + BOM untuk Excel),
 * ditambah kolom `id` untuk referensi internal.
 */
export function buildMasterMembersExportCsv(rows: AdminMasterMemberRowVm[]): string {
  const records = rows.map(r => ({
    id: r.id,
    member_number: r.memberNumber,
    full_name: r.fullName,
    whatsapp: r.whatsapp ?? '',
    email: r.email ?? '',
    is_active: r.isActive ? 'true' : 'false',
    is_management_member: r.isManagementMember ? 'true' : 'false',
  }))

  const body =
    Papa.unparse(records, {
      columns: [...MASTER_MEMBER_EXPORT_CSV_COLUMNS],
    }) + '\n'

  return `\ufeff${body}`
}
