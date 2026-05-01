---
title: Admin shell — identitas visual CISC (branding)
date: 2026-05-02
project: match-screening
status: ready-for-review
related:
  - 2026-05-01-admin-dashboard-shell-design.md
  - 2026-05-02-admin-navigation-ia-v1-design.md
---

## 1) Purpose

PIC admin memakai **`AdminAppShell`** setiap hari; tampilan sekarang fungsional tetapi **kurang bermerek**. Spesifikasi ini mengunci polesan **identitas CISC** pada kulit admin (**pil B** dari sesi brainstorming Visual Companion), tanpa mengubah hak akses, routing, atau struktur data.

Dokumen ini **melengkapi** [shell dashboard 2026-05-01](2026-05-01-admin-dashboard-shell-design.md) dan [IA navigasi 2026-05-02](2026-05-02-admin-navigation-ia-v1-design.md) — bukan mengganti keputusan perilaku di sana.

## 2) Scope

### 2.1 In scope

1. **`src/components/admin/admin-app-shell.tsx`**
   - Blok merek di header sidebar: **slot logo** (opsional) + judul **“CISC Admin”** + email PIC; hierarki tipografi jelas.
   - **Navigasi global** dengan **ikon Lucide** sejajar label (Beranda, Acara, Anggota, Pengaturan sesuai flags), state **aktif** dan hover yang memakai aksen bermerek (mis. pill lembut berbasis `primary` / `sidebar-accent`, bukan hanya `muted` datar).
   - Sidebar memakai semantik warna **sidebar** (`bg-sidebar`, teks `sidebar-foreground`, border `sidebar-border` di `globals.css`) agar **terpisah** secara visual dari kartu konten utama (`card`).
   - **Mobile:** `Sheet` isi menu dan header strip atas **selaras** warna/tipografi dengan desktop (judul sheet, spacing, tombol Keluar).
   - **Scope token:** semua overrides warna tambahan dibatasi subtree admin (mis. `data-admin-shell` atau `className` pada root wrapper shell) — **tidak** mengubah `:root` global sedemikian rupa hingga mengubah tampilan rute **`(public)`** tanpa tinjauan eksplisit terpisah.

2. **Krom jalur event** *(pendekatan “shell + event” yang disetujui)*
   - **`src/app/admin/events/[eventId]/layout.tsx`** — padding/wrapper utama event: sama-sama memakai latar bermeterai konsisten dengan area konten shell (mis. sama `muted`/`background` pola).
   - **`src/components/admin/admin-event-breadcrumbs.tsx`** dan **`src/components/admin/admin-event-subnav.tsx`** — penyelarasan ringan: satu bahasa visual (ketebalan garis pemisah, jarak vertikal, aksen halus sekunder/`primary` pada tab aktif) **tanpa** mengubah URL atau struktur sub-nav dari spek IA v1.

### 2.2 Out of scope (YAGNI)

- Logo resmi atau aset baru wajib: **tidak**; sampai aset diserahkan, gunakan **mark fallback** (bentuk geometris sederhana atau inisial) yang mudah diganti satu komponen.
- Redesign penuh isi halaman (**inbox**, **laporan**, form **Acara/Anggota/Pengaturan**), grafik, atau tabel data.
- Tema **`dark`** khusus admin atau mode terpisah (kecuali diminta sprint lain).
- Menggeser **`--primary`** / palet **`globals.css`** secara global untuk seluruh app (risiko halaman publik).

## 3) Locked visual decisions

| Topik | Keputusan |
|--------|-----------|
| Arah brainstorming | **B** — identitas CISC lebih kental pada shell. |
| Cakupan implementasi pertama | **Shell global + penyelarasan strip event** (breadcrumb + subnav + wrapper layout event). |
| Token global vs scoped | Overrides bermerek dibatasi **subtree admin**; hindari dampak pada publik. |
| Navigasi | Tetap pola link dan **`deriveGlobalSidebarNav`**; hanya tambah ikon dan gaya. |
| Bahasa UI | Indonesia, selaras dokumen PIC lainnya. |

## 4) Components & structure

### 4.1 Shell root

Root layout admin (`layout.tsx`) tetap membungkus anak dengan **`AdminAppShell`**. Props **`navFlags`** dan **`userEmail`** tidak berubah.

