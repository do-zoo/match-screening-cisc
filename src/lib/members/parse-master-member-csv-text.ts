import Papa from "papaparse";

import {
  MASTER_MEMBER_CSV_COLUMNS,
  MAX_MASTER_MEMBER_IMPORT_DATA_ROWS,
  type MasterMemberCsvColumn,
} from "./master-member-csv-constants";

export type ParsedMasterMemberCsvRow = {
  lineNumberPhysical: number;
  cells: Record<string, string>;
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Legacy CSV header; normalized rows expose `is_management_member` only. */
const LEGACY_IS_MANAGEMENT_MEMBER_HEADER = "is_pengurus";

const COLUMN_SET = new Set<string>(MASTER_MEMBER_CSV_COLUMNS);

function isMasterMemberCsvColumn(k: string): k is MasterMemberCsvColumn {
  return COLUMN_SET.has(k);
}

/** @throws Error Bahasa Indonesia jika struktur kolom salah atau terlalu banyak baris data. */
export function parseMasterMemberCsvText(csvText: string): {
  rows: ParsedMasterMemberCsvRow[];
} {
  const trimmed = csvText.trim();
  const parsed = Papa.parse<Record<string, string>>(trimmed || "\n", {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  const fieldsHeader =
    parsed.meta.fields?.map(normalizeHeader).filter(Boolean) ?? [];
  const hasManagementMemberColumn =
    fieldsHeader.includes("is_management_member") ||
    fieldsHeader.includes(LEGACY_IS_MANAGEMENT_MEMBER_HEADER);
  if (!hasManagementMemberColumn) {
    throw new Error(
      `Kolom CSV wajib tidak ada: "is_management_member" (atau "${LEGACY_IS_MANAGEMENT_MEMBER_HEADER}" untuk kompatibilitas).`,
    );
  }
  for (const col of MASTER_MEMBER_CSV_COLUMNS) {
    if (col === "is_management_member") continue;
    if (!fieldsHeader.includes(col)) {
      throw new Error(`Kolom CSV wajib tidak ada: "${col}".`);
    }
  }

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error("Tidak ada baris data setelah header.");
  }

  if (parsed.data.length > MAX_MASTER_MEMBER_IMPORT_DATA_ROWS) {
    throw new Error(
      `Jumlah baris data melebihi batas (${MAX_MASTER_MEMBER_IMPORT_DATA_ROWS.toLocaleString("id-ID")}).`,
    );
  }

  const rows: ParsedMasterMemberCsvRow[] = parsed.data.map((record, i) => {
    const clean: Record<string, string> = {};
    let legacyManagementMember: string | undefined;
    for (const [k, v] of Object.entries(record)) {
      const nk = normalizeHeader(k);
      if (nk === LEGACY_IS_MANAGEMENT_MEMBER_HEADER) {
        legacyManagementMember =
          typeof v === "string" ? v : String(v ?? "");
        continue;
      }
      if (isMasterMemberCsvColumn(nk)) {
        clean[nk] = typeof v === "string" ? v : String(v ?? "");
      }
    }
    if (
      clean.is_management_member === undefined ||
      clean.is_management_member === ""
    ) {
      if (legacyManagementMember !== undefined) {
        clean.is_management_member = legacyManagementMember;
      }
    }
    return { lineNumberPhysical: i + 2, cells: clean };
  });

  return { rows };
}
