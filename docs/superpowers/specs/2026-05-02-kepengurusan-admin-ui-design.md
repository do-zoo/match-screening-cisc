# Design: Kepengurusan Admin UI

**Status:** Approved — siap implementasi.

**Konteks:** Backend sudah lengkap (DB schema, semua server actions, helpers recompute, audit log, navigasi sidebar). Spec ini hanya mencakup layer UI React yang belum ada.

---

## 1. Keputusan desain

| Keputusan | Pilihan |
|-----------|---------|
| Struktur halaman | B — 4 route terpisah: hub, detail periode, members global, roles global |
| Inline member creation di assignment dialog | Tidak — buat pengurus dulu di `/management/members`, lalu kembali assign |
| Navigasi antar halaman | Hub page sebagai landing dengan card-link; breadcrumb `← Kepengurusan` di sub-halaman |
| Assignment actions | Edit jabatan (ubah role) + hapus; tidak ada edit pengurus dari roster |
| Implementasi | Pendekatan A — mirror pola Members: RSC page → client component + dialog terpisah |

---

## 2. Route layout

```
/admin/management                    Hub: card-link + daftar periode
/admin/management/[periodId]         Roster penugasan per periode
/admin/management/members            Daftar ManagementMember (global)
/admin/management/roles              Daftar BoardRole (global)
```

Semua route: gate `hasOperationalOwnerParity(ctx.role)` → `notFound()` jika tidak memenuhi.

---

## 3. File yang dibuat / dimodifikasi

| Path | Status | Keterangan |
|------|--------|------------|
| `src/app/admin/management/page.tsx` | MODIFY | Render `ManagementHubPage` |
| `src/app/admin/management/[periodId]/page.tsx` | MODIFY | Render `ManagementPeriodDetail` |
| `src/app/admin/management/members/page.tsx` | NEW | RSC, render `ManagementMembersPage` |
| `src/app/admin/management/roles/page.tsx` | NEW | RSC, render `ManagementRolesPage` |
| `src/components/admin/management-hub-page.tsx` | NEW | Client component hub |
| `src/components/admin/management-period-detail.tsx` | NEW | Client component roster |
| `src/components/admin/management-members-page.tsx` | NEW | Client component daftar pengurus |
| `src/components/admin/management-roles-page.tsx` | NEW | Client component daftar jabatan |
| `src/components/admin/management-period-form-dialog.tsx` | NEW | Dialog create/edit `BoardPeriod` |
| `src/components/admin/management-member-form-dialog.tsx` | NEW | Dialog create/edit `ManagementMember` |
| `src/components/admin/management-role-form-dialog.tsx` | NEW | Dialog create/edit `BoardRole` |
| `src/components/admin/management-assignment-form-dialog.tsx` | NEW | Dialog create/edit `BoardAssignment` |

Tidak ada file baru di `src/lib/` — semua server actions dan Zod schemas sudah ada.

---

## 4. Halaman hub (`/admin/management`)

**RSC `page.tsx`** — fetch:
- `prisma.boardPeriod.findMany` dengan `_count.assignments`, `select { id, label, startsAt, endsAt }`, order `startsAt desc`
- Gunakan `findActiveBoardPeriod` dari `@/lib/management/active-period` untuk tentukan baris mana yang "Aktif"

**Client `ManagementHubPage`** — props:
```ts
type Props = {
  periods: { id: string; label: string; startsAt: Date; endsAt: Date; assignmentCount: number }[];
  activePeriodId: string | null;
};
```

**Layout:**
1. Page header: "Kepengurusan" + deskripsi singkat
2. Grid 2 kolom — card-link ke:
   - `/admin/management/members` — "Daftar Pengurus" + deskripsi
   - `/admin/management/roles` — "Jabatan" + deskripsi
3. Section "Periode Kabinet" + tombol "Tambah Periode"
4. Daftar periode (border list): label, badge "Aktif" (hijau) kalau `id === activePeriodId`, rentang tanggal, jumlah penugasan, link "Lihat roster →", menu ⋯ (Edit, Hapus)

**Dialog period (`management-period-form-dialog.tsx`):**
- Fields: `label` (text), `startsAt` (date `<input type="date">`), `endsAt` (date `<input type="date">`)
- Schema: `adminBoardPeriodCreateSchema` / `adminBoardPeriodUpdateSchema` (sudah ada)
- Actions: `createBoardPeriod` / `updateBoardPeriod`
- Error: tampilkan `rootError` sebagai pesan merah di bawah form
- Hapus: konfirmasi inline di dropdown ("`Hapus` — tidak dapat dibatalkan") → `deleteBoardPeriod`

---

## 5. Halaman roster (`/admin/management/[periodId]`)

**RSC `page.tsx`** — fetch:
- `prisma.boardPeriod.findUnique` dengan assignments join `managementMember { fullName, publicCode, masterMemberId }` + `boardRole { title }`, order `createdAt asc`
- `prisma.managementMember.findMany` — untuk dropdown di assignment dialog
- `prisma.boardRole.findMany({ where: { isActive: true } })` — untuk dropdown di assignment dialog

**Client `ManagementPeriodDetail`** — props:
```ts
type Props = {
  period: { id: string; label: string; startsAt: Date; endsAt: Date };
  assignments: { id: string; boardRole: { id: string; title: string }; managementMember: { id: string; fullName: string; publicCode: string; masterMemberId: string | null } }[];
  availableMembers: { id: string; fullName: string; publicCode: string }[];
  availableRoles: { id: string; title: string }[];
  isActive: boolean;
};
```

