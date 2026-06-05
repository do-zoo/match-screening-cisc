import Papa from 'papaparse'

import { MASTER_MEMBER_CSV_COLUMNS, type MasterMemberCsvColumn } from './master-member-csv-constants'

const exampleRows: Record<MasterMemberCsvColumn, string>[] = [
  {
    member_number: 'CISC-0001',
    full_name: 'Contoh Nama',
    whatsapp: '6281234567890',
    email: 'contoh@email.com',
    is_active: 'true',
    is_management_member: 'false',
  },
  {
    member_number: 'CISC-0002',
    full_name: 'Contoh Tanpa WA',
    whatsapp: '',
    email: '',
    is_active: 'true',
    is_management_member: 'false',
  },
]

export function buildMasterMemberCsvTemplate(): string {
  return (
    Papa.unparse(exampleRows, {
      columns: [...MASTER_MEMBER_CSV_COLUMNS],
    }) + '\n'
  )
}
