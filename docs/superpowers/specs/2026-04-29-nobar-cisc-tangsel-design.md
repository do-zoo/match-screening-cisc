# Nobar CISC Tangsel — Registrasi + Admin Panel (Design Spec)

Tanggal: 2026-04-29  
Project: `match-screening` (Next.js)  
Context: Sistem registrasi peserta nobar CISC Tangerang Selatan + admin panel (operasional & pelaporan) + notifikasi WhatsApp tanpa biaya (klik-to-chat).

## 1) Goals & Non-Goals

### Goals
- Peserta bisa registrasi untuk **1 kegiatan** (nobar) dan mengunggah **bukti transfer**.
- Sistem mendukung peserta **member & non-member**.
- Harga total dihitung otomatis dari:
  - **harga tiket** (member/non-member)
  - **menu** (wajib) atau **voucher menu** (harga fixed; menu dipilih belakangan).
- Admin panel untuk:
  - manajemen kegiatan
  - inbox verifikasi pendaftaran (approve/reject/payment issue)
  - laporan per kegiatan (rekap & export)
  - manajemen master data (member, PIC/rekening, admin).
- Workflow status komprehensif (termasuk attendance, cancel/refund).
- Notifikasi WhatsApp fase awal: **`wa.me` click-to-chat** + template text (tanpa API berbayar).

### Non-Goals (fase awal)
- Integrasi WhatsApp API resmi / provider (Cloud API, Qontak, dll).
- Pembayaran otomatis/VA/QRIS dan rekonsiliasi bank.
- Otomatis verifikasi member ke sistem eksternal (master member dikelola admin).

## 2) Primary Entities (Conceptual Data Model)

> Catatan: ini model konseptual untuk desain. Detail skema fisik/ORM ditentukan di fase implementation plan.

### 2.1 Kegiatan (Event)
- **Identity**: `id`, `slug`/kode kegiatan, `title`, `startAt`, `venueName`, `venueAddress`
- **Lifecycle**: `status = draft | active | finished`
- **Pricing**:
  - `ticketMemberPrice`
  - `ticketNonMemberPrice`
  - `pricingSource = global_default | overridden` (untuk audit)
- **Menu configuration**:
  - `menuMode = PRESELECT | VOUCHER`
  - `menuSelection = SINGLE | MULTI`
  - Jika `VOUCHER`:
    - `voucherPrice` (harga fixed voucher per tiket)
    - Menu list punya flag `voucherEligible = true/false`
- **PIC assignment**:
  - `picMasterMemberId` (wajib)
  - `picHelperMemberIds[]` (opsional, bisa lebih dari 1)
  - `bankAccountId` (wajib, 1 rekening per event; rekening milik PIC Master)

### 2.2 Master Member
- **Member identity**: `memberNumber` (Nomor Induk Member, unik), `fullName`
- **Status**: `isActive`
- **Privileges**:
  - `isPengurus`
  - `canBePIC` (subset dari pengurus; menentukan siapa yang boleh dipilih sebagai PIC master)

### 2.3 PIC Bank Account
Rekening yang bisa dipilih saat membuat kegiatan (terkait PIC Master).
- `id`, `ownerMemberId` (PIC master)
- `bankName`, `accountNumber`, `accountName`
- `isActive`

### 2.4 Pendaftaran (Order/Registration)
Satu pendaftaran selalu terkait **1 kegiatan** dan bisa berisi 1–2 orang (tiket).
- **Identity**: `id`, `eventId`, `createdAt`
- **Primary contact** (pengurus/pendaftar):
  - `contactName`
  - `contactWhatsapp`
- **Member claim**:
  - `claimedMemberNumber` (optional)
  - `memberCardPhoto` (required *hanya* jika klaim member/pengurus; non-member tidak wajib)
  - `memberValidation = unknown | valid | invalid | overridden`
  - `memberId` (optional) setelah divalidasi/mapped
