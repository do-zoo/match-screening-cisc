# Admin Settings Phase D — Notifications, Security Surface, Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Melengkapi modul Pengaturan **Phase D**: *(1)* **Preferensi notifikasi keluar** tersimpan di Postgres dengan mode perilaku eksplisit dan **titik kirim terpisah** (stub, belum mengharuskan penyedia luar); *(2)* **Log audit append-only** untuk peristiwa sensitif Owner yang sudah ada di aplikasi, plus pembaca ringkas untuk Owner di **`/admin/settings/security`**; *(3)* **Dasar Better Auth two-factor**: plugin **`twoFactor` di server** + migrasi CLI (tanpa membangun alur setup QR penuh di `/admin/account` pada slice ini — dokumentasikan batasan di UI).

**Architecture:** Dua model singleton tambahan (`ClubNotificationPreferences`, tidak ada JSON opak konfigurasi penuh) + model **`ClubAuditLog`** relasi opsional ke `AdminProfile`. Helper **`appendClubAuditLog`** dipanggil setelah mutasi sukses pada Server Actions Owner yang sudah ada; kegagalan audit **tidak membatalkan** mutasi bisnis — **catat `console.error`** (satu kebijakan konsisten, mudah ditingkatkan ke fail-closed nanti). **`getAdminContext`** diperluas dengan **`profileId`** agar penulis audit tidak query ulang. Mode notifikasi **`log_only` / `live` / `off`** dipetakan oleh fungsi **`resolveOutboundNotifyBehaviour`** yang diuji Vitest — **kirim nyata pada slice ini dibatasi pada hook hook siap pakai**, bukan blasting email baru ke tamu registri.

**Tech Stack:** Prisma Postgres, Vitest (node), Next.js Server Actions / RSC, Better Auth **`^1.6.9`** + CLI migrate, pola `guardOwner`/`ActionResult`/`useActionState` seperti modul Pengaturan sebelumnya.

**Normative references:** [`docs/superpowers/specs/2026-05-02-admin-settings-modules-design.md`](../specs/2026-05-02-admin-settings-modules-design.md) §5.3, §5.5, §7 Phase D.

**Scope split (satu rencana, tiga paket commit yang direkomendasikan):** (A) Prisma + audit helper + `AdminContext`; (B) instrumentasi actions + halaman security; (C) notifikasi + auth plugin + halaman notifications.

---

## File map — penciptaan & tanggung jawab

