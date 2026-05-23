# Registration Form 3-Step Wizard

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Ubah form pendaftaran publik dari satu halaman panjang menjadi wizard 2-step (di `/events/[slug]/register`) plus halaman konfirmasi status-aware (di `/events/[slug]/register/[registrationId]`).

## User Flow

```
Step 1: Isi data peserta
   ↓ klik "Lanjut"
Step 2: Ringkasan tagihan + klik "Kirim Pendaftaran"
   ↓ submitRegistration() → Registration dibuat di DB (status: submitted)
   ↓ redirect ke /events/[slug]/register/[registrationId]
Step 3 (halaman konfirmasi):
  - status submitted → form upload bukti bayar
  - status pending_review → konfirmasi "menunggu verifikasi"
  - status approved → konfirmasi "terdaftar"
```

## Decision Log

- **Submit model:** Registration dibuat saat Step 2 "Kirim" diklik (tanpa bukti bayar). Bukti bayar diupload terpisah di halaman konfirmasi. Registration bisa tersimpan tanpa bukti bayar — ini diterima karena user selalu bisa kembali ke halaman konfirmasi via URL.
- **Step indicator:** Hanya tampilkan 2 langkah di form (Data Peserta → Ringkasan & Kirim). Halaman konfirmasi berdiri sendiri, tidak terasa seperti "Step 3" yang tersambung dari form.
- **Step state:** Client-side `useState<1 | 2>`, bukan URL query param. Data form tetap di react-hook-form memory. Tombol "Kembali" di Step 2 menggantikan browser back button.

## Architecture

### Form Wizard (`/events/[slug]/register`)

`RegistrationForm` menambah `step: 1 | 2` state. Semua data form tetap di react-hook-form (tidak hilang saat pindah step).

```
registration-form.tsx  ← orchestration + step state
├── step-indicator.tsx  ← komponen baru (~30 baris)
├── step-one.tsx        ← komponen baru, ekstrak dari form saat ini
│   ├── CategoryPicker
│   ├── HolderCard × N
│   └── contactWhatsapp field
└── step-two.tsx        ← komponen baru, read-only summary
    ├── Ringkasan peserta (nama, kategori, qty, total, contactWhatsapp)
    ├── Info rekening bank + nominal yang harus ditransfer
    ├── Tombol "← Kembali"
    └── Tombol "Kirim Pendaftaran"
```

Step 1 → Step 2: `form.trigger()` untuk validasi semua field sebelum pindah.  
Step 2 submit: panggil `submitRegistration()` yang sudah tidak menerima `transferProof`.

### Halaman Konfirmasi (`/events/[slug]/register/[registrationId]`)

Server component yang fetch registration dari DB dan render panel berbeda per status:

| Status | Panel |
|--------|-------|
| `submitted` (belum ada bukti) | `UploadProofPanel` — client component dengan file picker |
| `pending_review` | `PendingReviewPanel` — info "menunggu verifikasi panitia" |
| `approved` | `ApprovedPanel` — konfirmasi "kamu terdaftar" |
| status lain (`rejected`, `cancelled`, dll) | Generic status badge + pesan |

`UploadProofPanel` setelah upload sukses memanggil `router.refresh()` sehingga page re-render ke state `pending_review` tanpa full navigation.

## Backend Changes

### Schema (`submit-registration-schema.ts`)
- Hapus field `transferProof` dari `submitRegistrationSchema` dan `SubmitRegistrationInput`.

### Server Action: `submitRegistration` (`lib/actions/submit-registration.ts`)
- Hapus semua logika upload `transferProof`.
- Registration dibuat dan tetap di status `submitted` (tidak naik ke `pending_review`).
- Blob rollback cleanup tidak diperlukan lagi di action ini.

### Server Action Baru: `uploadTransferProof` (`lib/actions/upload-transfer-proof.ts`)
```ts
export async function uploadTransferProof(
  registrationId: string,
  formData: FormData,
): Promise<ActionResult<void>>
```
1. Cari registration, verifikasi status === `submitted`.
2. Upload image via `uploadImageForRegistration({ purpose: 'transfer_proof', ... })`.
3. Update `registration.status` → `pending_review`.

## Files

### Baru
- `src/components/public/registration-form/step-indicator.tsx`
- `src/components/public/registration-form/step-one.tsx`
- `src/components/public/registration-form/step-two.tsx`
- `src/lib/actions/upload-transfer-proof.ts`
- `src/components/public/registration-form/upload-proof-panel.tsx`
- `src/components/public/registration-form/pending-review-panel.tsx`
- `src/components/public/registration-form/approved-panel.tsx`

### Dimodifikasi
- `src/components/public/registration-form/registration-form.tsx`
- `src/lib/forms/submit-registration-schema.ts`
- `src/lib/actions/submit-registration.ts`
- `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx`

## Error Handling

- Step 1 → Step 2: `form.trigger()` menampilkan inline validation errors jika ada field kosong/invalid; user tidak bisa lanjut sampai valid.
- Submit di Step 2: error dari server action ditampilkan sebagai `form.setError('root', ...)` di Step 2 (sama seperti sekarang).
- Upload bukti di `UploadProofPanel`: error ditampilkan inline di panel, file picker tetap aktif untuk retry.
- Jika registration sudah `pending_review` atau `approved` ketika user mencoba upload → action return error → panel menampilkan pesan.

## Out of Scope

- Real-time polling / WebSocket untuk update status di halaman konfirmasi (user refresh manual).
- Notifikasi WhatsApp saat bukti diupload (fitur notifikasi ada di modul terpisah).
- Pengiriman ulang bukti bayar jika sudah di-`pending_review` (admin flow yang berbeda).
