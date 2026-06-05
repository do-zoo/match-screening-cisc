# Member-Only Event Access — Design Spec

**Date:** 2026-06-05  
**Status:** Approved

## Problem

Saat ini semua acara publik menerima pendaftaran member dan non-member. Admin tidak bisa menandai acara yang hanya boleh diikuti member CISC — baik member Tangsel (direktori lokal) maupun member CISC secara luas (Tangsel + regional dengan upload bukti).

## Goal

Tambah **mode akses pendaftaran per acara** dengan tiga pilihan mutually exclusive:

1. **Acara umum** — semua boleh daftar (perilaku saat ini)
2. **Hanya member CISC Tangsel** — wajib klaim via lookup `MasterMember`
3. **Hanya member CISC** — Tangsel (lookup) atau regional (manual + bukti kartu); non-member ditolak

---

## Keputusan Desain

### 1. Schema — enum `MemberAccessMode`

```prisma
enum MemberAccessMode {
  open
  tangsel_only
  cisc_members
}

model Event {
  // ... existing fields ...
  memberAccessMode MemberAccessMode @default(open)
}
```

**Default:** `open` — acara existing setelah migrasi tetap umum.

**Lock:** Tidak ada. Admin boleh mengubah mode kapan saja, termasuk setelah ada pendaftar.

**Alternatif ditolak:** Dua boolean (`restrictToMembers` + `allowRegional`) — kombinasi invalid sulit dicegah dan kurang readable.

---

### 2. Admin Event Editor

**Lokasi:** `event-admin-form.tsx`, section baru **"Akses pendaftaran"**, dikelompokkan dekat `multiCategoryPurchase` / `requireAllHolderData`.

**UI:** Tiga checkbox yang berperilaku **mutually exclusive** (centang satu → yang lain lepas). Bukan radio button — sesuai permintaan pengurus, tetapi validasi form memastikan tepat satu mode terpilih.

| Checkbox | `memberAccessMode` |
|----------|-------------------|
| Acara umum | `open` |
| Hanya member CISC Tangsel | `tangsel_only` |
| Hanya member CISC (Tangsel + regional) | `cisc_members` |

**Payload:** `memberAccessMode` disertakan di `admin-event-form-schema.ts` dan `updateAdminEvent` / create flow.

#### Harga tiket (panel kategori)

| Mode | Field admin |
|------|-------------|
| `open` | `regularPrice` + `memberPrice` (seperti sekarang) |
| `tangsel_only` / `cisc_members` | **Hanya input `memberPrice`** |

Saat simpan acara/kategori member-only, server **menyalin** `regularPrice := memberPrice` agar schema `EventTicketCategory` tetap utuh dan laporan lama tidak pecah. Admin tidak mengisi harga reguler manual.

---

### 3. Halaman Publik

#### Daftar acara (`/`) & kartu acara

- Acara member-only **tetap tampil** (tidak disembunyikan).
- Badge:
  - `tangsel_only` → **"Khusus member Tangsel"**
  - `cisc_members` → **"Khusus member CISC"**
- Harga di kartu: **hanya `memberPrice`** (dari kategori aktif); harga reguler tidak ditampilkan.

#### Detail acara (`/events/[slug]`)

- Badge sama di header/ringkasan.
- Blok harga: hanya harga member per kategori + catatan: *"Acara khusus member — harga berlaku untuk member yang memenuhi syarat."*
- **Form pendaftaran tetap dirender** — tidak ada auth publik; member mendaftar lewat form seperti biasa. Yang dibatasi adalah **jalur non-member**, bukan seluruh halaman.

**Serialisasi:** Tambah `memberAccessMode` ke `SerializedEventForRegistration` / `event-serialization.ts` dan query halaman registrasi.

---

### 4. Form Pendaftaran — `HolderCard`

Banner di atas wizard (jika bukan `open`):

| Mode | Teks banner |
|------|-------------|
| `tangsel_only` | *"Acara ini khusus member CISC Tangsel. Daftar dengan nomor anggota yang terdaftar di direktori."* |
| `cisc_members` | *"Acara ini khusus member CISC. Non-member tidak dapat mendaftar."* |

**Opsi radio keanggotaan:**

| Mode | Opsi yang tampil |
|------|------------------|
| `open` | Non-Member · Member CISC Tangsel · Member CISC regional *(existing)* |
| `tangsel_only` | **Hanya** Member CISC Tangsel |
| `cisc_members` | Member CISC Tangsel · Member CISC regional *(tanpa Non-Member)* |

