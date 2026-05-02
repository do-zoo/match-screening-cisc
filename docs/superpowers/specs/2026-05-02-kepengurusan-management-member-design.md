# Design: Kepengurusan klub (`ManagementMember`) & sinkron direktori

**Status:** Draft implementasi — menyatukan keputusan brainstorm (2026-05-02) dengan codebase setelah pemisahan PIC acara ke `AdminProfile`.

## 1. Tujuan & luar ruang

**Tujuan**

- Mengelola **struktur kepengurusan** per **periode** (label + rentang tanggal): siapa memegang **jabatan** apa.
- Menyediakan **identitas pengurus** yang bisa **tanpa nomor member**, dengan **kode publik** pendek untuk digunakan di **pendaftaran acara**.
- Menjaga **jejak perubahan** (audit) untuk mutasi penting.
- Mempertahankan **satu sumber kebenaran operasional** untuk hak **tiket partner / pengurus di direktori**: kolom `MasterMember.isManagementMember` **disinkronkan** dari penugasan kepengurusan yang berlaku (ketika ada tautan ke direktori).

**Luar ruang (v1)**

- Hierarki organisasi (“melapor ke siapa”), dokumen AD/ART, notifikasi WA otomatis saat rotasi pengurus.
- Mengubah model **PIC acara** (sudah **`picAdminProfileId`** / **`PicBankAccount.ownerAdminProfileId`**) — PIC adalah peran **admin aplikasi**, bukan bagian dari modul ini.

## 2. Istilah & pemisahan konsep

| Konsep | Arti di sistem |
|--------|----------------|
| **Admin (`AdminProfile`)** | Akses panel; **PIC keuangan acara** dipilih di event dari profil admin (bukan dari flag direktori). |
| **`MasterMember`** | Direktori anggota klub; `isManagementMember` menyatakan **eligible** sesuai aturan bisnis (tiket partner, dll.) — **bukan** “jabatan organisasi” secara resmi. |
| **`ManagementMember`** | Orang dalam struktur kepengurusan resmi; boleh tidak punya baris `MasterMember`; punya **kode publik** untuk identitas di form publik. |
| **Kepengurusan / pengurus (UI)** | Modul admin **menu setara Anggota** (bukan subhalaman hanya di master anggota). |

## 3. Kebijakan produk yang disepakati

1. **Satu jabatan** per orang **per periode** (satu `BoardAssignment` aktif per orang per periode).
2. **Periode** punya **label tampilan** dan **`startsAt` / `endsAt`** untuk logika “aktif” dan arsip.
3. **`isManagementMember` di direktori:** **sinkron otomatis** dengan penugasan pada periode yang dianggap **berlaku sekarang** untuk orang yang **tertaut** ke `MasterMember`; orang pengurus **tanpa** tautan tidak menulis ke kolom itu (hak di acara lewat **kode pengurus**).
4. **Kode publik:** format **singkat** disimpan di DB, **unik global**, dipetakan ke id internal `ManagementMember`; normalisasi input (trim, konsistensi huruf) di server.
5. **Navigasi:** entri sidebar global **setingkat** dengan **Anggota** (gate akses selaras kebijakan saat ini untuk konten operasional — mis. Owner/Admin seperti daftar anggota).

## 4. Model data (Prisma — nama dapat dirapikan saat implementasi)

### 4.1 `BoardPeriod`

- `id`, `label` (string), `startsAt`, `endsAt` (`DateTime`).
- Constraint bisnis: **tidak ada dua periode yang overlap** pada rentang tanggal (atau satu flag “canonical active” — **pilih satu strategi** implementasi; default yang disarankan: **non-overlapping** + indeks/cek aplikasi).

### 4.2 Jabatan (`BoardRole`)

- **Opsi A (disarankan v1):** tabel **`BoardRole`** dengan `id`, `title`, `sortOrder`, `isActive` — Owner dapat menambah/judul tanpa deploy.
- **Opsi B:** enum Prisma — cepat tetapi kurang fleksibel untuk nama jabatan yang berubah tiap kabinet.

Spesifikasi ini mengasumsikan **Opsi A** kecuali implementasi memilih B dengan alasan eksplisit.

### 4.3 `ManagementMember`

- `id` (cuid), **`publicCode`** (string, **unique**, normalisasi uppercase atau sesuai konvensi tunggal).
- `fullName`, kontak (mis. `whatsapp` nullable) sesuai kebutuhan verifikasi admin.
- **`masterMemberId`** nullable, FK ke `MasterMember` — ketika diisi, menyambungkan identitas pengurus dengan direktori untuk sinkron `isManagementMember`.

### 4.4 `BoardAssignment`

