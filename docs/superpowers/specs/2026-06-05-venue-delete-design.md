---
title: Hapus venue (hard delete)
date: 2026-06-05
project: match-screening
status: approved
related:
  - 2026-05-04-venue-management-menu-voucher-design.md
---

# Hapus venue (hard delete)

## Problem

Modul venue admin sudah mendukung buat, edit info dasar, dan kelola menu kanonik, tetapi **tidak ada aksi hapus**. Operator yang membuat venue uji atau duplikat tidak bisa membersihkannya dari sistem. Field `Venue.isActive` dan filter tab Aktif/Tidak aktif di indeks sudah ada di schema/UI, tetapi **tidak ada mutasi status** — soft delete bukan solusi yang diminta produk untuk kasus ini.

## Goal

1. Menambahkan **hard delete permanen** untuk venue yang **belum pernah dipakai acara** (`eventCount === 0`).
2. UI di **halaman edit venue** (zona berbahaya), konsisten dengan pola `EventDeletePanel`.
3. **Owner dan Admin operasional** boleh menghapus (`guardOwnerOrAdmin`), tanpa audit log.
4. Bersihkan blob gambar menu venue saat hapus.

## Locked product decisions (brainstorming)

| Topic | Decision |
| ----- | -------- |
| Jenis hapus | **A** — hard delete permanen |
| Eligibility | Hanya venue dengan `eventCount === 0` |
| Siapa | **B** — Owner + Admin (`guardOwnerOrAdmin`), tanpa `appendClubAuditLog` |
| Lokasi UI | **A** — halaman edit venue saja (`/admin/venues/[venueId]/edit`) |
| Soft delete (`isActive`) | **Out of scope** — tidak diimplementasikan di task ini |
| Konfirmasi | Dialog ya/tidak (mirror hapus acara), tanpa ketik ulang nama |
| Bahasa UI / error | Indonesia |

## Out of scope (v1)

- Tombol hapus di indeks venue (tabel/kartu)
- Nonaktifkan venue (`isActive = false`) atau toggle status
- Hapus venue yang masih direferensikan acara (meski acara tanpa registrasi)
- Audit log untuk hapus venue
- Hapus massal / bulk delete

---

## Architecture

### Server action

| File | Symbol | Responsibility |
| ---- | ------ | ---------------- |
| `lib/actions/admin-venues.ts` | `deleteVenue` | Auth, validasi, blob cleanup, DB delete, revalidate, redirect |

**Signature:** `deleteVenue(_prev, formData) → ActionResult<{ deleted: true }>` (redirect on success, same pattern as `deleteAdminEvent`).

**Flow:**

1. `guardOwnerOrAdmin()` — gagal → `rootError('Tidak diizinkan.')`
2. Parse `venueId` dari `FormData` — invalid → `rootError('ID venue tidak valid.')`
3. `prisma.venue.findUnique` dengan `_count: { select: { events: true } }` — tidak ada → `rootError('Venue tidak ditemukan.')`
4. `eventCount > 0` → `rootError('Venue tidak bisa dihapus karena digunakan oleh N acara.')` (N = angka aktual)
5. `deleteAllBlobsWithPrefix(\`venues/${venueId}/menu/\`)` — best-effort (`catch` / abaikan kegagalan individual; tidak memblokir hapus DB)
6. `prisma.venue.delete({ where: { id } })` — gagal → `rootError('Gagal menghapus venue. Coba lagi atau periksa apakah venue baru dipakai acara.')`
7. `revalidatePath('/admin/venues')`, `revalidatePath(\`/admin/venues/${venueId}/edit\`)`
8. `redirect(\`/admin/venues?tab=all&flash=${ADMIN_VENUES_DELETE_SUCCESS_FLASH}\`)`

**DB behavior (existing schema, no migration):**

- `Event.venueId` → `Venue` (`onDelete: Restrict`) — guard aplikasi mencegah FK error pada path normal.
- `VenueMenuItem` → `Venue` (`onDelete: Cascade`) — baris menu terhapus otomatis dengan venue.