| File | Tanggung jawab |
|------|----------------|
| `prisma/schema.prisma` | `NotificationOutboundMode` enum; models `ClubNotificationPreferences`, `ClubAuditLog`; relasi opsional `AdminProfile.auditEntries`; index waktu untuk audit. |
| `prisma/migrations/*/` | Migrasi DDL hasil CLI. |
| `src/lib/permissions/guards.ts` | Extend type `AdminContext` dengan **`profileId: string`**. |
| `src/lib/auth/admin-context.ts` | Populate **`profileId: profile.id`** dari query yang sama. |
| `src/tests/unit/admin-context-shape.test.ts` | Tes kontrak ringan: objek hasil `getAdminContext` mock memuat `profileId` (atau tes integrasi prisma memilih — lihat Task 2). |
| `src/lib/audit/club-audit-actions.ts` | Konstanta string **`as const`** untuk `action` (satu sumber kebenaran). |
| `src/lib/audit/sanitize-audit-metadata.ts` | Membatasi metadata ke struktur JSON aman (tanpa `BigInt`, fungsi, prototype). |
| `src/lib/audit/sanitize-audit-metadata.test.ts` | Tes strip `undefined`, kedalaman, panjang string. |
| `src/lib/audit/append-club-audit-log.ts` | `appendClubAuditLog(prisma, row)` — insert satu baris. |
| `src/lib/audit/load-recent-club-audit.ts` | `loadRecentClubAuditForOwnerSettings()` — 100 baris terbaru, `cache` React opsional. |
| `src/lib/notifications/notification-outbound-mode.ts` | `resolveOutboundNotifyBehaviour(mode)` + copy penjelasan mode (murni). |
| `src/lib/notifications/notification-outbound-mode.test.ts` | Tes cabang mode. |
| `src/lib/public/load-club-notification-preferences.ts` | `cache()` baca singleton; default enum `log_only`. |
| `src/lib/forms/club-notification-preferences-schema.ts` | Zod untuk field enum + label opsional. |
| `src/lib/actions/admin-club-notification-preferences.ts` | `saveClubNotificationPreferences` Owner + audit + revalidate. |
| `src/components/admin/club-notification-preferences-form.tsx` | `useActionState` + `Select` atau `RadioGroup` mode (shadcn). |
| `src/app/admin/settings/notifications/page.tsx` | RSC: prefetched row + form; salinan memisahkan “konfigurasi” vs “pengiriman”. |
| `src/lib/notifications/log-outbound-stub.ts` | `logOutboundStub(channel, payload)` — implementasi v1 hanya `console.log` terstruktur; dipanggil dari hook contoh (Task 10). |
| `src/app/admin/settings/security/page.tsx` | Ganti placeholder: jadwal audit + panel informasi 2FA + tautan `/admin/account`. |
| `src/components/admin/club-audit-log-table.tsx` | Tabel hasil `loadRecentClubAudit` (RSC-friendly: terima `rows` props). |
| `src/lib/auth/auth.ts` | Tambah plugin **`twoFactor({ issuer: "match-screening" })`** (server). |
| `scripts/bootstrap-admin.ts` | Setelah `upsert` profil: **`appendClubAuditLog`** acara `admin.profile.bootstrap_upsert`. |
| `src/lib/actions/guard.ts` | Tidak wajib diubah jika `guardOwner` sudah mengembalikan `AdminContext` yang diperluas — pastikan caller memakai nilai balik. |
| `src/lib/actions/admin-committee-pricing.ts` | Setelah upsert sukses: audit `committee_pricing.saved`. |
| `src/lib/actions/admin-club-wa-templates.ts` | Setelah save/reset sukses: audit dengan `targetId` = key template. |
| `src/lib/actions/admin-club-operational-settings.ts` | Setelah save sukses: audit ringkas boolean. |
| `src/lib/actions/admin-club-branding.ts` | Setelah save sukses: audit daftar field yang berubah (tanpa URL blob penuh). |
| `src/app/admin/settings/page.tsx` | Perbarui deskripsi kartu **Notifikasi** dan **Keamanan**. |

---

## Konstanta audit (salin persis ke `club-audit-actions.ts`)

```typescript
export const CLUB_AUDIT_ACTION = {
  COMMITTEE_PRICING_SAVED: "committee_pricing.saved",
  CLUB_WA_TEMPLATE_SAVED: "club_wa_template.saved",
  CLUB_WA_TEMPLATE_RESET: "club_wa_template.reset",
  CLUB_OPERATIONAL_SAVED: "club_operational.saved",
  CLUB_BRANDING_SAVED: "club_branding.saved",
  NOTIFICATION_PREFS_SAVED: "notification_preferences.saved",
  ADMIN_PROFILE_BOOTSTRAP_UPSERT: "admin_profile.bootstrap_upsert",
} as const;

export type ClubAuditAction =
  (typeof CLUB_AUDIT_ACTION)[keyof typeof CLUB_AUDIT_ACTION];
```

---

### Task 1: Prisma — enums + `ClubNotificationPreferences` + `ClubAuditLog`

**Files:**
- Modify: `prisma/schema.prisma`

Tambahkan **tepat di atas atau di bawah** blok enums yang ada:

