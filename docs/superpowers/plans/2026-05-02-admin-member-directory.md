# Admin direktori anggota (`MasterMember` + impor CSV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menuju **`/admin/anggota`**, menyediakan tabel+pencarian+filter aktivitas, form tambah/edit anggota, dan impor CSV upsert parsial bertingkat dengan ringkasan hasil dan unduhan CSV error—hanya untuk **Owner/Admin**.

**Architecture:** Lapisan pure di `src/lib/members/` (boolean CSV, pemeriksaan satu-baris fisik per record, pembentukan patch upsert dari satu baris) diuji oleh Vitest. Mutasi berada di **`src/lib/actions/admin-master-members.ts`** memanggil **`guardOwnerOrAdmin()`** dan **`prisma`**, menghasilkan **`ActionResult`**. Halaman **`src/app/admin/anggota/page.tsx`** menjadi RSC: query daftar dari shared query helper; menghapus kartu placeholder. UI klien tersusun di komponen admin kecil untuk tabel/filter, dialog form, zona impor dengan `useTransition`.

**Tech stack:** Next.js 16 App Router, React 19, Prisma (`MasterMember`), Zod v4 (sama seperti form admin lain), `papaparse` untuk parse/unparse CSV, Vitest (`pnpm test`), ESLint (`pnpm lint`).

**Deviation from written spec (`2026-05-02-admin-member-directory-design.md`):** Spesifikasi menyebut rute **`/admin/members`**. Sidebar dan placeholder yang ada memakai **`/admin/anggota`**—implementasi **menggunakan `anggota`** agar konsisten navigasi tanpa pemeliharaan dua URL (opsional kemudian: redirect `301 /admin/members` → `/admin/anggota` di luar lingkup rencana ini).

**Spec:** `docs/superpowers/specs/2026-05-02-admin-member-directory-design.md`

---

## File map

| Path | Responsibility |
|------|----------------|
| `package.json` / `pnpm-lock.yaml` | Tambah dependency runtime `papaparse` untuk parse CSV + `Papa.unparse` laporan gagal |
| `src/lib/members/master-member-csv-constants.ts` | Konstanta nama kolom, batas **`MAX_IMPORT_BYTES`** (2097152) dan **`MAX_DATA_ROWS`** (5000). |
| `src/lib/members/master-member-csv-boolean.ts` | `interpretMasterMemberCsvBoolean(cell: string \| undefined \| null): boolean \| undefined` — empty/whitespace ⇒ `undefined`; token valid ⇒ booleans Case-insensitive. |
| `src/lib/members/master-member-csv-boolean.test.ts` | Pengujian token true/false/undefined. |
| `src/lib/members/master-member-csv-single-line-record.ts` | `assertCsvTextSingleLinePhysicalRecords(csvText: string): void \| never` — lempar jika ada pemisah baris CRLF/LF dalam rentang kutip ganda ASCII (sesuai asumsi **satu rekaman fisik = satu garis**) agar **`baris` = indeks rekaman data + 1** selaras §5.4. |
| `src/lib/members/master-member-csv-single-line-record.test.ts` | Contoh kutip bermasalah / file valid satu baris. |
| `src/lib/members/parse-master-member-csv-text.ts` | `parseMasterMemberCsvText(csvText)` ⇒ `{ dataRows }` bertipe `{ lineNumberPhysical: number; cells: Record<string,string> }[]` dibentuk lewat Papa `header:true`, `skipEmptyLines:"greedy"`, `transformHeader` → huruf kecil + trim; map hasil ke **`lineNumberPhysical = dataIndex + 2`**. |
| `src/lib/members/parse-master-member-csv-text.test.ts` | Header wajib, kolom ekstra diabaikan, baris kosong di-skip. |
| `src/lib/members/prepare-master-member-csv-row.ts` | Pure: **`prepareMasterMemberCsvRow(...)`** membangun `duplicate \| reject \| ok` dan memelihara `Map` `nomorLower → baris pertama` untuk deteksi duplikat satu file |
| `src/lib/members/prepare-master-member-csv-row.test.ts` | Dup dalam file; nomor kosong; `maybe` booleans hilang dari patch |
| `src/lib/members/master-member-csv-prisma-data.ts` | `masterMemberCsvPatchToCreateData(patch, canonicalMemberNumber)` dan **`masterMemberCsvPatchToUpdateData(patch)`** — hanya menyertakan kunci dengan nilai terdefinisi |
| `src/lib/forms/admin-master-member-schema.ts` | Schema Zod `adminMasterMemberCreateSchema` dan `adminMasterMemberUpdateSchema` — update **tanpa** `memberNumber`; create wajib unik bentuknya cerminan model. |
| `src/lib/members/query-admin-master-members.ts` | `listMasterMembersForAdmin({ search, activityFilter })` ⇒ `Promise<RowVm[]>` memakai `where` Prisma gabungan substring case-insensitive `memberNumber`, `fullName`, filter `isActive`. |
| `src/lib/actions/admin-master-members.ts` | `createMasterMember`, `updateMasterMember`, `importMasterMembersCsv` (FormData **`file`**), `generateMasterMemberCsvTemplate` bisa route GET handler atau tombol **`data:text/csv`** — rencana: **server action pengembalian** string template base64 atau client `Papa.unparse` header + contoh dari shared constant untuk mengurangi roundtrip—pilih **`src/lib/members/master-member-csv-template.ts`** export `MASTER_MEMBER_CSV_TEMPLATE` string. |
| `src/app/admin/anggota/page.tsx` | RSC: ambil rows, serahkan ke wrapper klien. |
| `src/components/admin/members-admin-page.tsx` | Client: state pencarian, filter, tabel, dialog, impor (satu modul boleh dipecah jika >400 baris). |
| `src/components/admin/member-form-dialog.tsx` | Form RHF+Zod `adminMasterMember*Schema`, panggil server action. |
| `src/components/admin/member-csv-import-panel.tsx` | `<input type="file" accept=".csv,text/csv" />`, ringkasan, unduh error blob. |

