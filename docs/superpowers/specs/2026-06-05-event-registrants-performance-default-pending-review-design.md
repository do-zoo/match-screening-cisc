# Event Registrants Performance and Default Pending Review Design

## Context and Problem Statement

Halaman `Peserta Acara` terasa berat pada dua momen utama:

1. Initial load saat halaman pertama kali dibuka.
2. Perubahan filter (tab status dan search query).

Berdasarkan validasi pengguna, gejala muncul bahkan pada event dengan jumlah pendaftar kurang dari 200. Ini mengindikasikan bottleneck lebih mungkin berasal dari pola request/render daripada volume data besar.

Selain itu, kebutuhan UX baru adalah menjadikan status default daftar sebagai `pending_review` ketika URL tidak menyertakan parameter `tab`.

## Goals

- Menjadikan daftar `pending_review` sebagai default behavior saat `tab` tidak ada.
- Meningkatkan persepsi performa halaman registrants tanpa migrasi database.
- Menjaga kompatibilitas URL dan perilaku tab yang sudah ada.
- Meminimalkan risiko regresi pada alur filter, pagination, dan detail registrant.

## Non-Goals

- Tidak melakukan perubahan schema Prisma atau migration index pada tahap ini.
- Tidak mengubah kontrak data status `RegistrationStatus` di database.
- Tidak mengubah arsitektur auth/guard halaman registrants.

## Current State Summary

- `parseEventRegistrantsTab` saat ini default ke `all`.
- Halaman registrants memproses `count` dan `findMany` berdasarkan filter.
- Toolbar search memakai debounce default `350ms`, sehingga navigasi berbasis query string dapat sering terjadi saat mengetik.
- Payload query registrants sudah relatif ramping (select field terbatas), tetapi frekuensi request masih bisa menimbulkan rasa lambat.

## Selected Approach

Pendekatan hybrid (quick wins + query interaction tuning) dipilih:

1. Ubah default tab dari `all` menjadi `pending_review` (tanpa memaksa redirect URL ke `?tab=pending_review`).
2. Tuning debounce search menjadi lebih konservatif (target `500-600ms`) untuk menurunkan frekuensi navigasi/query.
3. Pertahankan payload query yang ramping dan hindari penambahan fetch non-esensial.
4. Evaluasi ulang dampak performa setelah perubahan ini sebelum mempertimbangkan optimasi berbasis migration/index.

## Design Details

## 1) Default Tab Behavior

- Lokasi perubahan utama: parser tab di `src/lib/admin/event-registrants-list-url.ts`.
- Behavior baru:
  - `tab` valid tetap dipakai apa adanya.
  - `tab` tidak ada/invalid -> fallback ke `pending_review`.
- URL generation tetap bersih:
  - Karena default dipindah ke `pending_review`, `buildEventRegistrantsListUrl` akan memperlakukan `pending_review` sebagai default sehingga query `tab` bisa dihilangkan untuk state default.
  - Tab non-default (`all`, `submitted`, dst.) tetap diserialisasi ke URL.

## 2) Search Interaction Tuning

- Lokasi perubahan: `src/components/admin/admin-list-toolbar.tsx`.
- Ubah `DEFAULT_SEARCH_DEBOUNCE_MS` dari `350` ke rentang yang lebih aman (`500-600`, dipilih nilai final saat implementasi).
- Tujuan:
  - Mengurangi burst request saat user masih mengetik.
  - Menjaga interaksi tetap responsif sambil menurunkan pressure pada server render/query.

## 3) Query and Render Constraints

- Tidak menambah relation/include baru pada query registrants.
- Tetap gunakan pola select field minimal yang sudah ada.
- Empty state tetap cepat dirender bila hasil filter kosong.

## Data Flow Impact

- Request tanpa `tab`:
  - sebelumnya: `all`
  - sesudah: `pending_review`
- Request dengan `tab` eksplisit:
  - tidak berubah.
- Search query:
  - frekuensi trigger navigasi berkurang karena debounce lebih lambat.

## Error Handling

- Tidak ada perubahan kontrak error handling.
- Jika query gagal, halaman tetap mengikuti mekanisme error boundary/failure handling yang sudah berjalan.
- Tidak ada perubahan pada guard auth (`requireAdminSession`, `canVerifyEvent`).

## Testing Strategy

### Unit Tests

- Update test `parseEventRegistrantsTab`:
  - `undefined` -> `pending_review`
  - invalid value -> `pending_review`
  - known tabs tetap valid.
- Update test URL builder:
  - default state (`pending_review` + cards view + no q/page) tidak memaksa `tab` query.
  - tab non-default tetap muncul di URL.

### Manual Verification

1. Buka `/admin/events/{eventId}/registrants` tanpa query:
   - daftar harus menampilkan status `pending_review` sebagai filter aktif.
2. Ubah tab status:
   - hasil list dan URL harus sesuai pilihan tab.
3. Ketik search query:
   - navigasi/query terasa lebih stabil (tidak terlalu sering meloncat saat mengetik cepat).
4. Cek pagination:
   - tetap konsisten saat berpindah halaman dengan filter aktif.

## Risks and Mitigations

- **Risk:** User yang terbiasa default `all` bisa merasa berubah.
  - **Mitigation:** label filter tetap jelas, tab `Semua status` tetap tersedia satu klik.
- **Risk:** Debounce terlalu tinggi bisa terasa lambat bagi sebagian pengguna.
  - **Mitigation:** pilih nilai moderat dan validasi cepat setelah implementasi.

## Rollout Plan

1. Implement perubahan parser tab default.
2. Sesuaikan URL builder agar default baru tidak memaksa query.
3. Tuning debounce di toolbar.
4. Update unit tests terkait parser + URL.
5. Verifikasi manual alur registrants.

## Success Criteria

- Halaman registrants tanpa query `tab` selalu menampilkan `pending_review`.
- Interaksi search/filter terasa lebih ringan pada event <200 registrants.
- Tidak ada regresi pada tab switching, pagination, atau navigasi ke detail registrant.