- **Uploads**:
  - `transferProof` (required)
- **Snapshot pricing (locked at submission)**:
  - `ticketMemberPriceApplied`
  - `ticketNonMemberPriceApplied`
  - `voucherPriceApplied` (jika voucher)
  - `computedTotalAtSubmit`
  - Rationale: harga event dapat berubah, namun pendaftaran existing harus konsisten untuk menghindari dispute.
- **Operational status (S3)**:
  - `status = submitted | pending_review | payment_issue | approved | rejected | cancelled | refunded`
  - `attendanceStatus = unknown | attended | no_show` (diisi setelah hari-H)
- **Reason fields**:
  - `rejectionReason` (optional)
  - `paymentIssueReason` (optional)

### 2.5 Tiket (Person under a Registration)
Satu pendaftaran punya 1–2 tiket.
- `id`, `registrationId`, `role = primary | partner`
- `fullName`
- `whatsapp` (optional untuk partner; jika kosong, notifikasi hanya ke contact utama)
- `memberNumber` (optional; partner boleh isi juga, optional)
- `ticketPriceType = member | non_member | privilege_partner_member_price`

### 2.6 Menu / Voucher Redemption
Per tiket, ada entitlement menu:
- Jika `PRESELECT`:
  - `selectedMenuItemIds[]` (1 atau banyak tergantung `menuSelection`)
- Jika `VOUCHER`:
  - `voucherRedeemedMenuItemId` (dipilih belakangan, harus `voucherEligible`)
  - `voucherRedeemedAt` (optional)

### 2.7 Invoice Adjustment (Kekurangan/Perubahan Total)
Untuk kasus admin override member/non-member atau koreksi harga/kuantitas yang menghasilkan selisih.
- `id`, `registrationId`
- `type = underpayment | other_adjustment`
- `amount`
- `status = unpaid | paid`
- `paymentProof` (optional; bisa diupload peserta atau diinput admin)
- `paidAt` (optional)

## 3) Business Rules (Must-Haves)

### 3.1 Member vs Non-member
- Jika peserta mengisi `Nomor Induk Member`, sistem menganggap **claim member** (pending validasi).
- Admin memvalidasi terhadap **Master Member**.
- Jika **invalid**, admin boleh:
  - override jadi non-member dan membuat **invoice selisih** (kekurangan)
  - atau override jadi member (manual decision) bila ada alasan operasional.

### 3.2 Limit 1 Member per Event
- Setiap `memberNumber` hanya boleh memiliki **maksimum 1 tiket per kegiatan**.
  - Berlaku untuk primary maupun partner jika partner juga mengisi memberNumber.
  - Tujuan: mencegah double booking / multiple tiket atas 1 member.

### 3.3 Pengurus + Privilege Partner (Opsional)
- Jika primary adalah **pengurus**, sistem menyediakan opsi `qtyPartner = 0 | 1` (default 0).
- Jika `qtyPartner = 1`:
  - `partnerName` wajib
  - `partnerWhatsapp` optional
  - partner dapat harga tiket **member** via `ticketPriceType = privilege_partner_member_price`
  - partner `memberNumber` optional; jika diisi, tetap kena rule limit 1 member/event.

### 3.4 Menu wajib dan Voucher Mode
- Setiap tiket harus memiliki entitlement menu:
  - `PRESELECT`: menu dipilih saat registrasi (single/multi tergantung event).
  - `VOUCHER`: peserta membayar voucher (harga fixed) saat registrasi, lalu memilih menu **belakangan** (hari-H / saat konfirmasi hadir).
- Pada mode `VOUCHER`, penukaran hanya boleh memilih dari menu yang ditandai `voucherEligible`.
- Tidak ada top-up/selisih menu di mode voucher (semua voucher-eligible dianggap setara untuk voucher tersebut).

