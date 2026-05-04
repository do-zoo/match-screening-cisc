# Spec: Halaman Detail Admin Komite

**Tanggal:** 2026-05-04
**Status:** Approved

## Latar Belakang

Halaman `/admin/settings/committee` saat ini menampilkan tabel dengan 10 kolom dan row expand inline untuk rekening PIC. Aksi manajemen (ubah peran, tautan anggota, cabut akses, hapus) diakses via dropdown + dialog per baris. Pendekatan ini membuat tabel sangat lebar dan informasi per admin tersebar.

Solusi: ringkaskan tabel menjadi list navigasi, dan pindahkan seluruh detail + aksi ke halaman tersendiri per admin dengan layout tabs.

---

## Route & Guard

```
/admin/settings/committee                        → list (Owner-only)
/admin/settings/committee/[adminProfileId]       → detail (Owner-only)
```

`src/app/admin/settings/committee/layout.tsx` baru memanggil `guardOwner()` — melindungi seluruh subroute committee sekaligus. Sebelumnya tidak ada layout guard di level ini.

---

## Halaman List — `/admin/settings/committee`

### Tabel admin

Menggunakan `DataTable` (extended) dengan 5 kolom:

| Email | Nama | Peran | Aktivitas sesi* | Aksi |
|-------|------|-------|-----------------|------|
| font-mono, xs | displayName | badge role | last session date | tombol "Detail →" |

- Filter teks: cari berdasarkan nama atau email (client-side)
- Filter peran: select (semua / Owner / Admin / Verifier / Viewer)
- Pagination: pageSize 10

Kolom yang **dihapus** dari tabel: 2FA, Anggota terkait, Acara (PIC), Rek. PIC, expand toggle.

Kolom Aksi: tombol `<Link href="/admin/settings/committee/{adminProfileId}">Detail →</Link>` (bukan dropdown).

### Undangan tertunda

Section ini tetap ada di atas tabel, tidak berubah secara fungsional. Tabel undangan juga diganti ke `DataTable` dengan filter status (aktif/kedaluwarsa) dan pagination.

### Header

Tombol "Undang admin baru…" dan "Unduh CSV" tetap di header, tidak berubah.

---

## Halaman Detail — `/admin/settings/committee/[adminProfileId]`

### Header halaman

Selalu tampil di atas tabs, tidak ikut scroll per-tab:

```
← Kembali ke Komite
[Nama lengkap]  [badge peran]
[email]
```

### Tab 1 — Profil & Aksi

**Info read-only (grid 2 kolom):**
- Peran
- Anggota terkait (nama + nomor anggota, atau "—")
- 2FA (Ya / Tidak)
- Aktivitas sesi terakhir

**Aksi (sama persis dengan dialog yang sudah ada di `ManageAdminDialogs`):**
- Ubah peran → dialog
- Tautan anggota → dialog
- Cabut akses bermakna → dialog konfirmasi
- Hapus profil & akun → dialog konfirmasi destructive

Semua aksi memanggil server actions yang sudah ada (`updateCommitteeAdminRole`, `updateCommitteeAdminMemberLink`, `revokeCommitteeAdminMeaningfulAccess`, `deleteCommitteeAdmin`).

### Tab 2 — Rekening PIC

Label tab: `Rekening PIC (n)` — n = jumlah semua rekening (aktif + nonaktif).

Konten: komponen `AdminPicBankAccountsInline` yang sudah ada, dipindahkan dari inline expand ke tab ini. Tidak ada perubahan pada komponen itu sendiri.

### Tab 3 — Acara PIC

Label tab: `Acara PIC (n)` — n = total acara di mana admin ini adalah PIC.

**Summary di atas tabel:** `n aktif · m selesai` (berdasarkan field `Event.status` atau tanggal).

**Tabel menggunakan `DataTable` (extended):**

| Nama Acara | Tanggal | Status | Aksi |
|------------|---------|--------|------|
| slug/nama event | eventDate | badge status | Link → Inbox |

- Filter teks: nama acara
- Filter status: select (semua / aktif `active` / selesai `finished` / draft `draft`)
- Pagination: pageSize 10

Link "→ Inbox" mengarah ke `/admin/events/[eventId]/inbox`.

---

## Ekstensi `DataTable`

File: `src/components/ui/data-table.tsx`

Props baru (semuanya opsional, default = false/undefined = perilaku lama):

```ts
type DataTableProps<TData, TValue> = {
  // ... props yang sudah ada ...
  enableFiltering?: boolean
  filterColumn?: string        // kolom yang difilter teks (jika enableFiltering)
  filterPlaceholder?: string   // placeholder input filter
  enablePagination?: boolean
  pageSize?: number            // default 10
}
```

Implementasi:
- Filter: `getFilteredRowModel()` dari TanStack Table + input teks di atas tabel
- Pagination: `getPaginationRowModel()` + kontrol prev/next + info "halaman X dari Y" di bawah tabel

**Non-breaking**: semua pemakai `DataTable` yang ada tidak perlu diubah.

---

## Query Baru

File: `src/lib/admin/load-committee-admin-detail.ts`

Fungsi: `loadCommitteeAdminDetail(adminProfileId: string)`

Return shape:
```ts
{
  profile: {
    adminProfileId, email, displayName, role,
    managementMemberId, memberSummary,
    twoFactorEnabled, lastSessionActivityAtIso
  },
  picBankAccounts: PicBankAccountVm[],   // sudah ada dari loadCommitteeAdminDirectory
  eventsAsPic: {
    eventId, name, eventDate, status
  }[]
}
```

Query `eventsAsPic`: `Event.findMany({ where: { picAdminProfileId: adminProfileId } })`.

---

## File Summary

### Baru
| File | Keterangan |
|------|-----------|
| `src/app/admin/settings/committee/layout.tsx` | Guard `guardOwner()` |
| `src/app/admin/settings/committee/[adminProfileId]/page.tsx` | Server component: load data + render tabs |
| `src/lib/admin/load-committee-admin-detail.ts` | Query profil + rekening + acara |
| `src/components/admin/committee-admin-detail-tabs.tsx` | Client component: tab controller + Tab 1 |
| `src/components/admin/committee-admin-pic-events-tab.tsx` | Tab 3: DataTable acara PIC |

### Dimodifikasi
| File | Perubahan |
|------|-----------|
| `src/components/ui/data-table.tsx` | Tambah `enableFiltering`, `enablePagination`, `pageSize` |
| `src/components/admin/committee-admin-settings-panel.tsx` | Pangkas ke 5 kolom, hapus expand + `ManageAdminDialogs`, tambah link Detail |
| `src/app/admin/settings/committee/page.tsx` | Pakai `DataTable` extended untuk tabel admin + undangan |

### Tidak Berubah
- Semua server actions (`admin-committee-profiles.ts`, `admin-pic-bank-accounts.ts`, dll.)
- `src/components/admin/admin-pic-bank-accounts-inline.tsx` — hanya dipindah lokasi render
- Prisma schema
- Form validation schemas

---

## Yang Tidak Dikerjakan (Out of Scope)

- Halaman detail untuk non-Owner (Verifier, Viewer read-only view) — bisa dipertimbangkan di iterasi berikutnya
- Export CSV dari halaman detail
- Sorting server-side (data admin kecil, client-side cukup)
