---
title: Navigasi admin backoffice — IA global + konteks acara + peran PIC
date: 2026-05-02
project: match-screening
status: ready-for-review
related:
  - 2026-05-01-admin-dashboard-shell-design.md
  - 2026-04-29-nobar-cisc-tangsel-design.md
---

## 1) Purpose

Melengkapi spek **[shell dashboard 2026-05-01](2026-05-01-admin-dashboard-shell-design.md)** dengan **informasi arsitektur navigasi v1**: item menu global tanpa pohon seluruh acara di sidebar, sub-nav konsisten untuk jalur **`/admin/events/[eventId]/*`**, dan aturan **peran admin PIC** serta visibilitas menu.

Spek cetak biru **[Nobar 2026-04-29](2026-04-29-nobar-cisc-tangsel-design.md)** tetap menjadi referensi domain; dokumen ini hanya mengunci **IA navigasi**, bukan menyalin seluruh modul CRUD.

## 2) Scope

### 2.1 In scope

- Label dan rute menu global v1 serta breadcrumb pola umum.
- Keputusan “**tanpa item Laporan di sidebar global**” untuk v1; laporan tetap per `eventId` lewat kartu Beranda atau sub-nav acara.
- Sub-nav konteks **Inbox | Laporan**: **desktop** blok di sidebar, **mobile** kontrol horizontal di bawah breadcrumb (satu kesatuan pola di semua jalur dalam acara yang relevan).
- Dokumentasi **`AdminRole`** (enum basis data): **Owner**, **Admin**, **Verifier**, **Viewer**, plus **elevator PIC Helper** bagi Viewer per event.

### 2.2 Out of scope

- Mengganti **`canVerifyEvent`** atau struktur PIC (hanya konsumsi perilaku eksisting).
- Halaman baru “hub laporan lintas event” (**bukan v1**; dapat iterasi dengan rute seperti `/admin/laporan` atau serupa bila kepentingan operasi memerlukan).
- Definisi rinci form CRUD per modul (**Acara**, **Anggota**, **Pengaturan**); tugas tersebut mengikuti rencana implementasi terpisah.

## 3) Locked navigation decisions

| Topik | Keputusan v1 |
|--------|----------------|
| Laporan di sidebar global | **Tidak**; akses dari **kartu Beranda** dan **sub-nav** saat dalam acara (`/report`). |
| Sub-nav konteks acara | **Hibrida**: sidebar (≥ lg) untuk blok nama acara + **Inbox \| Laporan**; **< lg** pills/tabs horizontal di atas konten, di bawah header jalur dalam. URL tetap canonik. |
| Pohon seluruh acara di sidebar | **Tidak** — selaras spek shell. |

## 4) Role admin PIC (`AdminRole`)

Peran PIC disimpan sebagai enum **`AdminRole`** pada **`AdminProfile`** (Prisma):

| Nilai enum | Nama UI (opsional, konsisten Indo) | Inti akses navigasi / operasi |
|------------|-------------------------------------|--------------------------------|
| **Owner** | Owner | Konfigurasi komite (**Pengaturan**), master **Anggota**, serta semua operasional acara bagi event yang boleh diakses. |
| **Admin** | Admin | **Paritas operasional dengan Owner** pada Beranda, Acara, Anggota, inbox/laporan (verifikasi global). **Tidak** boleh **`Pengaturan` / pengaturan lanjutan komite**: kelola admin PIC, rekening bank PIC, default harga global, template WA (**`canManageCommitteeAdvancedSettings`** hanya Owner). |
| **Verifier** | Verifier | Beranda, kelola jalur **Acara**/inbox/laporan per event untuk event yang boleh diakses; **tidak** menu **Pengaturan**. |
| **Viewer** | Viewer | Lihat dashboard dan laporan/ekspor sesuai izin tanpa tombol verifikasi kecuali **elevator** PIC Helper untuk event tertentu. |

**Elevator PIC Helper (bukan nilai enum baru):** PIC dengan role global **`Viewer`** yang menjadi **PIC Helper** pada sebuah **event** memperoleh kemampuan setara peninjau/registrasi **hanya** untuk **`eventId`** itu (logika aplikasi seperti **`canVerifyEvent`** + **`helperEventIds`**).

---

### 4.1 Matriks visibilitas item sidebar global v1

| Item menu | Rute | Owner | Admin | Verifier | Viewer\* |
|-----------|------|:-----:|:-----:|:--------:|:--------:|
| **Beranda** | `/admin` | ✓ | ✓ | ✓ | ✓ |
| **Acara** | `/admin/events` (indeks kelola)\*\* | ✓ | ✓ | ✓ | ✓ |
| **Anggota** | `/admin/anggota` | ✓ | ✓ | — | — |
| **Pengaturan** | `/admin/pengaturan` | ✓ | — | — | — |

\* **Viewer**: hanya melihat data acara yang lolos **`canVerifyEvent`** (biasanya sebagai helper tugas tertentu; tanpa pohon kosong mengherankan ketika tidak ada tugas helper).

\*\* **Acara**: indeks manajemen (daftar/create/edit sesuai rencana implementasi). **Beranda** tetap jalur utama operasi harian (kartu + KPI **`pending_review`**); tidak mengganti prinsip “tanpa pohon sidebar” untuk daftar cepat multitasking — itu tugas kartu dan deep link.

