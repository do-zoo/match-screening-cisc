# AdminProfile Operations & Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperkeras operasi `AdminProfile` dengan pra-cek penghapan (FK bermakna), menampakkan beban PIC/rekening di direktori komite, ekspor CSV untuk komite dan subset audit `admin_profile.*`, penyederhanaan filter audit bertipe-prefix, PIC combobox yang menyertakan email, serta aksi audit terpisah untuk cabut akses.

**Architecture:** Tetap pola **Owner-only** untuk mutasi komite (`guardOwner`) dan akses Pengaturan (`canManageCommitteeAdvancedSettings`). Logika blok penghapan dipisah dalam modul `lib/admin` yang dapat diuji; ekspor mengikuti pola `GET` route + builder CSV (Papa, BOM UTF-8) seperti `admin/members/export`. Query agregat `groupBy` memuat angka referensi tanpa N+1.

**Tech Stack:** Next.js App Router, Prisma, Vitest, Papa Parse, Better Auth tables via Prisma `User`/`Session`.

**Out of scope (YAGNI):** undangan email/token akun admin sebelum User ada, kolom `disabledAt` pada `AdminProfile`, perubahan skema Prisma.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/lib/admin/admin-profile-delete-guard.ts` | Hitung event-as-PIC & rekening milik profil; format pesan root error Indonesia. |
| `src/lib/admin/admin-profile-delete-guard.test.ts` | Tes fungsi murni format blokir. |
| `src/lib/actions/admin-committee-profiles.ts` | Panggil guard sebelum `delete`; log audit cabut akses dengan aksi baru. |
| `src/lib/actions/admin-committee-profiles.test.ts` | Mock `event.count` / `picBankAccount.count`; kasus terblokir. |
| `src/lib/audit/club-audit-actions.ts` | Konstanta `ADMIN_PROFILE_ACCESS_REVOKED`. |
| `src/lib/audit/load-recent-club-audit.ts` | `actionPrefix` pada `ClubAuditListFilters` + `buildClubAuditWhere`. |
| `src/lib/audit/club-audit-csv-export.ts` | Ambil hingga 10k baris + `buildClubAuditExportCsv`. |
| `src/app/admin/settings/security/audit-export/route.ts` | GET CSV audit; guard Owner; query `from`/`to`/`actionPrefix`. |
| `src/lib/admin/build-committee-admin-directory-export-csv.ts` | CSV dari `CommitteeAdminDirectoryVm`. |
| `src/app/admin/settings/committee/export/route.ts` | GET CSV direktori komite; guard Owner. |
| `src/lib/admin/load-committee-admin-directory.ts` | `eventPicCount`, `picBankAccountOwnedCount` per baris. |
| `src/components/admin/committee-admin-settings-panel.tsx` | Kolom tabel + link unduh CSV + `colSpan`. |
| `src/app/admin/settings/committee/page.tsx` | (Opsional) paragraf singkat tentang ekspor jika tidak hanya di panel. |
| `src/components/admin/club-audit-log-table.tsx` | Link ekspor CSV di dekat filter. |
| `src/lib/admin/pic-options-for-event.ts` | Sertakan email di `label` combobox PIC/helper. |

---

### Task 1: Modul guard penghapusan + tes murni

**Files:**
- Create: `src/lib/admin/admin-profile-delete-guard.ts`
- Create: `src/lib/admin/admin-profile-delete-guard.test.ts`
- Test: `pnpm vitest run src/lib/admin/admin-profile-delete-guard.test.ts`

- [ ] **Step 1: Buat modul guard**

Create `src/lib/admin/admin-profile-delete-guard.ts`:

```typescript
import { prisma } from "@/lib/db/prisma";

export type AdminProfileDeletionBlockers = {
  eventPicCount: number;
  picBankAccountOwnedCount: number;
};

export async function loadAdminProfileDeletionBlockers(
  adminProfileId: string,
): Promise<AdminProfileDeletionBlockers> {
  const [eventPicCount, picBankAccountOwnedCount] = await Promise.all([
    prisma.event.count({ where: { picAdminProfileId: adminProfileId } }),
    prisma.picBankAccount.count({
      where: { ownerAdminProfileId: adminProfileId },
    }),
  ]);
  return { eventPicCount, picBankAccountOwnedCount };
}

