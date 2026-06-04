# Regional Member Claim — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Pendaftar yang merupakan member Chelsea Indonesia Supporters Club (CISC) dari chapter **regional lainnya** (bukan Tangsel) tidak terdaftar di direktori `MasterMember` lokal. Saat ini mereka terpaksa mendaftar sebagai Non-Member dan kehilangan hak harga member. Fitur ini menambah jalur khusus: pendaftar pilih "Member CISC regional lainnya", isi data manual, upload bukti kartu member dari panel chelseaindo, lalu admin memverifikasi bukti sebelum approve.

---

## 1. UI — Holder Card: Tiga Radio Keanggotaan

### Sebelum (2 opsi)
```
[ Non-Member ]   [ Member CISC ]
```

### Sesudah (3 opsi)
```
[ Non-Member ]   [ Member CISC Tangsel ]   [ Member CISC regional lainnya ]
```

**Radio 1 — Non-Member** (tidak berubah)  
Form: Nama Lengkap + WhatsApp.

**Radio 2 — Member CISC Tangsel** (ganti label, behavior tidak berubah)  
Form: input Nomor Member → debounced lookup ke `MasterMember`. Jika ditemukan: tampilkan verified card. Jika tidak ditemukan: pesan error "Nomor tidak terdaftar di direktori" (tetap, tidak ada fallback inline — pendaftar dari regional cukup pindah ke opsi 3).

**Radio 3 — Member CISC regional lainnya** (baru)  
Form muncul langsung saat radio dipilih. Field (semua wajib kecuali nomor):

| Field | Keterangan |
|---|---|
| Nomor Member | Nomor dari chapter regional mereka (bebas format, tidak di-lookup) |
| Nama Lengkap | Manual input |
| Nomor WhatsApp | Manual input |
| Bukti Kartu Member | Upload foto / screenshot member ID dari panel chelseaindo. Wajib sebelum submit. |

Callout info di atas form: *"Isi data keanggotaanmu dan upload bukti kartu member. Panitia akan memverifikasi setelah pendaftaran masuk."*

**Pricing preview (client-side)**  
Regional lainnya → tampilkan harga member (sama seperti Tangsel terverifikasi). Label: *"harga member — pending verifikasi"*. Server tetap menyimpan harga reguler (`unknown` path) — admin yang menentukan harga final saat verifikasi.

**Validasi submit**  
Form tidak bisa di-submit jika holder dengan opsi "regional lainnya" belum memilih file. Validasi dilakukan di client sebelum `FormData` dikirim ke server action.

---

## 2. Data Model

### 2a. Enum baru: `MemberType`

```prisma
enum MemberType {
  tangsel
  regional
}
```

Ditambahkan ke `RegistrationHolder`:

```prisma
model RegistrationHolder {
  // ... field existing ...
  memberType  MemberType?   // null = non-member
}
```

- `null` → Non-Member
- `tangsel` → klaim via lookup direktori (Member CISC Tangsel)
- `regional` → klaim via manual + upload bukti (Member CISC regional lainnya)

### 2b. Field `registrationHolderId` di `Upload`

```prisma
model Upload {
  // ... field existing ...
  registrationHolderId String?
  registrationHolder   RegistrationHolder? @relation(fields: [registrationHolderId], references: [id], onDelete: Cascade)
}
```

Relasi ini dipakai untuk upload `member_card_photo` agar bisa dikaitkan ke holder spesifik (penting jika ada beberapa holder regional dalam satu transaksi).

`UploadPurpose.member_card_photo` dipakai untuk semua upload bukti member, per holder.

---

## 3. Form Schema

`holderSchema` di `lib/forms/submit-registration-schema.ts` ditambah:

```ts
memberType: z.enum(['tangsel', 'regional']).optional(), // null/undefined = non-member
```

File upload bukti **tidak** masuk ke `holderSchema` (RHF tidak mengelola `File`). File dibaca dari input element secara manual dan diappend ke `FormData` dengan key `memberCardPhoto_{index}` sebelum memanggil server action.

`claimedMemberNumber` tetap opsional (`z.string().trim().optional()`) — tidak berubah dari schema yang ada. Untuk holder regional, nomor member tidak wajib (cukup nama, WA, dan bukti foto).

---

## 4. Server Action: `submitRegistration`

Perubahan di `lib/actions/submit-registration.ts`:

1. **Parse file uploads**: Baca `formData.get('memberCardPhoto_{i}')` untuk setiap holder dengan `memberType === 'regional'`. Validasi: file harus ada (jika holderType regional).

2. **Buat Registration + RegistrationHolder** (dalam transaksi Prisma seperti sekarang). Simpan `memberType` ke setiap `RegistrationHolder`.

3. **Upload member card photos** (di luar transaksi, setelah `registrationId` tersedia): Untuk setiap holder regional, panggil `uploadImageForRegistration` dengan `purpose: 'member_card_photo'` dan simpan `registrationHolderId`. Jika upload gagal, server tetap mengembalikan `ok({ registrationId })` — registration sudah dibuat dan tidak dibatalkan. Error upload dicatat di server log. Admin dapat melihat bahwa tidak ada foto yang terupload untuk holder regional tersebut dan menghubungi pendaftar secara manual untuk kirim ulang.

4. **Pricing**: Tidak berubah — server tetap pakai `unknown` untuk semua, termasuk regional.

---

## 5. Admin Side

### Tab Ringkasan — Holders Section

Kolom tabel ditambah kolom **Tipe Member**:

| Holder | Tipe Member | No. Member | Validasi |
|---|---|---|---|
| Budi S. | Tangsel | 00123 | valid |
| Reza A. | Regional | MBR-JKT-456 | unknown |

Untuk holder regional: tampilkan link thumbnail / tombol "Lihat bukti" yang membuka upload `member_card_photo` untuk holder tersebut (sudah ada pola di tab Verifikasi untuk upload lain).

### Tab Verifikasi

Upload `member_card_photo` yang terhubung ke holder regional muncul di sini, berlabel *"Foto kartu member (regional)"*. Admin dapat membuka gambar, lalu set `memberValidation` ke `valid` atau `invalid` seperti biasa.

Tidak ada perubahan pada flow verifikasi yang sudah ada.

---

## 6. Migrasi Database

Dua migrasi diperlukan:

1. Tambah `enum MemberType { tangsel regional }` dan kolom `memberType MemberType?` ke `RegistrationHolder`.
2. Tambah kolom `registrationHolderId String?` dan relasi ke `Upload`.

Data lama tidak perlu diisi (`null` pada kedua kolom adalah valid dan bermakna "non-member" / "upload tidak terhubung ke holder spesifik").

---

## 7. Out of Scope

- Tidak ada perubahan pada flow verifikasi admin (set `valid`/`invalid`/`overridden`).
- Tidak ada notifikasi otomatis ke pendaftar saat bukti diverifikasi (notifikasi sudah ada via flow approve/reject yang ada).
- Tidak ada setting per-acara untuk mengaktifkan/menonaktifkan opsi regional member.
- `partner_member_card_photo` (`UploadPurpose`) tidak dihapus di rilis ini (backward compat untuk data lama).