---

### Task 1: Tambah `papaparse`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (via install)

- [ ] **Step 1: Pasang dependensi**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm add papaparse
```

Expected: `papaparse` muncul di `dependencies`, lockfile ter-update.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add papaparse for admin member CSV import"
```

---

### Task 2: Boolean CSV + unit test (TDD)

**Files:**
- Create: `src/lib/members/master-member-csv-boolean.ts`
- Create: `src/lib/members/master-member-csv-boolean.test.ts`

- [ ] **Step 1: Tulis tes yang gagal**

`src/lib/members/master-member-csv-boolean.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { interpretMasterMemberCsvBoolean } from "./master-member-csv-boolean";

describe("interpretMasterMemberCsvBoolean", () => {
  it("returns undefined for undefined, null, empty, whitespace", () => {
    expect(interpretMasterMemberCsvBoolean(undefined)).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean(null)).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean("")).toBeUndefined();
    expect(interpretMasterMemberCsvBoolean("   ")).toBeUndefined();
  });

  it("parses true tokens case-insensitively", () => {
    for (const t of ["true", "TRUE", "1", "yes", "Y", "iya", "IyA"]) {
      expect(interpretMasterMemberCsvBoolean(t), t).toBe(true);
    }
  });

  it("parses false tokens case-insensitively", () => {
    for (const t of ["false", "FALSE", "0", "no", "N", "tidak", "Tidak"]) {
      expect(interpretMasterMemberCsvBoolean(t), t).toBe(false);
    }
  });

  it("returns undefined for unknown text (partial update semantics)", () => {
    expect(interpretMasterMemberCsvBoolean("maybe")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Jalankan Vitest — harus FAIL**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/members/master-member-csv-boolean.test.ts
```

Expected: modul tidak ditemukan / fungsi tidak terdefinisi.

- [ ] **Step 3: Implementasi minimal**

`src/lib/members/master-member-csv-boolean.ts`:

```typescript
/**
 * Sel kosong ⇒ undefined (jangan ubah field).
 * Teks tidak dikenali ⇒ undefined (bukan error), selaras spesifikasi §5.3.
 */
export function interpretMasterMemberCsvBoolean(
  cell: string | undefined | null,
): boolean | undefined {
  if (cell === undefined || cell === null) return undefined;
  const t = cell.trim();
  if (!t) return undefined;
  const u = t.toLowerCase();
  if (["true", "1", "yes", "y", "iya"].includes(u)) return true;
  if (["false", "0", "no", "n", "tidak"].includes(u)) return false;
  return undefined;
}
```

- [ ] **Step 4: Jalankan Vitest — harus PASS**

```bash
pnpm vitest run src/lib/members/master-member-csv-boolean.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/members/master-member-csv-boolean.ts src/lib/members/master-member-csv-boolean.test.ts
git commit -m "feat(members): interpret CSV boolean cells for directory import"
```

---

### Task 3: Pra-validasi “satu garis fisik per rekaman”

**Files:**
- Create: `src/lib/members/master-member-csv-single-line-record.ts`
- Create: `src/lib/members/master-member-csv-single-line-record.test.ts`

- [ ] **Step 1: Tes**