### UI component

| File | Symbol | Responsibility |
| ---- | ------ | ---------------- |
| `components/admin/venue-delete-panel.tsx` | `VenueDeletePanel` | Zona berbahaya + dialog konfirmasi |

**Props:** `venueId`, `venueName`, `eventCount`.

**Behavior (mirror `EventDeletePanel`):**

- Section dengan border destructive, judul "Zona berbahaya".
- `eventCount > 0`: teks penjelasan, **tanpa** tombol hapus.
- `eventCount === 0`: `<Dialog>` + tombol "Hapus venue" + form hidden `venueId`.
- `useActionState(deleteVenue)`; `useEffect` → `toastActionErr` bila `state.ok === false`.
- Sukses: redirect server action; toast sukses via flash handler di indeks.

**Placement:** `app/admin/venues/[venueId]/edit/page.tsx` — di bawah `VenueBasicsForm`. Page query menambah `_count.events`.

### Flash toast pasca-redirect

| File | Symbol |
| ---- | ------ |
| `lib/admin/admin-venues-delete-flash.ts` | `ADMIN_VENUES_DELETE_SUCCESS_FLASH = 'hapus-venue'` |
| `components/admin/admin-venues-index-flash-handler.tsx` | `AdminVenuesIndexFlashHandler` |
| `app/admin/venues/layout.tsx` | Layout baru; mount handler dalam `<Suspense>` |

Handler: baca `?flash=hapus-venue` → `toastCudSuccess('delete', 'Venue berhasil dihapus.')` → `router.replace` tanpa param `flash` (pertahankan `tab`, `q`, `view`, `page` lainnya).

Redirect target: `tab=all` (venue yang dihapus tidak relevan untuk filter aktif/tidak aktif).

---

## Error handling

| Kondisi | Respons |
| ------- | ------- |
| Bukan Owner/Admin | `Tidak diizinkan.` |
| `venueId` kosong/invalid | `ID venue tidak valid.` |
| Venue tidak ada | `Venue tidak ditemukan.` |
| `eventCount > 0` | `Venue tidak bisa dihapus karena digunakan oleh N acara.` |
| DB delete gagal (race: acara baru terhubung) | `Gagal menghapus venue. Coba lagi atau periksa apakah venue baru dipakai acara.` |
| Blob delete gagal | Tidak memblokir; venue tetap dihapus dari DB |

---

## Testing

Extend `lib/actions/admin-venues.test.ts`:

| Case | Expect |
| ---- | ------ |
| Auth ditolak | `{ ok: false, rootError: 'Tidak diizinkan.' }` |
| Venue tidak ditemukan | root error Indonesia |
| `eventCount > 0` | root error dengan N |
| Sukses | redirect ke indeks + flash; `deleteAllBlobsWithPrefix` dipanggil dengan prefix benar; `prisma.venue.delete` dipanggil |

Mock `redirect` dan `deleteAllBlobsWithPrefix` mengikuti pola `admin-events.test.ts` / `abandon-draft-event-description-images.test.ts`.

---

## Documentation updates

Setelah implementasi, perbarui `CLAUDE.md`:

- Route layout: `admin/venues/layout.tsx` (flash handler hapus venue)
- Key library modules: `deleteVenue`, `admin-venues-delete-flash.ts`, `VenueDeletePanel`
- UI components: `venue-delete-panel.tsx`, `admin-venues-index-flash-handler.tsx`

---

## Implementation checklist

- [ ] `deleteVenue` di `admin-venues.ts`
- [ ] `ADMIN_VENUES_DELETE_SUCCESS_FLASH` + flash handler + `admin/venues/layout.tsx`
- [ ] `VenueDeletePanel` + wire di halaman edit
- [ ] Tests di `admin-venues.test.ts`
- [ ] `CLAUDE.md` update
