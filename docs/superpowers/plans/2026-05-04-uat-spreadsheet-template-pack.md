# Paket Template Spreadsheet UAT — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengerjakan tugas bertahap. Langkah pakai checkbox (`- [ ]`).

**Goal:** Menyediakan berkas CSV siap-impor (**UTF-8, pemisah koma**) sebagai template spreadsheet untuk pengurus menjalankan UAT: grid skenario satu baris per `UAT-*`, sheet terpisah (berkas berbeda) untuk **lingkungan** dan **defek**, plus **ringkasan tanda tangan**—semua konsisten dengan [`docs/uat/lembar-hasil-uat-ringkas.md`](../../uat/lembar-hasil-uat-ringkas.md).

**Architecture:** Direktori `docs/uat/templates/` berisi beberapa `.template.csv` murni teks tanpa makro Excel; dokumentasi cara buka di Google Sheets / LibreOffice Calc / Excel + validasi kolom ada di **`README-templates-spreadsheet.md`**. Tidak menggantikan panduan eksekusi; berkas ini melengkapi [`pengurus-runbook-uat.md`](../../uat/pengurus-runbook-uat.md).

**Tech Stack:** CSV (RFC-style: header baris pertama; teks bisa dikutip bila ada koma berikutnya); dokumentasi Markdown; encoding **UTF-8**.

---

## Struktur berkas

| Berkas | Tanggung jawab |
| --- | --- |
| **Create:** [`docs/uat/templates/README-templates-spreadsheet.md`](../../uat/templates/README-templates-spreadsheet.md) | Instruksi impor per aplikasi spreadsheet, nama kolom, nilai sah `hasil_uat`, alur tautan ke runbook/lembar. |
| **Create:** [`docs/uat/templates/uat-hasil-skenario.template.csv`](../../uat/templates/uat-hasil-skenario.template.csv) | Seluruh baris skenario pengujian sama urutan dengan [`lembar-hasil-uat-ringkas.md`](../../uat/lembar-hasil-uat-ringkas.md); kolom hasil kosong untuk diisi. |
| **Create:** [`docs/uat/templates/uat-lingkungan.template.csv`](../../uat/templates/uat-lingkungan.template.csv) | Baris-baris untuk BASE_URL dan akun penguji (**nilai isian diketik langsung pengguna** sesuai `pengurus-runbook-uat.md` §2). |
| **Create:** [`docs/uat/templates/uat-log-defek.template.csv`](../../uat/templates/uat-log-defek.template.csv) | Header + baris pembuka kosong pertama untuk menduplikasi ke baris baru; mengikuti struktur eskalasi [`pengurus-runbook-uat.md`](../../uat/pengurus-runbook-uat.md) §10. |
| **Create:** [`docs/uat/templates/uat-tanda-tangan.template.csv`](../../uat/templates/uat-tanda-tangan.template.csv) | Dua baris persis seperti blok tanda tangan lembar ringkas markdown. |
| **Modify:** [`docs/uat/README.md`](../../uat/README.md) | Tambah satu tautan bullet ke [`templates/README-templates-spreadsheet.md`](../../uat/templates/README-templates-spreadsheet.md). |

---

### Task 1: README template spreadsheet

**Files:**
- Create: `docs/uat/templates/README-templates-spreadsheet.md`

- [ ] **Step 1: Buat berkas berikut secara persis**