`src/lib/members/master-member-csv-single-line-record.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { assertCsvTextSingleLinePhysicalRecords } from "./master-member-csv-single-line-record";

describe("assertCsvTextSingleLinePhysicalRecords", () => {
  it("allows simple one-line records", () => {
    expect(() =>
      assertCsvTextSingleLinePhysicalRecords(
        "member_number,full_name\n001,Alice\n002,Bob\n",
      ),
    ).not.toThrow();
  });

  it("throws when a quoted field spans a newline", () => {
    expect(() =>
      assertCsvTextSingleLinePhysicalRecords(
        'member_number,full_name\n001,"Line1\nLine2"\n',
      ),
    ).toThrow(/multiline tidak didukung/i);
  });
});
```

- [ ] **Step 2: Implementasi**

`src/lib/members/master-member-csv-single-line-record.ts`:

```typescript
/** Memastikan tidak ada LF/CRLF di dalam kutip ASCII ganda (`"`), agar pemetaan rekaman-ke-baris fisik stabil. */
export function assertCsvTextSingleLinePhysicalRecords(csvText: string): void {
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    if (c === '"') {
      const next = csvText[i + 1];
      if (inQuotes && next === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes && (c === "\n" || c === "\r")) {
      throw new Error(
        "CSV multiline tidak didukung — hilangkan newline di dalam tanda kutip.",
      );
    }
  }
}
```

- [ ] **Step 3: Vitest PASS**

```bash
pnpm vitest run src/lib/members/master-member-csv-single-line-record.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/members/master-member-csv-single-line-record.ts src/lib/members/master-member-csv-single-line-record.test.ts
git commit -m "feat(members): reject multiline CSV fields for deterministic row numbers"
```

---

### Task 4: Konstanta kolom + parser teks CSV

**Files:**
- Create: `src/lib/members/master-member-csv-constants.ts`
- Create: `src/lib/members/parse-master-member-csv-text.ts`
- Create: `src/lib/members/parse-master-member-csv-text.test.ts`

- [ ] **Step 1: Konstanta**

`src/lib/members/master-member-csv-constants.ts`:

```typescript
/** Header wajib (setelah normalisasi: lower + trim). */
export const MASTER_MEMBER_CSV_COLUMNS = [
  "member_number",
  "full_name",
  "whatsapp",
  "is_active",
  "is_pengurus",
  "can_be_pic",
] as const;

export type MasterMemberCsvColumn = (typeof MASTER_MEMBER_CSV_COLUMNS)[number];

export const MAX_MASTER_MEMBER_IMPORT_BYTES = 2097152; // 2 MiB

export const MAX_MASTER_MEMBER_IMPORT_DATA_ROWS = 5000;
```

- [ ] **Step 2: Parser + tes**

Importer `papaparse` di uji dengan string kecil. `parse-master-member-csv-text.ts`:

```typescript
import Papa from "papaparse";

import {
  MASTER_MEMBER_CSV_COLUMNS,
  MAX_MASTER_MEMBER_IMPORT_DATA_ROWS,
} from "./master-member-csv-constants";

export type ParsedMasterMemberCsvRow = {
  /** Baris pertama file header = 1; baris pertama data = 2. */
  lineNumberPhysical: number;
  cells: Record<string, string>;
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
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

  const fieldsHeader = parsed.meta.fields?.map(normalizeHeader) ?? [];
  for (const col of MASTER_MEMBER_CSV_COLUMNS) {
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
    for (const [k, v] of Object.entries(record)) {
      const nk = normalizeHeader(k);
      if (MASTER_MEMBER_CSV_COLUMNS.includes(nk as MasterMemberCsvColumn)) {
        clean[nk] = typeof v === "string" ? v : String(v ?? "");
      }
    }
    return { lineNumberPhysical: i + 2, cells: clean };
  });

  return { rows };
}
```

Tes singkat: header lengkap, dua baris data, `lineNumberPhysical` 2 dan 3.

- [ ] **Step 3: Perbaiki impor tipe `MasterMemberCsvColumn`** — gunakan `import type` dan `satisfies` jika perlu agar `includes` type-narrow aman.

- [ ] **Step 4: Vitest + commit**

```bash
pnpm vitest run src/lib/members/parse-master-member-csv-text.test.ts
git add src/lib/members/master-member-csv-constants.ts src/lib/members/parse-master-member-csv-text.ts src/lib/members/parse-master-member-csv-text.test.ts
git commit -m "feat(members): parse member directory CSV with required headers"
```

---

### Task 5: Siapkan baris CSV (pure) + map duplikat + tes

**Files:**
- Create: `src/lib/members/prepare-master-member-csv-row.ts`
- Create: `src/lib/members/prepare-master-member-csv-row.test.ts`

- [ ] **Step 1: Implementasi lengkap**

`src/lib/members/prepare-master-member-csv-row.ts`:

```typescript
import { interpretMasterMemberCsvBoolean } from "./master-member-csv-boolean";

