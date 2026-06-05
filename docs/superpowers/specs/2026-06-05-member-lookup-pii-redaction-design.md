# Member Lookup PII Redaction — Design Spec

**Date:** 2026-06-05  
**Status:** Approved

## Overview

Server action `lookupMemberForRegistration` saat ini mengembalikan WhatsApp dan email **plaintext** ke browser (terlihat di DevTools / RSC payload). UI kartu profil sudah menyamarkan tampilan, tetapi nilai asli tetap masuk state React dan bisa di-harvest via enumerasi nomor member.

Perbaikan: **mask/redact WA & email di boundary server**; nilai penuh hanya di-resolve saat submit lewat re-lookup DB. `fullName` tetap plaintext di response (keputusan produk).

---

## 1. Response lookup (server)

### Shape `MemberLookupResult` (status `valid`)

| Field | Wire format |
|-------|-------------|
| `fullName` | Plaintext dari `MasterMember.fullName` |
| `whatsapp` | **Masked** via `maskDisplayWhatsapp`, atau `null` jika kosong di direktori |
| `email` | **Masked** via `maskDisplayEmail`, atau `null` jika kosong di direktori |

Tidak ada field terpisah untuk nilai plaintext WA/email di response publik.

### Modul masking

- Pindahkan (atau re-export) `maskDisplayWhatsapp` dan `maskDisplayEmail` ke modul lib bersama, mis. `src/lib/members/mask-member-contact-display.ts`.
- `src/components/public/registration-form/mask-contact-display.ts` import dari modul lib yang sama agar aturan mask konsisten klien ↔ server.
- `lookupMemberForRegistration` mem-mask sebelum return.

---

## 2. Perilaku klien (`holder-card` + hook validasi)

### Setelah lookup `valid`

- **Auto-fill form:** hanya `holderName` ← `fullName`.
- **Jangan** `setValue` `holderWhatsapp` / `holderEmail` dari response lookup.
- **Kartu profil:** tampilkan `whatsapp` / `email` dari response (sudah masked server-side).
- **Ubah kontak:** field WA & email editable; pre-fill hanya dari nilai yang user ketik (bukan dari lookup).

### Tampilan kartu setelah edit / submit preview

- Jika `holderWhatsapp` / `holderEmail` di form **sudah diisi user** → mask di klien untuk kartu profil.
- Jika masih kosong → pakai masked dari response lookup terakhir.

### Alert WA/email kosong di direktori

- `memberVerifiedNoWa` / `memberVerifiedNoEmail`: cek response lookup (`null` masked field) **dan** apakah form sudah diisi user.
- Field input manual tetap muncul bila direktori kosong (perilaku existing).

---

## 3. Submit — merge server-side (`submit-registration`)

Untuk setiap holder dengan `memberType === 'tangsel'` dan `claimedMemberNumber` yang lolos re-lookup `valid`:

| Field | Sumber |
|-------|--------|
| `holderName` | Form (user boleh override) |
| `holderWhatsapp` | Form jika non-empty setelah trim; else `MasterMember.whatsapp` |
| `holderEmail` (primary / holder 0) | Form jika non-empty; else `MasterMember.email`; error jika keduanya kosong |

Re-lookup wajib memakai data **DB**, bukan payload masked dari klien.

Holder non-tangsel: tidak berubah (form adalah sumber kebenaran).

---

## 4. Testing

| Area | Cakupan |
|------|---------|
| `mask-member-contact-display` | Unit test WA/email (pindah dari atau duplikasi minimal test existing) |
| `lookupMemberForRegistration` | Response `valid` tidak mengandung substring digit WA penuh / local-part email penuh |
| `submit-registration` | Tangsel: form WA/email kosong → persist dari DB; form override → persist dari form |

---

## 5. Out of scope (v1)

- Rate limiting / throttling lookup (enumerasi nomor member).
- Masking `fullName`.
- Enkripsi kriptografis payload ke klien.
- Token lookup bertanda tangan (pendekatan B).

---

## 6. Files (expected touch)

| File | Change |
|------|--------|
| `src/lib/members/mask-member-contact-display.ts` | **New** — shared mask helpers |
| `src/lib/actions/lookup-member-for-registration.ts` | Mask WA/email on return |
| `src/lib/actions/submit-registration.ts` | Merge tangsel contact from DB |
| `src/components/public/registration-form/mask-contact-display.ts` | Re-export or import from lib |
| `src/components/public/registration-form/holder-card.tsx` | Stop autofill WA/email; display logic |
| Tests | lookup + submit merge + mask lib |

---

## 7. Invariants

- Plaintext WA/email dari direktori **tidak** boleh muncul di network response lookup.
- Submit tangsel dengan form kontak kosong harus tetap berhasil bila direktori punya WA/email (primary email wajib).
- UX kartu profil dan mode Ubah kontak tetap seperti desain sebelumnya; hanya sumber data wire yang berubah.