Satu **wrapper aksesibel** disarankan pada elemen luar `AdminAppShell` atau root div pertama di dalamnya, mis. `data-admin-shell` — untuk dokumentasi tooling dan kemungkinan override CSS masa depan; implementasi konkret tinggal pola Tailwind/`cn` yang konsisten dengan repo.

### 4.2 Logo slot

| Kondisi | Perilaku |
|---------|----------|
| Belum ada aset di `public/` untuk logo klub | Tampilkan **fallback mark** statis (mis. kotak/`div` bermeterai atau satu huruf grup) tetap konsisten tinggi dengan baris judul — **tidak** memblokir merge. |
| Aset ditambahkan kemudian | Satu lokasi konfiguratif (mis. konstante path string atau komponen `AdminBrandMark`) mengimpor **`next/image`** bila Cocok CSP/domain; **`alt`** deskriptif singkat bahasa Indonesia. |

### 4.3 Item navigasi

- Ikon konsisten untuk: Beranda, Acara, Anggota, Pengaturan (pilih satu set Lucide dan gunakan persisten — tidak berganti gaya tiap rebuild).
- **Aktif:** kontras lebih jelas dari sekadar `bg-muted` (mis. kombinasi `sidebar-accent` / `primary` foreground-background dengan rasio kontras aksesibilitas WCAG AA untuk teks utama).
- **Fokus keyboard:** tetap pola `focus-visible` shadcn/Tailwind yang sudah dipakai proyek.

### 4.4 Event chrome

- **Breadcrumb:** struktur tautan tidak berubah; hanya penyempurnaan visual (ukuran label “Beranda”, pemisah, truncating judul event tetap seperti ada).
- **Sub-nav:** indikator tab/pill aktif selaras aksen sidebar; mobile horizontal strip tetap satu jalur geser bila diperlukan, selaras **[IA v1 § sub-nav mobile](2026-05-02-admin-navigation-ia-v1-design.md)**.

## 5) Behaviour & responsiveness

| Breakpoint | Ekspektasi |
|------------|------------|
| **≥ lg** | Sidebar tetap kolom kiri tetap (~ lebar bisa sedikit lebih lebar dari 220px bila dibutuhkan untuk ikon+teks tanpa truncation berlebihan, maks konservatif ~260px). |
| **< lg** | Header atas + Sheet; konten utama full width seperti sekarang; tidak mengorbankan tap target minimal **44×44** untuk kontrol pembuka menu. |

Tidak ada perubahan **Server Action**, **middleware**, atau **session**.

## 6) Failure & accessibility

| Area | Perlakuan |
|------|-----------|
| Email panjang | Tetap **`truncate`** + **`title`** tooltip seperti sekarang. |
| Landmark | Pertahankan **`aria-label`** pada **`<aside>`**, **`<nav>`**, sheet title. |
| Kontras | Audit cepat aktif/nav teks pada `sidebar` dan sub-nav selepas implementasi (perbaiki kelas Tailwind jika gagal AA). |

## 7) Testing

| Jenis | Cakupan |
|-------|---------|
| Manual smoke | Sidebar + semua kombinasi item nav yang mungkin oleh flags; membuka jalur **`/admin/events/[eventId]/inbox`** dan **`/report`**; mobile Sheet buka/tutup; Keluar. |
| Automatisasi | Tidak mensyaratkan tes baru untuk iterasi pertama; regressions ditangkap lint + tinjauan visual. |

## 8) Success criteria

- Admin terasa **satu kulit bermerek CISC**: sidebar bermeterai jelas dari konten; nav mudah dipindai (**ikon + label**).
- Jalur dalam **event** (breadcrumb + subnav) **selaras** visual dengan shell tanpa mengubah IA atau URL.
- Halaman **`(public)`** tidak mengalami drift warna utama akibat perubahan ini (verifikasi sampel **`/`** dan **`/events/[slug]`** setelah merge).
- Perilaku auth dan nav flags **tidak berubah**.

## 9) Implementation note

Rencana implementasi terpisah (writing-plans) harus menghindari penyentuhan bermotif besar pada **`src/app/(public)`** dan **`globals.css`** kecuali entri baru **nama variabel sidebar** sudah ada — dalam hal ini gunakan pemetaan Tailwind eksisting daripada mendefinisikan warna baru di `:root` global tanpa wrapper admin.