- FK: `boardPeriodId`, `managementMemberId`, `boardRoleId`.
- Unique: **`(boardPeriodId, managementMemberId)`** dan **`(boardPeriodId, boardRoleId)`** agar satu orang satu jabatan dan satu jabatan satu orang per periode.

### 4.5 Relasi audit

- Tidak duplikasi log di `ManagementMember` untuk setiap field — gunakan **`ClubAuditLog`** dengan `action` baru dan `metadata` JSON (lihat §7).

## 5. Periode “aktif” & sinkron `isManagementMember`

**Definisi “hari ini dalam periode P”:** `startsAt <= now < endsAt` (timezone: gunakan **UTC** di DB + kebijakan tampilan admin eksplisit, atau satu zona klub — **tetapkan satu** di implementasi; default: **simpan UTC**, tampilkan di UI dengan zona Asia/Jakarta jika sudah dipakai di aplikasi).

**Algoritma recompute (setelah create/update/delete assignment atau ubah periode):**

1. Kumpulkan semua `managementMemberId` yang terdampak (baris assignment yang berubah + orang yang pernah tertaut).
2. Untuk setiap `ManagementMember` dengan `masterMemberId` tidak null:  
   `isManagementMember =` ada penugasan untuk **periode aktif** yang mencakup **hari ini** yang melibatkan rekaman ini.
3. Untuk `MasterMember` yang **tidak** lagi menjadi target tautan dari pengurus aktif: set `false` (hanya jika tidak ada penugasan lain yang masih menuntut `true`).

**Anggota direktori tanpa rekaman pengurus:** hanya diubah oleh alur ini jika mereka **pernah** tertaut; jangan set manual flag menjadi tertimpa kecuali kebijakan eksplisit “manual override” ( **luar ruang v1** ).

## 6. Pendaftaran acara & verifikasi admin

- **Jalur A — nomor member:** tetap seperti sekarang; `isManagementMember` pada `MasterMember` mengikuti sinkron §5.
- **Jalur B — kode pengurus:** pada tiket utama (atau field khusus), peserta memasukkan **`publicCode`**; server memvalidasi: `ManagementMember` ada, penugasan pada periode aktif, dan aturan harga/tiket partner mengikuti kebijakan yang sama dengan “pengurus” secara fungsional.
- Panel admin (detail registrasi): menampilkan status yang jelas — klaim via **direktori** vs **kode pengurus** (supaya verifikator tidak mengira satu-satunya sumber adalah nomor member).

## 7. Audit (`ClubAuditLog`)

Tambah konstanta aksi (contoh nama, final saat coding):

- `board_period.created` / `updated`
- `board_role.created` / `updated` / `deactivated`
- `management_member.created` / `updated` / `public_code_changed`
- `board_assignment.created` / `updated` / `removed`
- `directory.management_member_sync` (opsional, atau gabung ke assignment dengan metadata)

**Metadata:** selalu sertakan id terkait, label periode, kode publik lama/baru bila relevan, tanpa data sensitif berlebihan.

## 8. UI admin (ringkas)

- **Sidebar:** item **Kepengurusan** / **Pengurus** (label produk Indonesia), route mis. `/admin/management` atau `/admin/board` — **tetapkan satu slug** saat implementasi.
- **Layar:** daftar periode, detail periode dengan roster (orang + jabatan), CRUD `ManagementMember`, generate/ubah **kode publik** dengan validasi unik.
- **Izin:** selaras **Owner/Admin** untuk struktur data klub (sama pola dengan master anggota); Viewer read-only jika produk menginginkan.

## 9. Pengujian & migrasi

- **Unit:** generator/recompute `isManagementMember` murni (tanpa DB) jika diekstrak ke fungsi.
- **Integrasi:** minimal satu skenario periode aktif + assignment + tautan `masterMemberId`.
- **Migrasi DB:** tabel baru; data awal kosong; tidak menghapus perilaku PIC acara.

## 10. Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Overlap periode | Validasi di server action + constraint / partial unique jika didukung |
| Duplikasi kode publik | Unique DB + pesan error bahasa Indonesia |
| Admin menghapus tautan `masterMemberId` | Recompute set `isManagementMember` untuk member tersebut |
| Kebingungan PIC acara vs pengurus klub | Dokumentasi UI singkat; PIC hanya di editor acara (`AdminProfile`) |

---

## Self-review (internal)

- Tidak ada placeholder `TBD` yang menghalangi implementasi; satu keputusan tersisa eksplisit: **BoardRole = tabel (disarankan)** vs enum.
- Konsisten dengan pemisahan PIC (`AdminProfile`) dan direktori (`MasterMember`).
- Ruang lingkup cukup untuk satu rencana implementasi bertahap (model → sinkron → UI → form publik).
