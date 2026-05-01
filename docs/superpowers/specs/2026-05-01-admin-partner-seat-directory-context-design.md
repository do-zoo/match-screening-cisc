---
title: Admin — konteks tiket utama / pasangan & direktori member
date: 2026-05-01
project: match-screening
status: draft
---

## 1) Purpose

Saat ini halaman detail registrasi admin sudah menampilkan tabel tiket (`primary` | `partner`) beserta nama, WhatsApp, nomor member, dan menu. Yang belum terekspresikan dengan jelas untuk verifikasi:

- **Jenis tarif tiket** (`ticketPriceType`: member / non-member / privilege partner) — data ada di DB tetapi tidak ditampilkan di UI detail.
- **Kelayakan tiket pasangan secara bisnis**: di direktori, tiket privilege partner bergantung pada pemegang utama **`isPengurus`** pada `MasterMember`; verifikator perlu konteks cepat tanpa membuka sistem lain.

Form publik sudah membatasi kursi anggota (mis. cek tiket utama per event via `primaryMemberSeatTakenForActiveEventSlug` + `findDuplicateMemberNumbers`). Sisi admin perlu **cermin konteks yang sama**, bukan membuka jalur pemesanan baru.

## 2) Scope

### 2.1 In scope (MVP)

- **Halaman detail** `/admin/events/[eventId]/inbox/[registrationId]` saja pada iterasi pertama.
- **Tampilan baca-saja** (tidak ada aksi baru yang mengubah tiket atau aturan pengurus dari panel ini pada MVP).

Perubahan konkret yang diharapkan:

1. Tambah kolom atau sub-teks pada tabel tiket untuk **label tarif** yang manusiawi (Bahasa Indonesia) berdasarkan `ticketPriceType`.
2. Untuk setiap tiket yang punya **`memberNumber` non-null**, lakukan lookup **`MasterMember`** (by `memberNumber`) dan tampilkan:
   - **Nama canonical** dari direktori (untuk dibandingkan dengan `fullName` di tiket — opsional: satu baris hint jika tidak cocok tanpa blokir workflow).
   - **Badge atau teks “Pengurus”** jika `isPengurus === true`.
   - Jika tidak ada baris direktori: tampilkan **“Tidak ada di direktori”** (netral, tidak menuduh).
3. Untuk **`partner`** dengan **`privilege_partner_member_price`**, tampilkan **callout satu baris** (di bawah header tiket atau di baris partner) bahwa tarif tersebut mengandaikan **pemohon utama terdaftar sebagai pengurus** di direktori — dengan status aktual dicantumkan untuk tiket **`primary`** (bukan sekadar klaim formulir).

### 2.2 Out of scope (MVP)

- Menambah atau mengedit baris **`Ticket`** atau **`partner`** pasca-submit dari admin (tetap lewat pola operasional yang sudah ada, jika ada).
- **Inbox list** baru (kolom “ada pasangan?”, filter) — bisa fase kedua setelah pola detail stabil.
- **Query lintas-registrasi** “siapa lagi yang pakai nomor ini?” untuk seluruh event — **tidak diprioritaskan** selama uniqueness `(eventId, memberNumber)` di DB menjadi sumber utama kebenaran; jika kemudian dibutuhkan untuk audit-only, dibahas terpisah.
- Mengubah **Server Actions** approval / pricing — hanya jika ada bug konkret; tidak bagian dari spesifikasi MVP ini.

## 3) Pendekatan (alternatif)

### A) Sekadar menambah kolom `ticketPriceType` di tabel tiket (**paling minimal**)

**Kelebihan:** cepat, risiko rendah.

**Kekurangan:** verifikator partner/pengurus tetap harus menghafal arti kombinasi harga tanpa konteks direktori.

### B) Enrichment read-only dengan batch lookup **`MasterMember`** (disarankan)

**Kelebihan:** satu sumber konteks untuk verifikasi; selaras dengan aturan klub (`isPengurus`).

**Kekurangan:** satu query tambahan per load detail (bounded: maksimal 2 nomor unik dari tiket utama + pasangan untuk registrasi satu).

### C) Panel “Seat / konflik” yang memuat semua tiket lain di event untuk nomor tersebut