```prisma
enum NotificationOutboundMode {
  off
  log_only
  live
}

model ClubNotificationPreferences {
  singletonKey String                     @id @default("default")
  outboundMode  NotificationOutboundMode @default(log_only)
  /// Label bebas untuk UI internal (mis. "Email komite").
  outboundLabel String?                  @db.VarChar(120)
  updatedAt     DateTime                 @updatedAt
}

model ClubAuditLog {
  id                  String        @id @default(cuid())
  actorAdminProfileId String?
  actorAuthUserId     String
  action              String        @db.VarChar(96)
  targetType          String?       @db.VarChar(64)
  targetId            String?       @db.VarChar(128)
  metadata            Json?
  createdAt           DateTime      @default(now())

  actorProfile AdminProfile? @relation(fields: [actorAdminProfileId], references: [id], onDelete: SetNull)

  @@index([createdAt(sort: Desc)])
  @@index([action])
}
```

Pada **`model AdminProfile`**, tambahkan relasi balik:

```prisma
  auditEntries ClubAuditLog[]
```

- [ ] **Step 1:** Edit semua blok di atas; pastikan sintaks Prism valid.

- [ ] **Step 2: Migrasi**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name club_notifications_and_audit_log
```

Expected: DDL sukses.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): notification preferences and club audit log"
```

---

### Task 2: `AdminContext.profileId`

**Files:**
- Modify: `src/lib/permissions/guards.ts`
- Modify: `src/lib/auth/admin-context.ts`

**`guards.ts`** — ubah definisi type:

```typescript
export type AdminContext = {
  profileId: string;
  role: AdminRole;
  helperEventIds: string[];
};
```

**`admin-context.ts`** — return value:

```typescript
  return {
    profileId: profile.id,
    role: profile.role as AdminRole,
    helperEventIds,
  };
```

- [ ] **Step 1:** Terapkan edit.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit
```

Expected: zero errors. Jika ada pemetaan objek literal `AdminContext` di test ganda, perbarui.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions/guards.ts src/lib/auth/admin-context.ts
git commit -m "feat(admin): include profileId on AdminContext"
```

---

### Task 3: Sanitasi metadata audit (TDD)

**Files:**
- Create: `src/lib/audit/sanitize-audit-metadata.ts`
- Create: `src/lib/audit/sanitize-audit-metadata.test.ts`

- [ ] **Step 1: Tes**

```typescript
import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

describe("sanitizeAuditMetadata", () => {
  it("returns null for undefined", () => {
    expect(sanitizeAuditMetadata(undefined)).toBeNull();
  });

  it("allows shallow string/number/boolean records", () => {
    expect(
      sanitizeAuditMetadata({ a: "x", n: 1, ok: true }),
    ).toEqual({ a: "x", n: 1, ok: true });
  });

  it("strips nested objects beyond depth 1 into string placeholder", () => {
    const out = sanitizeAuditMetadata({ outer: { inner: 1 } } as Record<
      string,
      unknown
    >);
    expect(out).toEqual({ outer: "[nested]" });
  });

  it("truncates long string values", () => {
    const long = "a".repeat(500);
    const out = sanitizeAuditMetadata({ k: long });
    expect(String(out?.k).length).toBeLessThanOrEqual(205);
    expect(String(out?.k)).toContain("...");
  });
});
```

- [ ] **Step 2: Gagalkan tes**

```bash
pnpm vitest run src/lib/audit/sanitize-audit-metadata.test.ts
```

Expected: FAIL (modul hilang).

- [ ] **Step 3: Implementasi**

```typescript
const MAX_DEPTH = 2;
const MAX_KEYS = 16;
const MAX_STRING = 200;

export function sanitizeAuditMetadata(
  input: unknown,
): Record<string, string | number | boolean | null> | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  let count = 0;
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (++count > MAX_KEYS) break;
    if (typeof val === "string") {
      out[key] =
        val.length > MAX_STRING ? `${val.slice(0, MAX_STRING)}…` : val;
    } else if (typeof val === "number" || typeof val === "boolean") {
      out[key] = val;
    } else if (val === null) {
      out[key] = null;
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      out[key] = "[nested]";
    } else {
      out[key] = String(val);
    }
  }
  return out;
}
```