```markdown
# Template spreadsheet untuk UAT (CSV)

Paket ini melengkapi [**`pengurus-runbook-uat.md`**](../pengurus-runbook-uat.md) dan [**`lembar-hasil-uat-ringkas.md`**](../lembar-hasil-uat-ringkas.md). Isi skenario uji dan keputusan **Lulus / Gagal / Blok** di berkas `uat-hasil-skenario.template.csv` setelah mengimpor ke spreadsheet.

## Berkas di folder ini

| Berkas | Kegunaan |
| --- | --- |
| `uat-hasil-skenario.template.csv` | Satu baris per skenario `UAT-*`; isi kolom `hasil_uat`, `penguji`, `tanggal_YYYY_MM_DD`, `catatan`. |
| `uat-lingkungan.template.csv` | Salin nilai konfigurasi dari runbook §2 (BASE_URL, email akun uji, **tanpa** kata sandi). |
| `uat-log-defek.template.csv` | Satu baris per temuan **Gagal**; duplikasi baris template kosong bila perlu. |
| `uat-tanda-tangan.template.csv` | Dua baris: Eksekutor utama dan Penanggung jawab bisnis. |

## Cara impor (ringkas)

**Google Sheets:** File → Import → Upload → pilih `.csv` → pemisah koma → **As new spreadsheet** (satu berkas per CSV) atau impor ke tab terpisah.

**LibreOffice Calc:** File → Open → pilih CSV → encoding **UTF-8** → pemisah `,` → tanda petik teks standar.

**Microsoft Excel (Windows/macOS):** Data → From Text/CSV → pilih berkas → File Origin **65001: Unicode (UTF-8)** → delimiter **Comma** → Load. Jika angka di kolom ID terdistorsi, format kolom `id_skenario` sebagai **Text** sebelum edit.

## Aturan isian

- **`hasil_uat`** hanya salah satu dari: `Lulus`, `Gagal`, `Blok` (huruf kapital awal seperti contoh). Kosongkan sampai skenario selesai dijalankan.
- **`prioritas`** sudah terisi **A** atau **B**; jangan diubah kecuali penanggung jawab bisnis merevisi skenario lewat runbook.
- Untuk **Gagal**, wajib isi **catatan** ringkas **dan** tambahkan baris di `uat-log-defek.template.csv` (satu baris per defek) dengan **nomor_langkah** dari tabel runbook.
- **Jangan** mengetik kata sandi di CSV; cukup peran dan email jika perlu di kolom `peran_atau_email_akun` pada log defek.

## Pelaporan ke tim IT

Ekspor tab yang sudah diisi kembali ke CSV UTF-8 atau bagikan salinan spreadsheet hanya lewat saluran internal yang disetujui klub.

```

- [ ] **Step 2: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/uat/templates/README-templates-spreadsheet.md
git commit -m "docs(uat): add spreadsheet template README for CSV import"
```

---

### Task 2: CSV skenario hasil UAT (semua baris)

**Files:**
- Create: `docs/uat/templates/uat-hasil-skenario.template.csv`

- [ ] **Step 1: Buat berkas dengan isi persis di bawah (satu baris header + 24 baris data)**

```csv
id_skenario,judul_singkat,prioritas,hasil_uat,penguji,tanggal_YYYY_MM_DD,catatan
UAT-PUB-01,Daftar acara,A,,,,
UAT-PUB-02,Detail acara,A,,,,
UAT-PUB-03..06,Form ke konfirmasi,A,,,,
UAT-ADM-01,Login admin,A,,,,
UAT-ADM-02,2FA,B,,,,
UAT-ADM-03,Batas peran,B,,,,
UAT-EVT-01,Edit acara,B,,,,
UAT-EVT-02/03,Inbox dan detail,A,,,,
UAT-EVT-04,Setujui registrasi,A,,,,
UAT-EVT-04b,Tolak opsional,B,,,,
UAT-EVT-05,Kehadiran,B,,,,
UAT-EVT-06,Voucher,B,,,,
UAT-EVT-07,Invoice penyesuaian,B,,,,
UAT-EVT-08,Batal atau refund,B,,,,
UAT-EVT-09,Validasi anggota,B,,,,
UAT-EVT-10,Laporan dan CSV,A,,,,
UAT-DIR-01,Direktori anggota,B,,,,
UAT-MGT-01,Kepengurusan,B,,,,
UAT-VEN-01,Venue,B,,,,
UAT-SET-01,Branding,B,,,,
UAT-SET-02,Template WA,B,,,,
UAT-SET-03,Notifikasi,B,,,,
UAT-SET-04,Harga dan operasional,B,,,,
UAT-SET-05,Profil admin,B,,,,
```

- [ ] **Step 2: Verifikasi**

Hitung baris data: harus **24** (sama dengan tabel di `lembar-hasil-uat-ringkas.md` baris 7–30).

- [ ] **Step 3: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/uat/templates/uat-hasil-skenario.template.csv
git commit -m "docs(uat): add UAT scenario results CSV template"
```

---

### Task 3: CSV konfigurasi lingkungan

**Files:**
- Create: `docs/uat/templates/uat-lingkungan.template.csv`

- [ ] **Step 1: Buat berkas dengan isi persis**

