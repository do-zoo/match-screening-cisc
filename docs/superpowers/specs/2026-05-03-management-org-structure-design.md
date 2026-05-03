# Management Org Structure — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Overview

Upgrade fitur manajemen kepengurusan untuk mendukung:
1. Multiple assignment per member (satu orang bisa punya banyak jabatan, satu jabatan bisa dipegang banyak orang)
2. Hierarki jabatan (tree dengan kedalaman bebas, tiap jabatan punya flag `isUnique`)
3. Tampilan struktur organisasi pohon di period detail (toggle table ↔ tree)
4. Export CSV (data) dan PDF (dokumen terstruktur) per periode

Fitur ini admin-only. Tidak ada halaman publik.

---

## Bagian 1 — Schema

### `BoardRole` — 2 field baru

```prisma
model BoardRole {
  id           String      @id @default(cuid())
  title        String
  sortOrder    Int         @default(0)
  isActive     Boolean     @default(true)
  isUnique     Boolean     @default(true)   // true = max 1 assignment per periode
  parentRoleId String?
  parent       BoardRole?  @relation("RoleHierarchy", fields: [parentRoleId], references: [id], onDelete: SetNull)
  children     BoardRole[] @relation("RoleHierarchy")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assignments BoardAssignment[]

  @@index([isActive, sortOrder])
  @@index([parentRoleId])
}
```

### `BoardAssignment` — hapus kedua unique constraint

```prisma
model BoardAssignment {
  id                 String           @id @default(cuid())
  boardPeriodId      String
  boardPeriod        BoardPeriod      @relation(fields: [boardPeriodId], references: [id], onDelete: Cascade)
  managementMemberId String
  managementMember   ManagementMember @relation(fields: [managementMemberId], references: [id], onDelete: Cascade)
  boardRoleId        String
  boardRole          BoardRole        @relation(fields: [boardRoleId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Tidak ada @@unique — enforcement isUnique dilakukan di server action
  @@index([boardPeriodId, managementMemberId])
  @@index([boardPeriodId, boardRoleId])
}
```

### Enforcement `isUnique` di server action

Saat `createBoardAssignment`:
- Jika `boardRole.isUnique === true`, cek apakah sudah ada `BoardAssignment` dengan `boardPeriodId + boardRoleId` yang sama
- Jika sudah ada → return `rootError("Jabatan ini hanya boleh dipegang 1 orang per periode.")`

Saat `updateBoardAssignment` (ganti jabatan):
- Lakukan cek yang sama, kecualikan assignment yang sedang diedit

---

## Bagian 2 — UI Manajemen Jabatan

### `ManagementRoleFormDialog` — tambah 2 field

1. **Parent Role** — `<Select>` opsional, pilih jabatan induk. Hanya tampilkan jabatan `isActive = true`. Saat edit, kecualikan jabatan itu sendiri dan seluruh turunannya (mencegah circular reference).
2. **Kapasitas** — radio/select: "Hanya 1 orang" (`isUnique: true`, default) atau "Boleh banyak orang" (`isUnique: false`)

### Halaman Daftar Jabatan (`/admin/management/roles`)

Tabel dirender dalam urutan **depth-first** (induk → anak → cucu, lanjut ke saudara). Kolom:

| Jabatan | Kapasitas | Status | Urutan | Aksi |
|---------|-----------|--------|--------|------|

- Indentasi `└─` pada kolom Jabatan menunjukkan level kedalaman (1 `└─` per level)
- Kapasitas: badge "1 orang" (hijau) atau "Banyak" (biru)
- **Saat filter/search aktif**: tabel kembali ke mode flat tanpa indentasi

---

## Bagian 3 — Period Detail: Toggle Table / Tree

### Toggle view

Tombol di pojok kanan atas area tabel:
```
[ ☰ Daftar ]  [ 🌳 Struktur ]
```

State disimpan di URL: `?view=tree` atau tanpa param (default = daftar).

### View: Daftar (default)

Tabel flat yang ada sekarang. Karena satu orang kini bisa punya banyak jabatan, baris per `BoardAssignment` (bukan per member). Filter linked/unlinked dan search tetap berfungsi.

### View: Struktur (tree)

- Data di-fetch sebagai pohon: semua `BoardRole` + assignments untuk periode ini, diurutkan depth-first
- Dirender secara rekursif di client sebagai React component
- Jabatan tanpa assignment tetap ditampilkan (greyed out) agar struktur terlihat lengkap
- Jabatan `isUnique=false` menampilkan semua nama pemegang dalam satu baris
- Klik baris jabatan → buka dialog tambah/ubah assignment untuk jabatan tersebut

---

## Bagian 4 — Export

### Export CSV

- Tombol "Export CSV" di period detail page (tersedia di kedua view)
- Server action mengembalikan file CSV dengan header:
  `Jabatan, Jabatan Induk, Kapasitas, Nama Pengurus, Kode Publik, Terhubung ke Direktori`
- Diurutkan depth-first sesuai hierarki
- Jabatan belum diisi tetap muncul (kolom nama/kode kosong)
- RFC 4180 compliant (mengikuti pola `lib/reports/csv.ts` yang sudah ada)

### Export PDF

- Tombol "Export PDF" di period detail page
- Server route (`GET /admin/management/[periodId]/export.pdf`) generate PDF menggunakan `@react-pdf/renderer`
- Layout: dokumen teks berstruktur dengan indentasi (bukan kotak-kotak grafis)
- Header dokumen: nama organisasi, label periode, rentang tanggal
- Tiap jabatan: judul dengan indentasi sesuai kedalaman, diikuti daftar nama pemegang
- Jabatan kosong: ditampilkan dengan tanda "(belum diisi)"

