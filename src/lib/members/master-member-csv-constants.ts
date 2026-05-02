/** Header wajib (setelah normalisasi: lower + trim). */
export const MASTER_MEMBER_CSV_COLUMNS = [
  "member_number",
  "full_name",
  "whatsapp",
  "is_active",
  "is_management_member",
] as const;

export type MasterMemberCsvColumn =
  (typeof MASTER_MEMBER_CSV_COLUMNS)[number];

export const MAX_MASTER_MEMBER_IMPORT_BYTES = 2097152; // 2 MiB

export const MAX_MASTER_MEMBER_IMPORT_DATA_ROWS = 5000;