/** Null jika boleh lanjut hapus dari sisi FK PIC/rekening. */
export function formatAdminProfileDeleteBlockedMessage(
  b: AdminProfileDeletionBlockers,
): string | null {
  if (b.eventPicCount === 0 && b.picBankAccountOwnedCount === 0) {
    return null;
  }
  const parts: string[] = [];
  if (b.eventPicCount > 0) {
    parts.push(
      `profil menjadi PIC utama pada ${b.eventPicCount} acara — pindahkan PIC acara tersebut terlebih dahulu`,
    );
  }
  if (b.picBankAccountOwnedCount > 0) {
    parts.push(
      `profil memiliki ${b.picBankAccountOwnedCount} rekening PIC terdaftar — sesuaikan kepemilikan atau nonaktifkan rekening terlebih dahulu`,
    );
  }
  return `Tidak bisa menghapus: ${parts.join("; ")}.`;
}
```

- [ ] **Step 2: Tes pemformatan blokir**

Create `src/lib/admin/admin-profile-delete-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { formatAdminProfileDeleteBlockedMessage } from "./admin-profile-delete-guard";

describe("formatAdminProfileDeleteBlockedMessage", () => {
  it("returns null when both counts are zero", () => {
    expect(
      formatAdminProfileDeleteBlockedMessage({
        eventPicCount: 0,
        picBankAccountOwnedCount: 0,
      }),
    ).toBeNull();
  });

  it("mentions PIC events when pic count positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 2,
      picBankAccountOwnedCount: 0,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("PIC");
    expect(msg).toContain("2");
  });

  it("mentions bank accounts when ownership count positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 0,
      picBankAccountOwnedCount: 1,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("rekening");
  });

  it("combines both reasons when both positive", () => {
    const msg = formatAdminProfileDeleteBlockedMessage({
      eventPicCount: 1,
      picBankAccountOwnedCount: 3,
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain("PIC");
    expect(msg).toContain("rekening");
    expect(msg).toContain("; ");
  });
});
```

- [ ] **Step 3: Jalankan tes**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$(git rev-parse --show-toplevel)" && nvm use && pnpm vitest run src/lib/admin/admin-profile-delete-guard.test.ts
```

Expected: semua tes **PASS**.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/admin-profile-delete-guard.ts src/lib/admin/admin-profile-delete-guard.test.ts
git commit -m "feat(admin): add AdminProfile delete FK guard helpers"
```

---

### Task 2: Sambungkan guard ke `deleteCommitteeAdmin` + perbarui tes aksi

**Files:**
- Modify: `src/lib/actions/admin-committee-profiles.ts`
- Modify: `src/lib/actions/admin-committee-profiles.test.ts`
- Test: `pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts`

- [ ] **Step 1: Impor dan panggil guard sebelum delete**

Di `src/lib/actions/admin-committee-profiles.ts`, setelah validasi target ditemukan dan sebelum pengecekan hapus diri sendiri / Owner tunggal, tambahkan:

```typescript
import {
  formatAdminProfileDeleteBlockedMessage,
  loadAdminProfileDeletionBlockers,
} from "@/lib/admin/admin-profile-delete-guard";
```

Tepat **setelah** seluruh pengecekan **hapus diri sendiri** dan **minimal satu Owner** (blok yang memakai `roleChangePreservesAtLeastOneOwner`), dan **sebelum** `await prisma.adminProfile.delete({ ... })`:

```typescript
  const blockers = await loadAdminProfileDeletionBlockers(target.id);
  const blocked = formatAdminProfileDeleteBlockedMessage(blockers);
  if (blocked) {
    return rootError(blocked);
  }
```

- [ ] **Step 2: Perluas mock Prisma di tes**

Di `src/lib/actions/admin-committee-profiles.test.ts`, dalam `vi.mock("@/lib/db/prisma", () => ({ prisma: { ... } }))`, tambahkan:

```typescript
    event: { count: vi.fn() },
    picBankAccount: { count: vi.fn() },
