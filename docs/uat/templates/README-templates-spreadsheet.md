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
- Untuk **Gagal**, wajib isi **catatan** ringkas **dan** tambahkan baris di `uat-log-defek.template.csv` (satu baris per defek) dengan **nomor_langkah_runbook** dari tabel runbook.
- **Jangan** mengetik kata sandi di CSV; cukup peran dan email jika perlu di kolom `peran_atau_email_akun_tanpa_password` pada log defek.

## Pelaporan ke tim IT

Ekspor tab yang sudah diisi kembali ke CSV UTF-8 atau bagikan salinan spreadsheet hanya lewat saluran internal yang disetujui klub.