Sesuaikan perilaku nested dengan asersi tes (placeholder `"[nested]"` untuk objek dalam).

- [ ] **Step 4: Luluskan**

```bash
pnpm vitest run src/lib/audit/sanitize-audit-metadata.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/sanitize-audit-metadata.ts src/lib/audit/sanitize-audit-metadata.test.ts
git commit -m "feat(audit): sanitize metadata for club audit log"
```

---

### Task 4: `appendClubAuditLog` + konstanta aksi

**Files:**
- Create: `src/lib/audit/club-audit-actions.ts` (isi dari bagian “Konstanta audit” di atas)
- Create: `src/lib/audit/append-club-audit-log.ts`

```typescript
import type { PrismaClient } from "@prisma/client";

import { sanitizeAuditMetadata } from "@/lib/audit/sanitize-audit-metadata";
import type { ClubAuditAction } from "@/lib/audit/club-audit-actions";

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function appendClubAuditLog(
  db: Db,
  row: {
    actorProfileId: string;
    actorAuthUserId: string;
    action: ClubAuditAction;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: unknown;
  },
): Promise<void> {
  const metadata = sanitizeAuditMetadata(row.metadata);
  try {
    await db.clubAuditLog.create({
      data: {
        actorAdminProfileId: row.actorProfileId,
        actorAuthUserId: row.actorAuthUserId,
        action: row.action,
        targetType: row.targetType ?? null,
        targetId: row.targetId ?? null,
        metadata: metadata === null ? undefined : metadata,
      },
    });
  } catch (e) {
    console.error("[clubAuditLog] insert failed", { action: row.action, e });
  }
}
```

- [ ] **Step 1:** Tambahkan file; perbaiki tipe `Db` jika TypeScript proyek membatasi — gunakan **`import type { Prisma } from "@prisma/client"`** dan **`Prisma.TransactionClient`** bila perlu.

- [ ] **Step 2: Commit**

```bash
git add src/lib/audit/club-audit-actions.ts src/lib/audit/append-club-audit-log.ts
git commit -m "feat(audit): append-only club audit log writer"
```

---

### Task 5: Muat audit untuk halaman Keamanan

**Files:**
- Create: `src/lib/audit/load-recent-club-audit.ts`

```typescript
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export type ClubAuditRowVm = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAtIso: string;
  actorAuthUserId: string;
};

export const loadRecentClubAuditForOwnerSettings = cache(
  async (): Promise<ClubAuditRowVm[]> => {
    const rows = await prisma.clubAuditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
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
  },
);
```

- [ ] **Step 1:** Tambahkan file.

- [ ] **Step 2: Commit**

```bash
git add src/lib/audit/load-recent-club-audit.ts
git commit -m "feat(audit): load recent rows for settings security page"
```

---

### Task 6: Komponen tabel audit + halaman Security

**Files:**
- Create: `src/components/admin/club-audit-log-table.tsx`
- Modify: `src/app/admin/settings/security/page.tsx`

**`club-audit-log-table.tsx`** — komponen server (tanpa `"use client"`):

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ClubAuditRowVm } from "@/lib/audit/load-recent-club-audit";