```csv
kunci_nilai,isi_dicatat_oleh_tim_UAT,sumber_di_runbook
BASE_URL_staging_tanpa_slash_akhir,,pengurus-runbook-uat.md bagian 2 tabel baris BASE_URL
email_akun_Owner_atau_Admin,,pengurus-runbook-uat.md bagian 2
metode_akses_Owner_atau_Admin_password_atau_magic_link,,pengurus-runbook-uat.md bagian 2
email_akun_Verifier_opsional,,pengurus-runbook-uat.md bagian 2
email_akun_Viewer_opsional,,pengurus-runbook-uat.md bagian 2
slug_atau_nama_acara_uji_internal,,pengurus-runbook-uat.md bagian 2
nomor_anggota_dummy_jika_ada,,pengurus-runbook-uat.md bagian 2
```

- [ ] **Step 2: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/uat/templates/uat-lingkungan.template.csv
git commit -m "docs(uat): add UAT environment config CSV template"
```

---

### Task 4: CSV log defek + CSV tanda tangan

**Files:**
- Create: `docs/uat/templates/uat-log-defek.template.csv`
- Create: `docs/uat/templates/uat-tanda-tangan.template.csv`

- [ ] **Step 1: Buat `uat-log-defek.template.csv` dengan isi persis**

```csv
id_temuan_internal_opsional,id_skenario_UAT,nomor_langkah_runbook,harapan_perilaku,perilaku_aktual,waktu_kejadian_contoh_2026_05_04_14_30_WIB,peran_atau_email_akun_tanpa_password,nama_file_screenshot_atau_link_internal
,,,,,,,
```

Baris kedua (setelah header) adalah **baris kerja kosong**: penguji menduplikasi baris ini di spreadsheet untuk setiap defek baru; jangan menghapus header.

- [ ] **Step 2: Buat `uat-tanda-tangan.template.csv` dengan isi persis**

```csv
peran,nama,tanggal_YYYY_MM_DD,setuju_selesai_UAT_prioritas_A_Ya_atau_Tidak
Eksekutor utama,,,
Penanggung jawab bisnis,,,
```

- [ ] **Step 3: Commit keduanya**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/uat/templates/uat-log-defek.template.csv docs/uat/templates/uat-tanda-tangan.template.csv
git commit -m "docs(uat): add defect log and sign-off CSV templates"
```

---

### Task 5: Tautan dari `docs/uat/README.md`

**Files:**
- Modify: `docs/uat/README.md`

- [ ] **Step 1: Sisipkan bullet setelah baris lembar hasil**

Ubah berkas sehingga isi penuh menjadi:

```markdown
# Dokumentasi UAT (pengurus)

- **Panduan eksekusi:** [`pengurus-runbook-uat.md`](./pengurus-runbook-uat.md)
- **Lembar hasil:** [`lembar-hasil-uat-ringkas.md`](./lembar-hasil-uat-ringkas.md)
- **Template spreadsheet (CSV):** [`templates/README-templates-spreadsheet.md`](./templates/README-templates-spreadsheet.md)
- **User story stakeholder:** [`../user-stories-stakeholder.md`](../user-stories-stakeholder.md)
```

- [ ] **Step 2: Commit**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/uat/README.md
git commit -m "docs(uat): link spreadsheet CSV templates from UAT index"
```

---

## Self-review rencana

1. **Cakupan:** Permintaan “template spreadsheet untuk UAT” terpenuhi dengan empat CSV + README impor; selaras lembar ringkas 24 skenario.
2. **Placeholder scan:** Tidak memakai “TBD”; sel kosong CSV adalah instruksi operasional eksplisit di README.
3. **Konsistensi:** Header `id_skenario` dan ID baris sama dengan runbook dan `lembar-hasil-uat-ringkas.md`; satu variasi disengaja: `UAT-EVT-08` memakai teks “Batal atau refund” agar koma tidak memecah CSV tanpa kutip.

---

## Handoff eksekusi

**Rencana tersimpan di [`docs/superpowers/plans/2026-05-04-uat-spreadsheet-template-pack.md`](./2026-05-04-uat-spreadsheet-template-pack.md).**

**1. Subagent-driven (disarankan)** — satu sub-agent per Task 1–5.

**2. Inline** — kerjakan Task 1–5 berurutan dalam satu sesi.

**Skill pelaksana:** superpowers:subagent-driven-development atau superpowers:executing-plans.

**Pendekatan mana yang Anda ingin pakai?**