### 3.5 Pricing Formula (Locked)
Untuk setiap pendaftaran, total dihitung dan **di-lock** saat submit:
- Ticket cost:
  - primary: member/non-member (tergantung claim & hasil verifikasi/override)
  - partner (jika ada): `privilege_partner_member_price` (harga member)
- Menu/voucher cost: per tiket (bisa 1 atau 2 tiket)
- `computedTotalAtSubmit` menjadi baseline.
- Jika admin melakukan override yang mengubah total, gunakan **Invoice Adjustment** untuk selisih (tidak mengubah baseline historis secara diam-diam).

### 3.6 Event Payment Account
- Setiap kegiatan harus memilih **tepat 1 rekening** untuk pembayaran.
- Rekening tersebut berasal dari **PIC Master** kegiatan.

## 4) Admin & Permissions

### 4.1 Admin authentication methods
- Admin login mendukung:
  - Email + password
  - Magic link (email)

### 4.2 Roles (Global)
- `Owner`: kelola admin, master member, global defaults (pricing), PIC & rekening, template WA, dan seluruh data.
- `Verifier`: operasional event (inbox), verifikasi pendaftaran, invoice selisih, attendance, cancel/refund.
- `Viewer`: lihat dashboard/laporan/export tanpa aksi verifikasi.

### 4.3 PIC Assignments (Per Event) + Hybrid Permission
Kegiatan punya:
- **PIC Master** (wajib 1): finance owner untuk rekening & rujukan pembayaran.
- **PIC Helper** (opsional, bisa >1): backup operasional jika master berhalangan.

Aturan akses (hybrid):
- Role global tetap berlaku.
- Namun, jika seorang admin ditugaskan sebagai **PIC Helper** pada kegiatan X, ia mendapatkan **capability Verifier** *hanya untuk kegiatan X*, walaupun role global-nya `Viewer`.
- PIC assignment tidak mempengaruhi kegiatan lain.

## 5) Admin Panel: Information Architecture (Menus)

### 5.1 Dashboard
- Ringkasan per kegiatan:
  - total pendaftaran
  - counts per status: pending_review, payment_issue, approved, rejected, cancelled, refunded
  - attendance: attended/no_show
  - total revenue (baseline) + total adjustments (kekurangan dibayar)

### 5.2 Kegiatan (CRUD)
- Buat/edit kegiatan:
  - info event (judul, waktu, lokasi, status)
  - pricing (global default → boleh override per event)
  - menu settings: PRESELECT/VOUCHER + SINGLE/MULTI + voucherPrice + voucherEligible flags
  - pilih PIC Master, PIC Helpers
  - pilih 1 rekening (milik PIC Master)

### 5.3 Inbox Pendaftaran (Per Kegiatan)
List + filter + detail drawer/page:
- Data pendaftaran: kontak, claimed member, bukti TF, total snapshot
- Data tiket: primary + partner (jika ada) + status attendance
- Data menu/voucher: selected menus atau voucher redemption
- Actions:
  - set status: approve / reject (dengan alasan) / payment_issue (dengan alasan)
  - override member validation (valid/invalid/overridden) dan ticketPriceType bila perlu
  - buat invoice selisih (auto dari perubahan total), set unpaid/paid, upload proof (admin)
  - set attendance: attended / no_show
  - cancel / refund
- WA helpers:
  - tombol `wa.me` untuk template pesan (receipt, approve, payment issue, invoice selisih, dsb)

### 5.4 Master Member
- CRUD member (memberNumber, nama, active)
- Flag privileges: isPengurus, canBePIC

### 5.5 Settings Panitia (Owner-only)
- Admin management:
  - buat admin baru
  - assign global role
- PIC bank accounts:
  - buat/edit rekening per PIC Master
  - aktif/nonaktif
- Global defaults:
  - default ticketMemberPrice & ticketNonMemberPrice untuk kegiatan baru
- WhatsApp templates (text)

### 5.6 Reports (Laporan)
Per kegiatan + range filter:
- Rekap peserta:
  - member vs non-member
  - pengurus+partner usage