export function ClubAuditLogTable(props: { rows: ClubAuditRowVm[] }) {
  if (props.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada peristiwa audit tercatat.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Waktu (UTC)</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Sasaran</TableHead>
            <TableHead>Aktor (auth user id)</TableHead>
            <TableHead>Metadata</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs whitespace-nowrap">
                {r.createdAtIso}
              </TableCell>
              <TableCell className="font-mono text-xs">{r.action}</TableCell>
              <TableCell className="font-mono text-xs">
                {r.targetType ?? "—"}
                {r.targetId ? ` / ${r.targetId}` : ""}
              </TableCell>
              <TableCell className="max-w-[140px] truncate font-mono text-xs">
                {r.actorAuthUserId}
              </TableCell>
              <TableCell className="max-w-md font-mono text-[11px] break-all text-muted-foreground">
                {r.metadata == null ? "—" : JSON.stringify(r.metadata)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**`security/page.tsx`** — pola seperti branding: breadcrumb, judul, teks pembuka dalam Bahasa Indonesia yang menjelaskan **2FA**: plugin server Better Auth akan ditambahkan di Task 11; **setup TOTP/UI penuh** belum ada pada slice ini — arahkan pengguna ke **`/admin/account`** untuk rotasi kata sandi; tautan dokumentasi **`https://www.better-auth.com/docs/plugins/two-factor`** sebagai referensi pembaca ops.

Panggil `const rows = await loadRecentClubAuditForOwnerSettings();` lalu `<ClubAuditLogTable rows={rows} />`.

- [ ] **Step 1:** Pastikan **`Table`** sudah ada di `src/components/ui/table.tsx` (shadcn); jika belum, pasang komponen melewati `pnpm dlx shadcn@latest add table` sesuai `components.json` proyek.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/club-audit-log-table.tsx src/app/admin/settings/security/page.tsx
git commit -m "feat(admin): security settings page with audit log table"
```

---

### Task 7: Instrumentasi audit pada Server Actions Owner (bisnis)

**Files:**
- Modify: `src/lib/actions/admin-committee-pricing.ts`
- Modify: `src/lib/actions/admin-club-wa-templates.ts`
- Modify: `src/lib/actions/admin-club-operational-settings.ts`
- Modify: `src/lib/actions/admin-club-branding.ts`

Pola umum setelah **`guardOwner()`** berhasil:

```typescript
const ctx = await guardOwner();
```

Setelah mutasi DB sukses dan **sebelum** `revalidatePath` / `return ok(...)`:

```typescript
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";

await appendClubAuditLog(prisma, {
  actorProfileId: ctx.profileId,
  actorAuthUserId: /* session user id — ambil dari requireAdminSession sekali di action */,
  action: CLUB_AUDIT_ACTION.COMMITTEE_PRICING_SAVED,
  targetType: "committee_ticket_defaults",
  targetId: COMMITTEE_TICKET_DEFAULTS_KEY,
  metadata: { ticketMemberPrice, ticketNonMemberPrice },
});
```

**Penting:** Impor **`requireAdminSession`** dari `@/lib/auth/session` di setiap file action di atas, panggil **sekali** setelah `guardOwner` (atau gabungkan helper `getSessionUserId` kecil di `session.ts` jika belum ada) — gunakan **`session.user.id`** sebagai `actorAuthUserId`.

**WA templates:** metadata `{ key: string }` saja, **bukan** teks penuh template.

**Branding:** metadata `{ changed: ["clubNameNav", "footer", "logo"] }` — deteksi perubahan logo jika `File` `size>0`.

**Operational:** metadata `{ registrationGloballyDisabled: boolean }`.

- [ ] **Step 1:** Terapkan di keempat file.

- [ ] **Step 2: Tes manual singkat** — simpan harga default di dev, buka `/admin/settings/security`, pastikan baris **`committee_pricing.saved`** muncul.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-committee-pricing.ts src/lib/actions/admin-club-wa-templates.ts src/lib/actions/admin-club-operational-settings.ts src/lib/actions/admin-club-branding.ts src/lib/auth/session.ts
git commit -m "feat(audit): record owner settings mutations in club audit log"
```

*(Jika `session.ts` tidak perlu diubah, jangan sertakan dalam `git add`.)*

---

### Task 8: Bootstrap script — audit `admin_profile.bootstrap_upsert`

**Files:**
- Modify: `scripts/bootstrap-admin.ts`

Setelah `upsert` **sukses**, panggil:

```typescript
import { appendClubAuditLog } from "@/lib/audit/append-club-audit-log";
import { CLUB_AUDIT_ACTION } from "@/lib/audit/club-audit-actions";

await appendClubAuditLog(prisma, {
  actorProfileId: admin.id,
  actorAuthUserId: userId,
  action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_BOOTSTRAP_UPSERT,
  targetType: "admin_profile",
  targetId: admin.id,
  metadata: { email, role },
});
```

- [ ] **Step 1:** Tambahkan impor dan panggilan.

- [ ] **Step 2: Commit**

```bash
git add scripts/bootstrap-admin.ts
git commit -m "feat(audit): log bootstrap admin profile upsert"
```

---

### Task 9: Mode notifikasi keluar (murni + tes)

**Files:**
- Create: `src/lib/notifications/notification-outbound-mode.ts`
- Create: `src/lib/notifications/notification-outbound-mode.test.ts`

```typescript
import type { NotificationOutboundMode } from "@prisma/client";

export type OutboundNotifyBehaviour = {
  shouldLogToConsole: boolean;
  shouldAttemptProviderSend: boolean;
};

/** Memetakan preferensi tersimpan ke perilaku runtime v1 (stub vs live). */
export function resolveOutboundNotifyBehaviour(
  mode: NotificationOutboundMode,
): OutboundNotifyBehaviour {
  switch (mode) {
    case "off":
      return { shouldLogToConsole: false, shouldAttemptProviderSend: false };
    case "live":
      return { shouldLogToConsole: true, shouldAttemptProviderSend: true };
    case "log_only":
    default:
      return { shouldLogToConsole: true, shouldAttemptProviderSend: false };
  }
}
```

Tes: asersi tiga mode.

- [ ] **Step 1:** Implementasi + tes.

```bash
pnpm vitest run src/lib/notifications/notification-outbound-mode.test.ts
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications/notification-outbound-mode.ts src/lib/notifications/notification-outbound-mode.test.ts
git commit -m "feat(notifications): outbound mode resolution helper"
```

---

### Task 10: Preferensi tersimpan + stub log + hook contoh

**Files:**
- Create: `src/lib/public/load-club-notification-preferences.ts`
- Create: `src/lib/notifications/log-outbound-stub.ts`
- Create: `src/lib/forms/club-notification-preferences-schema.ts`
- Create: `src/lib/actions/admin-club-notification-preferences.ts`
- Create: `src/components/admin/club-notification-preferences-form.tsx`
- Modify: `src/app/admin/settings/notifications/page.tsx`

**Loader:**

```typescript
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const CLUB_NOTIFICATION_PREFS_KEY = "default" as const;

export const loadClubNotificationPreferences = cache(async () => {
  const row = await prisma.clubNotificationPreferences.findUnique({
    where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
  });
  return {
    outboundMode: row?.outboundMode ?? "log_only",
    outboundLabel: row?.outboundLabel ?? "",
  };
});
```

**Stub:**

```typescript
import { loadClubNotificationPreferences } from "@/lib/public/load-club-notification-preferences";
import { resolveOutboundNotifyBehaviour } from "@/lib/notifications/notification-outbound-mode";

/** Contoh hook kirim v1: baca preferensi + log terstruktur. Pengiriman provider nyata ditambahkan saat env siap. */
export async function logOutboundPerPreferences(
  channel: string,
  payload: Record<string, string | number | boolean | null>,
): Promise<void> {
  const prefs = await loadClubNotificationPreferences();
  const b = resolveOutboundNotifyBehaviour(prefs.outboundMode);
  if (!b.shouldLogToConsole && !b.shouldAttemptProviderSend) return;
  if (b.shouldLogToConsole) {
    console.log("[outbound]", channel, { ...payload, mode: prefs.outboundMode });
  }
  if (b.shouldAttemptProviderSend) {
    // Intentionally empty in Phase D slice — wire Resend/SMTP in a follow-up.
  }
}
```

**Zod schema** — validasi `outboundMode` dengan `z.enum(["off", "log_only", "live"])` dan `outboundLabel` optional max 120.

**Server action** `saveClubNotificationPreferences` — pola `guardOwner`, upsert singleton, `appendClubAuditLog` dengan `CLUB_AUDIT_ACTION.NOTIFICATION_PREFS_SAVED`, metadata `{ outboundMode }`, `revalidatePath("/admin/settings/notifications")`.

**Form klien** — `useActionState` + `Select` untuk mode + `Input` label opsional.

**Halaman notifications** — ganti placeholder.

- [ ] **Step 1:** Implementasi lengkap.

- [ ] **Step 2: Commit**

```bash
git add src/lib/public/load-club-notification-preferences.ts src/lib/notifications/log-outbound-stub.ts src/lib/forms/club-notification-preferences-schema.ts src/lib/actions/admin-club-notification-preferences.ts src/components/admin/club-notification-preferences-form.tsx src/app/admin/settings/notifications/page.tsx
git commit -m "feat(admin): notification preferences and outbound stub"
```

---

### Task 11: Better Auth — plugin `twoFactor` (server)

**Files:**
- Modify: `src/lib/auth/auth.ts`

Ikuti skill lokal **`.claude/skills/two-factor-authentication-best-practices/SKILL.md`** §Setup.

```typescript
import { twoFactor } from "better-auth/plugins";
```

Tambahkan ke array `plugins` **setelah** `nextCookies()`:

```typescript
    twoFactor({
      issuer: "match-screening",
    }),
```

- [ ] **Step 1:** Edit `auth.ts`.

- [ ] **Step 2: Migrasi Better Auth CLI**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm auth:migrate
```

Expected: kolom terkait 2FA ada pada model `User` / tabel BA (cek output CLI).

- [ ] **Step 3:** Tambahkan kalimat pada **`/admin/settings/security`** menjelaskan bahwa **enrollment TOTP** memerlukan pekerjaan UI terpisah (tidak menghalangi slice ini).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/auth.ts
git commit -m "feat(auth): enable Better Auth two-factor server plugin"
```

*(Migrasi BA sering menghasilkan file baru di `prisma`/Better Auth schema — **`git status`** dan stage semua artefak terkait.)*

---

### Task 12: Hub Pengaturan — salinan kartu

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1:** Ganti **`description`** untuk **Notifikasi** dan **Keamanan** agar mencerminkan persistensi baru (bahasa Indonesia, tanpa jargon “Phase D” untuk pengguna akhir).

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "docs(admin): hub copy for notifications and security"
```

---

### Task 13: Gates kualitas

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test && pnpm build
```

Expected: semua PASS; ESLint boleh mempertahankan peringatan `data-table.tsx` yang sudah ada selama tidak ada error baru.

---

## Spec coverage checklist (internal)

| Butir spek | Task |
|-----------|------|
| §5.3 preferensi saluran terpisah dari pengiriman | Task 9–10, `log-outbound-stub` |
| §5.3 pengiriman nyata opsional sampai provider | Task 10 `shouldAttemptProviderSend` kosong |
| §5.5 audit append-only kolom utama | Tasks 1, 4–6 |
| §5.5 peristiwa min.: harga default, WA, flags operasi, dll. | Tasks 7 (pricing, WA, ops, branding), 8 bootstrap |
| §5.5 2FA hanya Better Auth | Task 11 |
| §8 tes helper murni | Tasks 3, 9 |

## Placeholder scan

Tidak memakai TBD/TODO/lelang validasi tanpa kodifikasi konkret dalam langkah di atas.

---

Plan complete dan disimpan sebagai `docs/superpowers/plans/2026-05-02-admin-settings-phase-d-notifications-security-audit.md`.

**Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — subagent baru per task besar, review antara task.

**2. Inline Execution** — jalankan tugas bertahap dalam sesi ini memakai skil executing-plans dengan checkpoint.

Mana yang Anda pilih?