Default selected saat member-only: Tangsel (untuk `tangsel_only`) atau tidak pre-select (untuk `cisc_members` — pendaftar pilih Tangsel/regional).

**Preview harga client:** Selalu `memberPrice` untuk acara member-only (`computeSubmitTotal` / `use-pricing-preview`).

---

### 5. Aturan Multi-Tiket

| Situasi | Aturan |
|---------|--------|
| Semua mode member-only | **Holder 1 (pemesan utama)** wajib memenuhi syarat `memberAccessMode` |
| `requireAllHolderData = true` | **Setiap holder** wajib memenuhi syarat yang sama |
| `requireAllHolderData = false` | Hanya holder 1 di form; server kloning ke slot 2+ *(existing)* — karena holder 1 wajib member, tiket tambahan otomatis member |

---

### 6. Validasi Server — `submitRegistration`

Guard baru setelah parse Zod dan sebelum transaksi, pada holder yang dievaluasi:

- Jika `requireAllHolderData`: semua holder di input (sebelum kloning)
- Jika `!requireAllHolderData`: holder 1 saja (kloning terjadi setelah validasi eligibility holder 1)

| Mode | Tolak jika |
|------|------------|
| `open` | — |
| `tangsel_only` | `memberType !== 'tangsel'` **atau** nomor kosong / lookup tidak valid saat submit |
| `cisc_members` | `memberType` null/undefined (Non-Member) |

**Pesan error (Indonesia):**

- `tangsel_only`: *"Acara ini khusus member CISC Tangsel. Nomor anggota wajib terdaftar di direktori."*
- `cisc_members`: *"Acara ini khusus member CISC. Pilih status keanggotaan member saat mendaftar."*

Regional di acara `tangsel_only`: ditolak di server meskipun UI sudah menyembunyikan opsi regional.

**Tidak berubah:**

- `lookupMemberForRegistration`
- Alur verifikasi admin / `MemberValidationPanel`
- Regional tetap `memberValidation = unknown` + harga member di preview pending verifikasi (sama seperti acara umum)

---

### 7. Library Module

**Baru:** `src/lib/events/member-access-mode.ts`

```ts
export function allowedMemberTypesForMode(mode: MemberAccessMode): ('tangsel' | 'regional')[] | 'all'
export function assertHolderEligibleForMemberAccessMode(
  holder: { memberType?: 'tangsel' | 'regional' | null; claimedMemberNumber?: string },
  mode: MemberAccessMode,
  tangselLookupValid?: boolean,
): { ok: true } | { ok: false; message: string }
export const MEMBER_ACCESS_MODE_BADGE: Record<MemberAccessMode, string | null>
export const MEMBER_ACCESS_MODE_BANNER: Record<MemberAccessMode, string | null>
```

Pure functions — unit test tanpa mock DB.

---

### 8. Testing

| File | Cakupan |
|------|---------|
| `member-access-mode.test.ts` | Eligibility per mode; edge cases regional vs tangsel |
| `submit-registration.integration.test.ts` | Reject non-member (`cisc_members`); reject regional (`tangsel_only`); accept tangsel valid |
| `admin-events.integration.test.ts` | Persist `memberAccessMode`; sync `regularPrice` saat member-only |

---

### 9. Dokumentasi

Update `CLAUDE.md`:

- Enum `MemberAccessMode` di **Data model**
- Field `Event.memberAccessMode`
- Modul `lib/events/member-access-mode.ts` di **Key library modules**

---

## Out of Scope

- Menyembunyikan acara member-only dari homepage
- Login publik / gate berbasis session sebelum form
- Lock `memberAccessMode` setelah pendaftar
- Kategori tiket terpisah hanya untuk member vs umum (mode acara sudah cukup)

---

## Ringkasan Requirements (dari brainstorming)

| Topik | Keputusan |
|-------|-----------|
| Jenis acara | 3 mode: umum / Tangsel only / CISC (Tangsel + regional) |
| UI admin | 3 checkbox mutually exclusive |
| Visibilitas publik | Tampil + badge + blok jalur non-member |
| Multi-tiket | Pemesan utama wajib member; jika `requireAllHolderData`, semua holder wajib member |
| Harga publik | Hanya member price + catatan |
| Harga admin | Hanya field member price; `regularPrice` disinkronkan server-side |
| Lock setting | Tidak — boleh diubah kapan saja |