- Rekap uang:
  - total baseline (computedTotalAtSubmit)
  - total adjustments (paid/unpaid)
  - refunds
- Rekap menu/voucher:
  - count per menu
  - voucher redeemed vs not redeemed
- Attendance:
  - attended/no_show
- Export CSV

## 6) Participant UX (Front Office)

### 6.1 Browse & Select Event
- Landing / list kegiatan active
- Pilih kegiatan → masuk halaman registrasi

### 6.2 Registration Form (per event)
Fields:
- Nama lengkap (contact)
- Nomor WhatsApp (contact)
- Nomor Induk Member (optional)
- Upload bukti transfer (required)
- Upload foto kartu member (required jika klaim member/pengurus; tidak wajib untuk non-member)
- Partner option:
  - `qtyPartner = 0/1`
  - jika 1: partner name wajib, WA optional, memberNumber optional
- Menu/voucher:
  - PRESELECT: pilih menu (single/multi)
  - VOUCHER: tidak memilih menu saat registrasi; hanya menyatakan entitlement voucher per tiket
- Total harga:
  - dihitung otomatis dan ditampilkan sebagai ringkasan + breakdown

Submission result:
- status awal: `submitted` lalu `pending_review`
- tampilkan instruksi pembayaran sesuai rekening event (dari PIC Master)

## 7) Notifications (WhatsApp, No-budget Mode)

### 7.1 Mechanism
- Sistem tidak mengirim WA otomatis.
- Sistem menyediakan tombol `wa.me/<nomor>?text=<encoded_template>` pada admin panel dan (opsional) halaman setelah submit.

### 7.2 Minimum Templates
- Receipt (setelah submit)
- Request clarification (payment issue)
- Invoice underpayment (tagihan kekurangan)
- Approved (konfirmasi + detail kegiatan + aturan voucher/menu)
- Cancelled / Refunded (jika dipakai)
- Attendance reminder (optional)

## 8) Status Machine (S3) — Operational Semantics

### 8.1 Registration status
- `submitted`: berhasil submit form (internal)
- `pending_review`: menunggu admin cek bukti/validasi
- `payment_issue`: ada kekurangan/masalah bukti, menunggu aksi peserta/admin
- `approved`: ok ikut event
- `rejected`: ditolak (alasan wajib)
- `cancelled`: dibatalkan (oleh admin atau policy)
- `refunded`: dana dikembalikan (jika ada)

### 8.2 Attendance status
- `unknown`: default
- `attended`: hadir
- `no_show`: tidak hadir

Rules:
- Attendance hanya meaningful jika status `approved` (atau bisa dicatat meski cancelled untuk audit, namun UI sebaiknya membatasi).

## 9) Edge Cases & Validation

- Partner WA kosong → semua WA templates default dikirim ke `contactWhatsapp`.
- Jika `claimedMemberNumber` invalid:
  - admin boleh override
  - jika total berubah, buat invoice underpayment + minta bukti bayar selisih
- Voucher redemption:
  - hanya bisa pilih menu voucherEligible
  - log timestamp redemption
- Duplicate member per event:
  - sistem mencegah penyimpanan tiket kedua dengan memberNumber sama di event yang sama (harus ada error yang jelas di admin UI).

## 10) Success Criteria (MVP Acceptance)
- Admin bisa buat kegiatan, set harga default/override, set mode voucher/preselect, set PIC Master+Helper, dan pilih 1 rekening.
- Peserta bisa registrasi, upload bukti TF, total dihitung otomatis, dan tersimpan snapshotnya.
- Admin bisa memverifikasi pendaftaran, mengubah status, mencatat attendance, cancel/refund.
- Admin bisa override member invalid → generate invoice selisih → input bukti bayar selisih.
- Laporan per kegiatan bisa diexport.
- WA click-to-chat bekerja dari admin panel dengan template yang sesuai status.