**Layout:**
1. Breadcrumb `← Kepengurusan`
2. Page header: label periode + badge "Aktif" + rentang tanggal + tombol "Tambah Penugasan"
3. Tabel roster: kolom Jabatan | Nama Pengurus | Kode Publik | Aksi
   - Badge "· direktori" (hijau, kecil) jika `masterMemberId` tidak null
   - Menu ⋯ per baris: "Ubah Jabatan" → dialog edit, "Hapus" → konfirmasi

**Dialog assignment (`management-assignment-form-dialog.tsx`):**
- Mode create: select Jabatan (dropdown active roles) + select Pengurus (dropdown all members)
- Mode edit (Ubah Jabatan): hanya select Jabatan; nama pengurus ditampilkan sebagai read-only
- `boardPeriodId` di-pass sebagai prop (tidak ditampilkan di form)
- Actions: `createBoardAssignment` / `updateBoardAssignment`
- Error: "Penugasan bentrok" → tampilkan sebagai `rootError`

---

## 6. Halaman members (`/admin/management/members`)

**RSC `page.tsx`** — fetch:
- `prisma.managementMember.findMany({ include: { masterMember: { select: { memberNumber: true } } }, orderBy: { fullName: 'asc' } })`
- `prisma.masterMember.findMany({ where: { isActive: true }, select: { id: true, memberNumber: true, fullName: true }, orderBy: { memberNumber: 'asc' } })` — untuk dropdown di dialog

**Client `ManagementMembersPage`** — props:
```ts
type Props = {
  members: { id: string; fullName: string; publicCode: string; whatsapp: string | null; masterMemberId: string | null; masterMember: { memberNumber: string } | null }[];
  availableMasterMembers: { id: string; memberNumber: string; fullName: string }[];
};
```

**Layout:**
1. Breadcrumb `← Kepengurusan`
2. Header "Daftar Pengurus" + deskripsi + tombol "Tambah"
3. Tabel: Nama | Kode Publik | No. Member (atau "—") | Aksi
   - No. Member ditampilkan hijau jika ada (`masterMember?.memberNumber`)
   - Menu ⋯: Edit, Hapus

**Dialog member (`management-member-form-dialog.tsx`):**
- Fields: `fullName` (text), `publicCode` (text, monospace hint), `whatsapp` (text, optional), `masterMemberId` (select/combobox dari `availableMasterMembers` — tampilkan sebagai "No. Member — Nama", value = Prisma `id`; opsional, bisa dikosongkan)
- Schema menggunakan `masterMemberId` (Prisma CUID) — bukan nomor member — sehingga dropdown wajib pass `id`, bukan `memberNumber`
- Note di form: "Kode publik otomatis diubah ke huruf kapital."
- Actions: `createManagementMember` / `updateManagementMember`
- Delete: tombol "Hapus" di dialog edit (owner-parity) → `deleteManagementMember`

---

## 7. Halaman roles (`/admin/management/roles`)

**RSC `page.tsx`** — fetch:
- `prisma.boardRole.findMany({ orderBy: { sortOrder: 'asc' } })`

**Client `ManagementRolesPage`** — props:
```ts
type Props = {
  roles: { id: string; title: string; sortOrder: number; isActive: boolean }[];
};
```

**Layout:**
1. Breadcrumb `← Kepengurusan`
2. Header "Jabatan" + deskripsi + tombol "Tambah"
3. Tabel: Nama Jabatan | Urutan | Status (badge Aktif/Nonaktif) | Aksi
   - Baris nonaktif: teks muted
   - Menu ⋯: Edit, Nonaktifkan

**Dialog role (`management-role-form-dialog.tsx`):**
- Fields: `title` (text), `sortOrder` (number, default 0)
- Actions: `createBoardRole` / `updateBoardRole`
- Nonaktifkan: konfirmasi di dropdown → `deactivateBoardRole`; jika action return error (ada penugasan aktif), tampilkan pesan error

---

## 8. Form pattern — konsisten dengan codebase

Semua dialog mengikuti pola yang sama dengan `MemberFormDialog`:
- `"use client"`, `useTransition`, `useState` untuk `rootMessage`
- `useForm` dari `react-hook-form` + `zodResolver`
- `startTransition` saat submit → serialize ke `FormData` dengan `payload: JSON.stringify(values)`
- Dialog dari `@base-ui/react` Dialog pattern (bukan Radix)
- Tombol disabled dengan `disabled={isPending}` pada `<DialogTrigger>`

---

## 9. Error handling

| Skenario | Tampilan |
|----------|----------|
| `rootError` dari server action | Teks merah di bawah form, di atas tombol submit |
| `fieldErrors` | Pesan merah di bawah field yang relevan |
| Periode bertabrakan | "Rentang periode bertabrakan dengan periode lain." |
| Kode publik duplikat | "Kode publik atau tautan anggota sudah dipakai." |
| Jabatan masih dipakai | "Jabatan masih dipakai di N penugasan..." |
| Assignment conflict | "Penugasan bentrok: satu orang atau satu jabatan sudah terisi..." |

---

## 10. Yang tidak dicakup (luar ruang)

- Search / filter pada tabel members atau roles (bisa ditambah di iterasi berikut jika data banyak)
- Reorder drag-and-drop untuk `sortOrder` roles
- Export CSV kepengurusan
- Tampilan publik daftar pengurus