export type MasterMemberCsvWritablePatch = {
  fullName?: string;
  whatsapp?: string | null;
  isPengurus?: boolean;
  isActive?: boolean;
  canBePIC?: boolean;
};

export type PreparedMasterMemberCsvRow =
  | {
      tag: "duplicate";
      lineNumberPhysical: number;
      memberNumber: string;
      firstLineNumber: number;
    }
  | { tag: "reject"; lineNumberPhysical: number; reasons: string[] }
  | {
      tag: "ok";
      lineNumberPhysical: number;
      canonicalMemberNumber: string;
      patch: MasterMemberCsvWritablePatch;
      requiresFullNameForCreate: boolean;
    };

/**
 * @param memberNumberFirstLine — `new Map()`; diisi `lowercase(member_number)` → baris pertama file untuk nomor itu.
 */
export function prepareMasterMemberCsvRow(
  lineNumberPhysical: number,
  cells: Record<string, string>,
  memberNumberFirstLine: Map<string, number>,
): PreparedMasterMemberCsvRow {
  const rawNum = (cells.member_number ?? "").trim();
  if (!rawNum) {
    return {
      tag: "reject",
      lineNumberPhysical,
      reasons: ["Nomor member wajib."],
    };
  }

  const keyLower = rawNum.toLowerCase();
  const firstLineNumber = memberNumberFirstLine.get(keyLower);
  if (firstLineNumber !== undefined) {
    return {
      tag: "duplicate",
      lineNumberPhysical,
      memberNumber: rawNum,
      firstLineNumber,
    };
  }
  memberNumberFirstLine.set(keyLower, lineNumberPhysical);

  const patch: MasterMemberCsvWritablePatch = {};
  const nameTrim = (cells.full_name ?? "").trim();
  if (nameTrim) patch.fullName = nameTrim;

  const waTrim = (cells.whatsapp ?? "").trim();
  if (waTrim) patch.whatsapp = waTrim;

  const active = interpretMasterMemberCsvBoolean(cells.is_active);
  if (active !== undefined) patch.isActive = active;
  const pengurus = interpretMasterMemberCsvBoolean(cells.is_pengurus);
  if (pengurus !== undefined) patch.isPengurus = pengurus;
  const pic = interpretMasterMemberCsvBoolean(cells.can_be_pic);
  if (pic !== undefined) patch.canBePIC = pic;

  return {
    tag: "ok",
    lineNumberPhysical,
    canonicalMemberNumber: rawNum,
    patch,
    requiresFullNameForCreate: !nameTrim,
  };
}
```

- [ ] **Step 2: Tes Vitest**

```typescript
import { describe, expect, it } from "vitest";

import {
  prepareMasterMemberCsvRow,
  type PreparedMasterMemberCsvRow,
} from "./prepare-master-member-csv-row";