**Kelebihan:** visibilitas tinggi untuk edge case korupsi atau data historis.

**Kekurangan:** kompleksitas query + UX (false alarm jika salah interpretasi unique constraint); bisa duplikasi dengan yang sudah dicegah di submit.

## 4) Rekomendasi

**Gabungan B pada detail + unsur kecil dari A:** tampilkan **label tarif** + **snapshot direktori** per `memberNumber`. Tanpa panel konflik penuh (C) kecuali ada kebutuhan audit eksplisit nanti.

## 5) Arsitektur & data flow

- **Titik tambahan data:** pada `AdminEventInboxDetailPage` (route server component), setelah `registration` di-load, himpun `memberNumbers` unik dari `registration.tickets` (yang non-null/non-kosong).
- **Batch query:** `prisma.masterMember.findMany({ where: { memberNumber: { in: numbers } }, select: { memberNumber: true, fullName: true, isPengurus: true } })` (field nama disesuaikan dengan kolom aktual pada `MasterMember`; gunakan nama yang sama dengan yang dipakai di domain lain).
- **Mapping:** struktur keyed by `memberNumber` string → `{ directoryFullName, isPengurus }` atau `null`.
- **Render:** kirim struktur tersebut ke **`RegistrationDetail`** (props baru atau gabung ke objek tiket dalam transform ringan).

Tidak perlu endpoint API baru — semua tetap dalam RSC + props.

### 5.1 Privilege partner callout — aturan tautan dengan primary

- **Lojik tampilan:** untuk tiket `role === "partner"` dan `ticketPriceType === privilege_partner_member_price`:
  - Ambil fakta **`primary`** dari registrations yang sama: dari mapping direktori, **primary.memberNumber → isPengurus**.
  - Jika primary **tidak** punya `memberNumber`: tampilkan teks konservatif seperti “Tarif privilege partner dipilih; tiket utama tanpa nomor member di direktori — verifikasi manual.” (menyadari kombinasi aneh yang seharusnya jarang oleh validasi formulir.)

## 6) UI / penyalinan Indonesia (contoh tidak mengikat layout)

| `ticketPriceType` | Label (ID) |
|---|---|
| `member` | Tarif member |
| `non_member` | Tarif non-member |
| `privilege_partner_member_price` | Tarif privilege (pasangan) |

Badge direktori: **Pengurus** / kosong.

## 7) Hak akses & keamanan

- Halaman ini sudah memakai **`requireAdminSession`** + **`canVerifyEvent`**; tidak ada eksfiltrasi baru karena **`MasterMember`** hanya dibaca oleh admin yang sudah lolos guard yang sama seperti detail registrasi saat ini.

## 8) Error handling & edge cases

- **Tanpa nomor tiket pasangan/non-member:** abaikan lookup; tampilan tetap seperti sekarang minus kolom direktori.
- **`MasterMember.isActive === false`:** boleh menampilkan indikator ringan (“Tidak aktif”) agar verifier tidak bergantung pada member yang tidak seharusnya dipakai; ini read-only seperti lookup lain.
- **Race / data berubah setelah submit:** UI menampilkan **snapshot direktori saat ini** dengan label kecil opsional seperti “Sesuai direktori saat dibuka”; tidak mengubah harga snapshot registrasi.

## 9) Testing

- **Unit test opsional:** fungsi pemetaan `ticketPriceType` → label (pure).
- **Test integrasi prisma:** boleh ditunda; prioritas correctness via review manual pertama.

## 10) Acceptance criteria

- [ ] Tabel tiket di detail registrasi admin menampilkan **tarif tiket** per baris secara eksplisit.
- [ ] Untuk tiket dengan `memberNumber`, tampilan menunjukkan **status direktori** (ada/tidak) dan **`isPengurus`** ketika ada.
- [ ] Tiket partner dengan tariff privilege menjelaskan **keterkaitannya** dengan status pengurus pada tiket utama, tanpa mengharuskan verifier membuka codebase atau form publik.

## 11) Lintasan berikutnya (opsional — fase 2)

- Inbox: indikator “2 tiket” / “+Duo” atau serupa.
- Jika PIC meminta audit cross-registration: definisikan kasus uso terpisah (read-only drill-down).
