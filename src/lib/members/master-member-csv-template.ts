import Papa from "papaparse";

import {
  MASTER_MEMBER_CSV_COLUMNS,
  type MasterMemberCsvColumn,
} from "./master-member-csv-constants";

const exampleRow: Record<MasterMemberCsvColumn, string> = {
  member_number: "CISC-0001",
  full_name: "Contoh Nama",
  whatsapp: "6281234567890",
  is_active: "true",
  is_pengurus: "false",
  can_be_pic: "true",
};

export function buildMasterMemberCsvTemplate(): string {
  return (
    Papa.unparse([exampleRow], {
      columns: [...MASTER_MEMBER_CSV_COLUMNS],
    }) + "\n"
  );
}