```

- [ ] **Step 3: Reset mock count di beforeEach delete**

Dalam `describe("deleteCommitteeAdmin", () => { beforeEach(() => { ...`, tambahkan:

```typescript
    vi.mocked(prisma.event.count).mockReset();
    vi.mocked(prisma.picBankAccount.count).mockReset();
    vi.mocked(prisma.event.count).mockResolvedValue(0);
    vi.mocked(prisma.picBankAccount.count).mockResolvedValue(0);
```

- [ ] **Step 4: Tes baru — terblokir oleh PIC**

Tambahkan case:

```typescript
  it("blocks delete when profile is primary PIC on events", async () => {
    vi.mocked(prisma.adminProfile.findUnique).mockResolvedValueOnce({
      id: "p_pic",
      authUserId: "u_pic",
      role: AdminRole.Admin,
    } as never);
    vi.mocked(prisma.adminProfile.findMany).mockResolvedValueOnce([
      { authUserId: "actor_user" },
    ] as never);
    vi.mocked(prisma.event.count).mockResolvedValueOnce(1);
    vi.mocked(prisma.picBankAccount.count).mockResolvedValueOnce(0);

    const fd = new FormData();
    fd.set("adminProfileId", "p_pic");
    const r = await deleteCommitteeAdmin(undefined, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rootError).toContain("PIC");
    expect(vi.mocked(prisma.adminProfile.delete)).not.toHaveBeenCalled();
  });
```

- [ ] **Step 5: Jalankan tes**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$(git rev-parse --show-toplevel)" && nvm use && pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts
```

Expected: **PASS**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/admin-committee-profiles.ts src/lib/actions/admin-committee-profiles.test.ts
git commit -m "feat(admin): block AdminProfile delete when PIC or bank owner"
```

---

### Task 3: Aksi audit terpisah untuk cabut akses

**Files:**
- Modify: `src/lib/audit/club-audit-actions.ts`
- Modify: `src/lib/actions/admin-committee-profiles.ts`
- Test: `pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts`

- [ ] **Step 1: Tambah konstanta**

Di `src/lib/audit/club-audit-actions.ts`, dalam objek `CLUB_AUDIT_ACTION`, tambahkan setelah `ADMIN_PROFILE_ROLE_CHANGED`:

```typescript
  ADMIN_PROFILE_ACCESS_REVOKED: "admin_profile.access_revoked",
```

- [ ] **Step 2: Pakai di `revokeCommitteeAdminMeaningfulAccess`**

Di `src/lib/actions/admin-committee-profiles.ts`, pada pemanggilan `appendClubAuditLog` di dalam `revokeCommitteeAdminMeaningfulAccess`, ganti `action:` menjadi:

```typescript
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_ACCESS_REVOKED,
```

Metadata boleh tetap memuat `fromRole` / `toRole: Viewer` / `memberIdCleared` seperti sekarang.

- [ ] **Step 3: Jalankan tes & commit**

```bash
pnpm vitest run src/lib/actions/admin-committee-profiles.test.ts
```

Expected: **PASS**.

```bash
git add src/lib/audit/club-audit-actions.ts src/lib/actions/admin-committee-profiles.ts
git commit -m "feat(audit): distinct action for committee access revoke"
```

---

### Task 4: Filter audit `actionPrefix` + ekspor CSV audit

**Files:**
- Modify: `src/lib/audit/load-recent-club-audit.ts`
- Create: `src/lib/audit/club-audit-csv-export.ts`
- Create: `src/app/admin/settings/security/audit-export/route.ts`
- Modify: `src/components/admin/club-audit-log-table.tsx` (link unduh)
- Test: (opsional) unit kecil untuk `buildClubAuditWhere` — boleh lewati jika regresi manual; minimal `pnpm test` penuh di akhir.

- [ ] **Step 1: Perluas tipe filter dan where builder**

Di `src/lib/audit/load-recent-club-audit.ts`, pada `ClubAuditListFilters`, tambahkan field opsional:

```typescript
  /** Cocokkan awalan `action` (mis. `admin_profile.`). */
  actionPrefix?: string;
```

Di `buildClubAuditWhere`, setelah blok `action` exact, tambahkan:

```typescript
  const actionPrefix = filters.actionPrefix?.trim();
  if (actionPrefix) {
    clauses.push({ action: { startsWith: actionPrefix } });
  }
```

(Jika `action` dan `actionPrefix` keduanya diisi, keduanya harus terpenuhi — perilaku AND.)

- [ ] **Step 2: Modul ekspor CSV**

Create `src/lib/audit/club-audit-csv-export.ts`:

```typescript
import Papa from "papaparse";

import { prisma } from "@/lib/db/prisma";

import {
  buildClubAuditWhere,
  type ClubAuditListFilters,
  type ClubAuditRowVm,
} from "./load-recent-club-audit";

export const CLUB_AUDIT_EXPORT_MAX_ROWS = 10_000;

export type ClubAuditExportFilters = ClubAuditListFilters;

export async function loadClubAuditLogsForCsvExport(
  filters: ClubAuditExportFilters,
): Promise<ClubAuditRowVm[]> {
  const where = buildClubAuditWhere(filters);
  const rows = await prisma.clubAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: CLUB_AUDIT_EXPORT_MAX_ROWS,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actorAuthUserId: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: r.metadata,
    createdAtIso: r.createdAt.toISOString(),
    actorAuthUserId: r.actorAuthUserId,
  }));
}

export function buildClubAuditExportCsv(rows: ClubAuditRowVm[]): string {
  const records = rows.map((r) => ({
    id: r.id,
    created_at_utc: r.createdAtIso,
    action: r.action,
    actor_auth_user_id: r.actorAuthUserId,
    target_type: r.targetType ?? "",
    target_id: r.targetId ?? "",
    metadata_json: JSON.stringify(r.metadata ?? null),
  }));

  const body =
    Papa.unparse(records, {
      columns: [
        "id",
        "created_at_utc",
        "action",
        "actor_auth_user_id",
        "target_type",
        "target_id",
        "metadata_json",
      ],
    }) + "\n";

  return `\ufeff${body}`;
}
```

- [ ] **Step 3: Route GET ekspor**

Create `src/app/admin/settings/security/audit-export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

import { buildClubAuditExportCsv, loadClubAuditLogsForCsvExport } from "@/lib/audit/club-audit-csv-export";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

function firstString(param: string | null): string | undefined {
  if (param === null || param === undefined) return undefined;
  const t = param.trim();
  return t === "" ? undefined : t;
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = firstString(searchParams.get("from"));
  const to = firstString(searchParams.get("to"));
  const actionPrefix =
    firstString(searchParams.get("actionPrefix")) ?? "admin_profile.";

  const rows = await loadClubAuditLogsForCsvExport({
    from,
    to,
    actionPrefix,
  });

  const csv = buildClubAuditExportCsv(rows);
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `club-audit-${isoDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: Link di UI log audit**

Di `src/components/admin/club-audit-log-table.tsx`, tambahkan fungsi pembantu tepat di atas `ClubAuditLogSection` (atau di dalamnya sebelum JSX return):

```typescript
function buildAdminProfileAuditExportHref(filters: {
  from: string;
  to: string;
}): string {
  const p = new URLSearchParams();
  p.set("actionPrefix", "admin_profile.");
  const fromTrim = filters.from.trim();
  const toTrim = filters.to.trim();
  if (fromTrim) p.set("from", fromTrim);
  if (toTrim) p.set("to", toTrim);
  return `/admin/settings/security/audit-export?${p.toString()}`;
}
```

Di dalam `ClubAuditLogSection`, **setelah** `<ClubAuditLogFilters … />`, render:

```tsx
      <Link
        href={buildAdminProfileAuditExportHref(props.filters)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Unduh CSV (aksi profil admin, maks. 10.000 baris)
      </Link>
```

Pastikan `Link` dan `buttonVariants` sudah di-import (tambahkan `buttonVariants` jika belum di file yang sama dengan `ClubAuditLogFilters`).

- [ ] **Step 5: Lint & tes**

```bash
pnpm lint
pnpm test
```

Expected: **exit code 0**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit/load-recent-club-audit.ts src/lib/audit/club-audit-csv-export.ts src/app/admin/settings/security/audit-export/route.ts src/components/admin/club-audit-log-table.tsx
git commit -m "feat(audit): CSV export and actionPrefix for admin_profile audit slice"
```

---

### Task 5: Agregat PIC/rekening di direktori komite + ekspor CSV komite

**Files:**
- Modify: `src/lib/admin/load-committee-admin-directory.ts`
- Create: `src/lib/admin/build-committee-admin-directory-export-csv.ts`
- Create: `src/app/admin/settings/committee/export/route.ts`
- Modify: `src/components/admin/committee-admin-settings-panel.tsx`
- Test: `pnpm check-types` (dan `pnpm test` jika ada tes yang terkena tipe)

- [ ] **Step 1: Agregat `groupBy` dan field VM**

Di `src/lib/admin/load-committee-admin-directory.ts`:

1. Perluas `CommitteeAdminDirectoryRowVm` dengan:

```typescript
  eventPicCount: number;
  picBankAccountOwnedCount: number;
```

2. Setelah mengambil `profiles`, jalankan paralel (bisa digabung `Promise.all` dengan query yang ada):

```typescript
  const [eventPicGroups, bankGroups] = await Promise.all([
    prisma.event.groupBy({
      by: ["picAdminProfileId"],
      _count: { _all: true },
    }),
    prisma.picBankAccount.groupBy({
      by: ["ownerAdminProfileId"],
      _count: { _all: true },
    }),
  ]);

  const eventPicByProfile = new Map(
    eventPicGroups.map((g) => [g.picAdminProfileId, g._count._all]),
  );
  const bankByProfile = new Map(
    bankGroups.map((g) => [g.ownerAdminProfileId, g._count._all]),
  );
```

3. Saat memetakan `rows`, set:

```typescript
      eventPicCount: eventPicByProfile.get(p.id) ?? 0,
      picBankAccountOwnedCount: bankByProfile.get(p.id) ?? 0,
```

- [ ] **Step 2: Builder CSV**

Create `src/lib/admin/build-committee-admin-directory-export-csv.ts`:

```typescript
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
```

- [ ] **Step 3: Route ekspor**

Create `src/app/admin/settings/committee/export/route.ts` (mirror `members/export`):

```typescript
import { NextResponse } from "next/server";

import { buildCommitteeAdminDirectoryExportCsv } from "@/lib/admin/build-committee-admin-directory-export-csv";
import { loadCommitteeAdminDirectory } from "@/lib/admin/load-committee-admin-directory";
import { getAdminContext } from "@/lib/auth/admin-context";
import { requireAdminSession } from "@/lib/auth/session";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export async function GET() {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const directory = await loadCommitteeAdminDirectory();
  const csv = buildCommitteeAdminDirectoryExportCsv(directory);
  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `admin-komite-${isoDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: Tabel komite — kolom & link**

Di `src/components/admin/committee-admin-settings-panel.tsx`:

- Tambahkan header: **Acara (PIC)** dan **Rekening PIC**.
- Render `row.eventPicCount` dan `row.picBankAccountOwnedCount`.
- Perbarui `colSpan` baris kosong dari 7 → 9.
- Di samping judul "Admin terdaftar", tambahkan `Link` (button variant outline atau teks) ke `/admin/settings/committee/export` — teks: **Unduh CSV**.

- [ ] **Step 5: Verifikasi**

```bash
pnpm check-types
pnpm lint
pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/load-committee-admin-directory.ts src/lib/admin/build-committee-admin-directory-export-csv.ts src/app/admin/settings/committee/export/route.ts src/components/admin/committee-admin-settings-panel.tsx
git commit -m "feat(admin): committee directory usage columns and CSV export"
```

---

### Task 6: Label PIC/helper sertakan email

**Files:**
- Modify: `src/lib/admin/pic-options-for-event.ts`
- Test: tidak wajib file baru; smoke `pnpm test` global.

- [ ] **Step 1: Tambah fragmen email pada label**

Di `src/lib/admin/pic-options-for-event.ts`, dalam callback `profiles.map`, setelah `suffix` dibangun:

```typescript
    const email = u?.email?.trim();
    const emailFrag = email ? ` (${email})` : "";
    return { id: p.id, label: `${base}${suffix}${emailFrag}` };
```

- [ ] **Step 2: Lint & commit**

```bash
pnpm lint && pnpm test
git add src/lib/admin/pic-options-for-event.ts
git commit -m "feat(admin): show admin email in PIC combobox labels"
```

---

## Verifikasi akhir (wajib sebelum merge)

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$(git rev-parse --show-toplevel)" && nvm use && pnpm lint && pnpm test && pnpm check-types
```

Expected: semua **exit code 0**.

Smoke manual (singkat):

1. Masuk sebagai **Owner** → **Pengaturan → Komite** → unduh CSV; buka di Excel/Numbers cek kolom hitungan.
2. Coba hapus profil yang menjadi PIC acara nyata — harus pesan blokir, bukan error Prisma mentah.
3. **Pengaturan → Keamanan** → unduh CSV audit subset; pastikan baris `admin_profile.*` termasuk `admin_profile.access_revoked` setelah cabut akses.
4. Buat/edit acara — combobox PIC memuat email di label.

---

## Self-review (checklist penulis rencana)

1. **Cakupan desain brainstorming:** A (pra-cek FK + invariant yang sudah ada), B (transparansi beban profil; tanpa undangan), C (ekspor + filter prefix + aksi audit cabut), D (label PIC + kolom komite) — semua memiliki tugas.
2. **Placeholder:** Tidak ada TBD/TODO generik.
3. **Konsistensi tipe:** `CommitteeAdminDirectoryRowVm` diperluas di satu tempat; route komite memakai loader yang sama dengan halaman.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-admin-profile-operations-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Satu subagen per task, review antar task, iterasi cepat.

**2. Inline Execution** — Jalankan task dalam sesi ini dengan executing-plans, eksekusi berkelompok dengan checkpoint.

**Which approach?**