---

## Bagian 5 — Relasi AdminProfile → ManagementMember

### Perubahan schema

`AdminProfile.memberId → MasterMember` **dihapus** dan diganti dengan relasi langsung ke `ManagementMember`:

```prisma
model AdminProfile {
  // HAPUS:
  // memberId String?
  // member   MasterMember? @relation(...)

  // BARU:
  managementMemberId String?           @unique
  managementMember   ManagementMember? @relation(fields: [managementMemberId], references: [id], onDelete: SetNull)

  // ...existing fields tetap...
  ownedPicBankAccounts PicBankAccount[]
  eventsAsPic          Event[]
}
```

`ManagementMember` sebaliknya mendapat back-relation:
```prisma
model ManagementMember {
  // ... existing fields ...
  adminProfile AdminProfile?   // back-relation (tidak ada field baru di sini)
}
```

### Dampak ke kode

| File | Perubahan |
|------|-----------|
| `src/lib/auth/admin-context.ts` | `profile.member.eventsAsHelper` → `profile.managementMember?.masterMember?.eventsAsHelper` |
| `src/lib/admin/pic-options-for-event.ts` | Label PIC: `p.member?.memberNumber` → `p.managementMember?.publicCode`; helper exclusion map: `r.memberId` → `r.managementMember?.masterMemberId ?? null` |
| `src/lib/admin/load-committee-admin-directory.ts` | `memberId`/`member` → `managementMemberId`/`managementMember`; `memberOptions` dari `MasterMember` → dari `ManagementMember` |
| `src/lib/actions/admin-committee-profiles.ts` | Linking admin: `memberId → MasterMember` → `managementMemberId → ManagementMember` |
| `src/lib/actions/admin-events.ts` | `pic.memberId` → `pic.managementMember?.masterMemberId` (untuk exclude PIC dari daftar helper) |
| `src/app/admin/events/page.tsx` | `picAdminProfile.member?.fullName` → `picAdminProfile.managementMember?.fullName` |
| `src/components/admin/committee-admin-settings-panel.tsx` | UI link admin ke ManagementMember (bukan MasterMember lagi) |
| `src/app/api/admin/pic-banks/[adminProfileId]/route.ts` | Tidak ada perubahan logika; tetap fetch PicBankAccount by adminProfileId |

### Catatan

- `EventPicHelper` tetap pada `MasterMember` — jalur `AdminProfile → ManagementMember → masterMember → eventsAsHelper` tetap berfungsi (2-hop)
- `ManagementMember` yang tidak punya `masterMemberId` otomatis tidak bisa jadi helper event — ini perilaku yang benar
- Admin yang sebelumnya punya `memberId` perlu di-migrate: jika MasterMember tersebut punya `managementMemberRecord`, set `managementMemberId` ke record tersebut; jika tidak, set null (data migration di migration script)

---

## Perubahan File

| File | Perubahan |
|------|-----------|
| `prisma/schema.prisma` | Tambah `isUnique`, `parentRoleId`, `parent`, `children` ke `BoardRole`; hapus dua `@@unique` dari `BoardAssignment`; hapus `AdminProfile.memberId → MasterMember`, tambah `AdminProfile.managementMemberId → ManagementMember` |
| `prisma/migrations/...` | Migration baru |
| `src/lib/forms/admin-board-role-schema.ts` | Tambah `isUnique`, `parentRoleId` ke schema Zod |
| `src/lib/forms/admin-board-assignment-schema.ts` | Tidak ada perubahan schema; enforcement pindah ke server action |
| `src/lib/actions/admin-board-assignments.ts` | Tambah enforcement `isUnique` di `createBoardAssignment` dan `updateBoardAssignment` |
| `src/lib/management/query-admin-board-roles.ts` | Tambah query untuk fetch tree (depth-first), tambah `isUnique` dan `parentRoleId` ke VM |
| `src/lib/management/query-admin-period-assignments.ts` | Update untuk support multiple assignments per member |
| `src/lib/management/query-admin-period-tree.ts` | Query baru: fetch semua `BoardRole` (dengan hierarki) + `BoardAssignment` untuk satu periode — digunakan oleh tree view |
| `src/components/admin/management-role-form-dialog.tsx` | Tambah field parent role dan kapasitas |
| `src/components/admin/management-roles-page.tsx` | Update render tabel dengan indentasi hierarki (depth-first, flat saat filter aktif) |
| `src/components/admin/management-period-detail.tsx` | Tambah toggle view, implementasi tree view rekursif |
| `src/app/admin/management/[periodId]/page.tsx` | Tambah `?view` param ke page props |
| `src/app/admin/management/[periodId]/export-csv/route.ts` | Route baru untuk CSV download |
| `src/app/admin/management/[periodId]/export-pdf/route.ts` | Route baru untuk PDF download (`@react-pdf/renderer`) |

---

## Catatan Implementasi

- `availableMembers` di `[periodId]/page.tsx` sudah fetch semua `ManagementMember` tanpa filter — tidak perlu diubah karena multiple assignment per member sudah diizinkan
- `recompute-directory-flags.ts` tidak perlu diubah: logika `assignments.some(...)` tetap benar dengan multiple assignments per member
- Tree view query perlu fetch semua `BoardRole` (tanpa filter aktif/tidak) + join `BoardAssignment` filtered by `boardPeriodId`; dibangun menjadi nested tree di server sebelum dikirim ke client

---

## Dependensi Baru

- `@react-pdf/renderer` — generate PDF di server