**Perlindungan server:** penyusutan menu tidak cukup; setiap loader dan mutasi tetap menyaring berdasarkan role + **`canVerifyEvent`**. Jalur **Anggota** (operasional) memakai **`hasOperationalOwnerParity`** / **`guardOwnerOrAdmin`**; jalur **Pengaturan lanjutan** memakai **`canManageCommitteeAdvancedSettings`** / **`guardOwner`**. Kunjungan URL langsung **tanpa** hak menghasilkan **`notFound()`** atau respons setara pola repo.

### 4.2 Breadcrumb (ringkas)

- **`/admin`**: breadcrumb boleh minimal (**Dashboard**/`Beranda`) selaras **[§5 shell](2026-05-01-admin-dashboard-shell-design.md)**.
- **Jalur global** (mis. **Acara**): `Beranda › Acara` (dan turunan jelas bila subtree edit).
- **Jalur dalam acara**: `Beranda › {judul singkat event} › Inbox | Laporan` (judul tidak perlu nama file panjang slug).

### 4.3 Menambah nilai **`AdminRole`** baru di masa depan (selain **Admin**)

Nilai **Admin** sudah termasuk di enum; role **berikutnya** (kelima, dst.) tetap memerlukan: migrasi Prisma, pembaruan **`src/lib/permissions/roles.ts`** (mis. **`hasGlobalVerifierAccess`** bila perlu), audit **`guards`** / **`guardOwner`** / loaders admin, **`bootstrap-admin`**, uji hak, serta pembaruan matriks menu.

## 5) Relation to shell dashboard

Halaman **`/admin`** (Beranda kartu event, tab status, aggregat **menunggu tinjauan**) tidak berubah maksud produk oleh dokumen ini; dokumen ini hanya menambah **modul global** yang muncul di sidebar shell dan **sub-nav** pada layout event.

## 6) Success criteria

- Satu peta mental jelas: **Beranda** = operasi; **Acara** = kelola direktori acara; **Anggota** = Owner & Admin; **Pengaturan** (lanjutan) = Owner saja (matriks §4.1).
- Tidak ada entri sidebar **Laporan** global di v1; PIC tetap bisa deep link **`/admin/events/[eventId]/report`** dari kartu atau sub-nav.
- Sub-nav konteks desktop vs mobile konsisten antara **Inbox** dan **Laporan** tanpa duplikasi membingungkan (satu blok sidebar **atau** satu bar horizontal per breakpoint).

## 7) Milestone implementasi v1 (disetujui: wire navigasi dulu)

**Prioritas iterasi pertama:** **A** — sambungkan **semua item menu global** ke rute kanonik dengan **isi minimal** (placeholder atau empty state) dan **perlakuan salah hak konsisten**. CRUD lengkap Nobar (**Acara** / **Anggota** / **Pengaturan**) boleh menyusul di rencana terpisah; milestone ini menjaga tidak ada tautan menggantung atau perilaku akses tidak jelas.

| Rute | Terlihat di sidebar bagi | Sasaran perilaku Milestone v1 |
|------|---------------------------|--------------------------------|
| `/admin` | Matriks §4.1 | Sudah ada (Beranda/shell); tetap pusat KPI + kartu. |
| `/admin/events` | Owner, Admin, Verifier, Viewer\* | Halaman ada: judul ringkas **Acara**, copy placeholder “belum ada implementasi daftar”—**bukan** 404 bagi yang berhak. Data real menyusul. |
| `/admin/anggota` | Owner, Admin — saja | **Owner / Admin:** halaman placeholder + copy singkat. **Verifier / Viewer / tanpa sesi:** tidak melihat link; deep link → **`notFound()`** atau setara **FORBIDDEN** konsisten repo. |
| `/admin/pengaturan` | Owner saja | **Owner:** placeholder “Pengaturan komite”. **Lainnya:** tidak melihat link; deep link → **`notFound()`** / **FORBIDDEN**. |

**Shell UI:** sidebar (dan drawer mobile) menyajikan tautan untuk item yang boleh user itu lihat (**role** diketahui dari server / layout sama pola existing); aktiv state pakai **`pathname`**.

**Bahasa fallback:** salinan Indonesia; tanpa blok kosong membisu bagi error gagal muat (**selaras §6 shell** bila pola error dipakai ulang).

**Di luar Milestone ini (urutan kemudian):** isi Nyata `/admin/events` (CRUD), `/admin/anggota`, **`/admin/pengaturan`**; penyempurnaan sub-nav **Inbox \| Laporan** hibrida bila layout event belum sejajar spek §3 — dapat berjalan paralel tetapi **prioritas utama** dokumentasi sprint ini ialah **kelengkapan link + guard**.

\* **Viewer:** lihat sidebar terpangkas per matriks; rute **`/admin/events`** hanya bermakna bagi mereka jika akses PIC mengizinkan — placeholder tetap aman bagi semua PIC yang bisa masuk (**canVerifyEvent** menyaring data nanti).

## 8) References

- `prisma/schema.prisma` — `enum AdminRole { Owner Admin Verifier Viewer }`.
- **`src/lib/permissions/guards.ts`** — **`canVerifyEvent`**.
- **`src/lib/permissions/roles.ts`** — **`AdminRole`**, **`hasGlobalVerifierAccess`**, **`hasOperationalOwnerParity`**, **`canManageCommitteeAdvancedSettings`**.
- **`src/lib/actions/guard.ts`** — **`guardOwner`** (lanjutan komite), **`guardOwnerOrAdmin`** (operasional Owner+Admin).