describe("prepareMasterMemberCsvRow", () => {
  it("records first line and flags second duplicate member_number", () => {
    const m = new Map<string, number>();
    const cells = (full_name: string) => ({
      member_number: "M-01",
      full_name,
      whatsapp: "",
      is_active: "",
      is_pengurus: "",
      can_be_pic: "",
    });
    const a = prepareMasterMemberCsvRow(2, cells("A"), m);
    const b = prepareMasterMemberCsvRow(3, cells("B"), m);
    expect((a as Extract<PreparedMasterMemberCsvRow, { tag: "ok" }>).tag).toBe(
      "ok",
    );
    expect(b).toEqual({
      tag: "duplicate",
      lineNumberPhysical: 3,
      memberNumber: "M-01",
      firstLineNumber: 2,
    });
  });

  it("rejects empty member_number", () => {
    const m = new Map<string, number>();
    const r = prepareMasterMemberCsvRow(
      2,
      {
        member_number: "  ",
        full_name: "",
        whatsapp: "",
        is_active: "",
        is_pengurus: "",
        can_be_pic: "",
      },
      m,
    );
    expect(r.tag).toBe("reject");
  });

  it("omits unknown boolean token from patch", () => {
    const m = new Map<string, number>();
    const r = prepareMasterMemberCsvRow(
      2,
      {
        member_number: "X",
        full_name: "N",
        whatsapp: "",
        is_active: "maybe",
        is_pengurus: "",
        can_be_pic: "",
      },
      m,
    );
    expect(r.tag).toBe("ok");
    expect(
      Object.prototype.hasOwnProperty.call(
        (r as { patch: Record<string, unknown> }).patch,
        "isActive",
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Vitest + commit**

```bash
pnpm vitest run src/lib/members/prepare-master-member-csv-row.test.ts
git add src/lib/members/prepare-master-member-csv-row.ts src/lib/members/prepare-master-member-csv-row.test.ts
git commit -m "feat(members): prepare CSV rows with in-file duplicate detection"
```

---

### Task 5b: Pemetaan patch CSV → payload Prisma

**Files:**
- Create: `src/lib/members/master-member-csv-prisma-data.ts`
- Create: `src/lib/members/master-member-csv-prisma-data.test.ts`

- [ ] **Step 1: Implementasi**

```typescript
import type { Prisma } from "@prisma/client";

import type { MasterMemberCsvWritablePatch } from "./prepare-master-member-csv-row";

export function masterMemberCsvPatchToUpdateData(
  patch: MasterMemberCsvWritablePatch,
): Prisma.MasterMemberUpdateInput {
  const data: Prisma.MasterMemberUpdateInput = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.whatsapp !== undefined) data.whatsapp = patch.whatsapp;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.isPengurus !== undefined) data.isPengurus = patch.isPengurus;
  if (patch.canBePIC !== undefined) data.canBePIC = patch.canBePIC;
  return data;
}

export function masterMemberCsvPatchToCreateData(
  patch: MasterMemberCsvWritablePatch,
  canonicalMemberNumber: string,
): Prisma.MasterMemberCreateInput {
  if (!patch.fullName?.trim()) {
    throw new Error("INTERNAL: fullName harus ada sebelum create");
  }
  return {
    memberNumber: canonicalMemberNumber,
    fullName: patch.fullName.trim(),
    whatsapp: patch.whatsapp ?? null,
    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    ...(patch.isPengurus !== undefined ? { isPengurus: patch.isPengurus } : {}),
    ...(patch.canBePIC !== undefined ? { canBePIC: patch.canBePIC } : {}),
  };
}
```

`master-member-csv-prisma-data.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import {
  masterMemberCsvPatchToCreateData,
  masterMemberCsvPatchToUpdateData,
} from "./master-member-csv-prisma-data";

describe("masterMemberCsvPatchToUpdateData", () => {
  it("returns empty Prisma fragment for empty patch", () => {
    expect(masterMemberCsvPatchToUpdateData({})).toEqual({});
  });

  it("maps only defined scalar keys", () => {
    expect(
      masterMemberCsvPatchToUpdateData({
        fullName: "A",
        whatsapp: null,
      }),
    ).toEqual({ fullName: "A", whatsapp: null });
  });
});

describe("masterMemberCsvPatchToCreateData", () => {
  it("throws if full name missing", () => {
    expect(() => masterMemberCsvPatchToCreateData({}, "MN-01")).toThrow(
      /INTERNAL/,
    );
  });

  it("trim fullName and merges optional booleans", () => {
    expect(
      masterMemberCsvPatchToCreateData({ fullName: "  X ", isActive: true }, "MN-01"),
    ).toEqual({
      memberNumber: "MN-01",
      fullName: "X",
      whatsapp: null,
      isActive: true,
    });
  });
});
```

- [ ] **Step 2: Vitest + commit**

```bash
pnpm vitest run src/lib/members/master-member-csv-prisma-data.test.ts
git add src/lib/members/master-member-csv-prisma-data.ts src/lib/members/master-member-csv-prisma-data.test.ts
git commit -m "feat(members): map CSV patches to Prisma payloads"
```

---

### Task 6: Zod form admin

**Files:**
- Create: `src/lib/forms/admin-master-member-schema.ts`

- [ ] **Step 1: Schema**

```typescript
import { z } from "zod";

const memberNumberSchema = z.string().trim().min(1, "Nomor member wajib.");
const nameSchema = z.string().trim().min(1, "Nama wajib.");

export const adminMasterMemberCreateSchema = z.object({
  memberNumber: memberNumberSchema,
  fullName: nameSchema,
  whatsapp: z.union([z.string().trim().max(64), z.literal("")]).optional(),
  isActive: z.boolean(),
  isPengurus: z.boolean(),
  canBePIC: z.boolean(),
});

export const adminMasterMemberUpdateSchema = z.object({
  id: z.string().min(1),
  fullName: nameSchema,
  whatsapp: z.union([z.string().trim().max(64), z.literal("")]).optional(),
  isActive: z.boolean(),
  isPengurus: z.boolean(),
  canBePIC: z.boolean(),
});

export type AdminMasterMemberCreateInput = z.infer<
  typeof adminMasterMemberCreateSchema
>;
export type AdminMasterMemberUpdateInput = z.infer<
  typeof adminMasterMemberUpdateSchema
>;
```

Sesuaikan `max(64)` dengan kebutuhan riil (cek schema Prisma `whatsapp` `String?` tanpa `@db.VarChar` — gunakan batas konservatif mis. 32 atau hilangkan max jika tidak perlu).

- [ ] **Step 2: Commit**

```bash
git add src/lib/forms/admin-master-member-schema.ts
git commit -m "feat(forms): zod schemas for admin master member CRUD"
```

---

### Task 7: Query daftar + server actions

**Files:**
- Create: `src/lib/members/query-admin-master-members.ts`
- Create: `src/lib/members/master-member-csv-template.ts`
- Create: `src/lib/actions/admin-master-members.ts`

- [ ] **Step 1: Query**

`listMasterMembersForAdmin` menerima `{ q?: string; filter: "all" | "active" | "inactive" }`, mengembalikan array terurut `updatedAt desc`, `take: 500` (cukup v1; dokumen di UI jika terpotong).

Filter `where`:

```typescript
const search = q?.trim();
const where = {
  AND: [
    filter === "active" ? { isActive: true } : {},
    filter === "inactive" ? { isActive: false } : {},
    search
      ? {
          OR: [
            { memberNumber: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {},
  ],
};
```

- [ ] **Step 2: Template CSV**

`master-member-csv-template.ts`:

```typescript
import Papa from "papaparse";

import { MASTER_MEMBER_CSV_COLUMNS } from "./master-member-csv-constants";

const exampleRow: Record<MasterMemberCsvColumn, string> = {
  member_number: "CISC-0001",
  full_name: "Contoh Nama",
  whatsapp: "6281234567890",
  is_active: "true",
  is_pengurus: "false",
  can_be_pic: "true",
};

type MasterMemberCsvColumn = (typeof MASTER_MEMBER_CSV_COLUMNS)[number];

export function buildMasterMemberCsvTemplate(): string {
  return (
    Papa.unparse([exampleRow], {
      columns: [...MASTER_MEMBER_CSV_COLUMNS],
    }) + "\n"
  );
}
```

Perbaiki urutan tipe — impor `MasterMemberCsvColumn` dari constants.

- [ ] **Step 3: Actions — `admin-master-members.ts` (termasuk impor lengkap)**

`src/lib/actions/admin-master-members.ts` (implementasi utama; pangkas hanya komentar bila Anda ingin lebih ringkas—logika tidak boleh menyimpang dari berikut):

```typescript
"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { guardOwnerOrAdmin, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import {
  adminMasterMemberCreateSchema,
  adminMasterMemberUpdateSchema,
} from "@/lib/forms/admin-master-member-schema";
import { fieldError, ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { MAX_MASTER_MEMBER_IMPORT_BYTES } from "@/lib/members/master-member-csv-constants";
import {
  masterMemberCsvPatchToCreateData,
  masterMemberCsvPatchToUpdateData,
} from "@/lib/members/master-member-csv-prisma-data";
import { assertCsvTextSingleLinePhysicalRecords } from "@/lib/members/master-member-csv-single-line-record";
import { parseMasterMemberCsvText } from "@/lib/members/parse-master-member-csv-text";
import { prepareMasterMemberCsvRow } from "@/lib/members/prepare-master-member-csv-row";

export type MasterMemberImportResult = {
  successCount: number;
  failureCount: number;
  errorCsvBase64: string | null;
};

type ErrorRowCsv = {
  baris: number;
  member_number: string;
  full_name: string;
  alasan: string;
};

export async function importMasterMembersCsv(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<MasterMemberImportResult>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return rootError("Berkas CSV wajib diunggah.");
  }
  if (file.size > MAX_MASTER_MEMBER_IMPORT_BYTES) {
    return rootError("Berkas terlalu besar (maks. 2 MiB).");
  }

  const text = await file.text();

  try {
    assertCsvTextSingleLinePhysicalRecords(text);
  } catch (e) {
    return rootError(
      e instanceof Error ? e.message : "Format CSV tidak valid.",
    );
  }

  let rows: ReturnType<typeof parseMasterMemberCsvText>["rows"];
  try {
    rows = parseMasterMemberCsvText(text).rows;
  } catch (e) {
    return rootError(
      e instanceof Error ? e.message : "CSV tidak dapat dibaca.",
    );
  }

  const memberFirstLine = new Map<string, number>();
  const errors: ErrorRowCsv[] = [];
  let successCount = 0;

  for (const row of rows) {
    const fullNameMirror = row.cells.full_name?.trim() ?? "";
    const prep = prepareMasterMemberCsvRow(
      row.lineNumberPhysical,
      row.cells,
      memberFirstLine,
    );

    if (prep.tag === "duplicate") {
      errors.push({
        baris: prep.lineNumberPhysical,
        member_number: prep.memberNumber,
        full_name: fullNameMirror,
        alasan: `Duplikat nomor member dalam berkas (baris pertama: ${prep.firstLineNumber}).`,
      });
      continue;
    }

    if (prep.tag === "reject") {
      errors.push({
        baris: prep.lineNumberPhysical,
        member_number: fullNameMirror,
        full_name: fullNameMirror,
        alasan: prep.reasons.join(" "),
      });
      continue;
    }

    try {
      const existing = await prisma.masterMember.findFirst({
        where: {
          memberNumber: {
            equals: prep.canonicalMemberNumber,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (existing) {
        const data = masterMemberCsvPatchToUpdateData(prep.patch);
        if (Object.keys(data).length === 0) {
          successCount += 1;
        } else {
          await prisma.masterMember.update({
            where: { id: existing.id },
            data,
          });
          successCount += 1;
        }
      } else if (prep.requiresFullNameForCreate) {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan: "Nama wajib untuk anggota baru.",
        });
      } else {
        const data = masterMemberCsvPatchToCreateData(
          prep.patch,
          prep.canonicalMemberNumber,
        );
        await prisma.masterMember.create({ data });
        successCount += 1;
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan: "Konflik unik pada nomor member (duplikat di basis data).",
        });
      } else {
        errors.push({
          baris: prep.lineNumberPhysical,
          member_number: prep.canonicalMemberNumber,
          full_name: fullNameMirror,
          alasan:
            e instanceof Error ? e.message : "Galat tidak terduga pada basis data.",
        });
      }
    }
  }

  const failureCount = errors.length;
  const errorCsvBase64 =
    errors.length === 0
      ? null
      : Buffer.from(
          Papa.unparse(errors, {
            columns: ["baris", "member_number", "full_name", "alasan"],
          }),
          "utf8",
        ).toString("base64");

  revalidatePath("/admin/anggota");
  return ok({ successCount, failureCount, errorCsvBase64 });
}

export async function createMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = formData.get("payload");
  let parsed: unknown = null;
  if (typeof rawPayload === "string") {
    try {
      parsed = JSON.parse(rawPayload) as unknown;
    } catch {
      parsed = null;
    }
  }
  const z = adminMasterMemberCreateSchema.safeParse(parsed);
  if (!z.success) return { ok: false, fieldErrors: zodToFieldErrors(z.error) };

  const whatsappStored =
    z.data.whatsapp && z.data.whatsapp.trim().length > 0
      ? z.data.whatsapp.trim()
      : null;

  try {
    const row = await prisma.masterMember.create({
      data: {
        memberNumber: z.data.memberNumber.trim(),
        fullName: z.data.fullName.trim(),
        whatsapp: whatsappStored,
        isActive: z.data.isActive,
        isPengurus: z.data.isPengurus,
        canBePIC: z.data.canBePIC,
      },
      select: { id: true },
    });
    revalidatePath("/admin/anggota");
    return ok({ id: row.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fieldError({
        memberNumber: "Nomor member sudah dipakai.",
      });
    }
    throw e;
  }
}

export async function updateMasterMember(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const rawPayload = formData.get("payload");
  let parsed: unknown = null;
  if (typeof rawPayload === "string") {
    try {
      parsed = JSON.parse(rawPayload) as unknown;
    } catch {
      parsed = null;
    }
  }
  const z = adminMasterMemberUpdateSchema.safeParse(parsed);
  if (!z.success) return { ok: false, fieldErrors: zodToFieldErrors(z.error) };

  const whatsappStored =
    z.data.whatsapp && z.data.whatsapp.trim().length > 0
      ? z.data.whatsapp.trim()
      : null;

  await prisma.masterMember.update({
    where: { id: z.data.id },
    data: {
      fullName: z.data.fullName.trim(),
      whatsapp: whatsappStored,
      isActive: z.data.isActive,
      isPengurus: z.data.isPengurus,
      canBePIC: z.data.canBePIC,
    },
    select: { id: true },
  });
  revalidatePath("/admin/anggota");
  return ok({ id: z.data.id });
}
```

**Catatan Prisma:** jika pembanding **`mode: "insensitive"`** pada kolom Postgres **tanpa collation** gagal dibuild, gantilah dengan pola `WHERE lower(memberNumber) = lower($input)` menggunakan `operator` dokumentasi Prisma 7 Anda; uji cepat satu `pnpm build` setelah scaffold.

- [ ] **Step 4: Tambah `query-admin-master-members.ts` + `master-member-csv-template.ts`** sesuai langkah 1–2 di atas (templat impor `MasterMemberCsvColumn` diimpor dari `master-member-csv-constants`).

- [ ] **Step 5: `pnpm lint` + `pnpm test` + commit**

```bash
pnpm lint && pnpm test
git add src/lib/members/query-admin-master-members.ts src/lib/members/master-member-csv-template.ts src/lib/actions/admin-master-members.ts
git commit -m "feat(admin): master member list query and CSV import actions"
```

(Butir `git add` boleh memasukkan berkas pure Task 5–5b jika belum ter-commit di cabang kerja.)

---

### Task 8: UI halaman anggota

**Files:**
- Modify: `src/app/admin/anggota/page.tsx`
- Create: `src/components/admin/members-admin-page.tsx`
- Create: `src/components/admin/member-form-dialog.tsx`
- Create: `src/components/admin/member-csv-import-panel.tsx`

- [ ] **Step 1: RSC page**

`page.tsx` memanggil `listMasterMembersForAdmin` dengan default `filter: "all"`, `q: ""` — pencarian di klien memanggil `router.replace` dengan `?q=&filter=` atau gunakan state klien saja dengan fetch — **YAGNI URL:** state lokal + **refetch** lewat `useRouter().refresh()` setelah mutation cukup; initial data dari props.

Patokan: terima `initialRows` sebagai prop serializer JSON-safe.

- [ ] **Step 2: Komponen klien** — pola shadcn `Table`, `Input`, `Button`, `@base-ui/react` `Dialog` memakai `render` seperti di `CLAUDE.md`. Filter radio/toggle tiga negara. Tombol Unduh templat CSV: `href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}` atau string dari `buildMasterMemberCsvTemplate` diinjeksikan sebagai `templateCsv` dari server sebagai prop server.

- [ ] **Step 3: Form dialog** — `useForm`, `useTransition`, pemanggilan `createMasterMember`, tangani `fieldErrors`.

- [ ] **Step 4: Impor** — `<form action={importMasterMembersCsv}>` atau `startTransition(async ()=>{ await importMasterMembersCsv(...) })`; decode `errorCsvBase64` ke Blob dan `download`.

- [ ] **Step 5: `pnpm lint` + smoke `pnpm exec tsc --noEmit` jika ada skrip—jika tidak, `pnpm build` opsional berat → minimal `pnpm lint`**

```bash
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/anggota/page.tsx src/components/admin/members-admin-page.tsx src/components/admin/member-form-dialog.tsx src/components/admin/member-csv-import-panel.tsx
git commit -m "feat(admin): members directory UI with CRUD and CSV import"
```

---

### Task 9: Uji menyeluruh manual + penyesuaian akhir

- [ ] **Step 1: Jalankan tes**

```bash
pnpm vitest run
```

Expected: semua tes hijau termasuk baru.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

- [ ] **Step 3: Verifikasi manual singkat**

1. Login sebagai Owner/Admin, buka `http://localhost:3000/admin/anggota`.
2. Tambah anggota baru; ubah nama; toggle nonaktif.
3. Unduh templat CSV, sunting satu baris, unggah; pastikan upsert berjalan.
4. Verifier login (jika ada seed): pastikan `notFound`/403 pada `/admin/anggota`.

- [ ] **Step 4: Commit kosongkie jika ada perbaikan kecil dari langkah tes**

---

## Spec coverage checklist (self-review)

| Kebutuhan § | Task |
|-------------|------|
| Akses Owner/Admin, `guardOwnerOrAdmin` | Task 7 |
| `/admin/anggota` daftar+pencarian+filter aktivitas | Task 7 query + Task 8 UI |
| CRUD anggota, `memberNumber` read-only pada edit | Task 6 schema + Task 7/8 dialog |
| Impor CSV, upsert parsial, best effort | Task 4–5 + Task 7 |
| Duplikat nomor satu file → baris berikut gagal | Task 5 `prepareMasterMemberCsvRow` |
| Upsert parsial → payload Prisma | Task 5b |
| Lapor error `baris` + nama kolom §5.4 | Task 7 `Papa.unparse` (**asumsi satu garis fisik** § Task 3) |
| Batas 2 MiB / 5000 baris | Task 1/4/constants + Task 7 pre-check ukuran |
| Template CSV disarankan | Task 7 template + Task 8 unduh |

**Placeholder scan:** Tidak ada “TBD/TODO”; loop impor lengkap ada di Task 7 Step 3.

**Type consistency:** `MasterMemberCsvColumn` didefinisikan sekali di `master-member-csv-constants.ts` dan diimpor di template + parser + tes agar tidak drift.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-admin-member-directory.md`. Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — subagent baru per task, review antar task, iterasi cepat  
**2. Inline Execution** — jalankan task di sesi ini memakai executing-plans dengan checkpoint

**Mau yang mana?**
