# Registration Detail Page Redesign

**Tanggal:** 2026-05-14
**Status:** Approved (brainstorming)
**Ruang lingkup file utama:** `src/components/admin/registration-detail.tsx` (saat ini ±573 baris) dan `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`.

## Latar belakang

Halaman detail pendaftar menampilkan ±10 kartu vertikal yang mencampur informasi, konteks verifikasi, aksi keputusan, kehadiran, dan keuangan operasional. Hal ini menyebabkan:

- **Duplikasi informasi** (status, nama kontak, peran muncul di beberapa kartu).
- **Aksi (Approve/Reject/Attendance/Adjustment)** tercampur di tengah pembacaan informasi.
- **Tidak ramah mobile**: kontainer `max-w-6xl` + grid 2 kolom + tombol baris penuh menyebabkan scroll panjang dan tombol berpisah jauh dari konteks.
- File komponen sudah terlalu besar untuk satu unit (≥ 500 baris, banyak tanggung jawab).

Tiga persona memakai halaman ini (mix antara mobile dan desktop): **Verifier** (US-EVT-03/04/09), **Operator lapangan** (US-EVT-05), **Admin keuangan / bendahara** (US-EVT-07/08).

## Tujuan

1. Tata letak yang **rapih** — minimal chrome, satu pengelompokan jelas per subjek, tanpa duplikasi.
2. **Dapat dipakai di mobile** tanpa kompromi alur kerja desktop.
3. Memecah file menjadi unit kecil (tab + section), masing-masing tanggung jawab tunggal, mudah dibaca dan dipertahankan.
4. Tidak mengubah server actions, Prisma queries, atau alur status. Hanya UI/IA.

## Non-goal

- Mengubah skema, server action, atau aturan bisnis registrasi.
- Mengganti komponen aksi yang sudah ada (`RegistrationActions`, `AttendancePanel`, `InvoiceAdjustmentPanel`, `CancelRefundPanel`, `MemberValidationPanel`) — hanya dipanggil ulang di lokasi baru.
- Drawer/bottom sheet khusus mobile, animasi transisi tab, atau penyimpanan "tab terakhir" per registrasi.

## Arsitektur Informasi

### Header ringkas (selalu terlihat, di atas TabList)

```
[Breadcrumb pendaftar]
Reynold Hartono                                  [pending review]
Utama · #M-0123 · +62 812-3456-7890
Rp 350.000 · Dikirim 13 Mei 2026, 19:42
[banner alasan jika rejectionReason / paymentIssueReason]
[TabList: Ringkasan | Verifikasi & Komunikasi | Operasi]
```

- Nama + `RegistrationStatusBadge` sebaris (wrap di mobile).
- Meta inline dipisah `·`, tanpa Card.
- Banner alasan hanya tampil bila ada (`destructive` untuk rejected, `amber` untuk payment_issue).
- Registration ID **tidak** lagi di-render full-width di header — dipindah ke tab Ringkasan sebagai metadata kecil.

### Tabs

Tiga tab:

1. **Ringkasan** — siapa pendaftar, mendaftar apa, bayar berapa. Tidak ada aksi.
2. **Verifikasi & Komunikasi** — keputusan verifikasi (approve/reject/payment_issue + validasi member), bukti pendukung, link WhatsApp.
3. **Operasi** — kehadiran, penyesuaian invoice, batal/refund.

Tabs memakai komponen `Tabs` proyek (`base-ui`-based) dengan variant `line` (sticky-friendly).

## Konten per tab

### Tab 1 — Ringkasan

Satu `Card` tab, beberapa section dipisah `Separator`:

1. **Identitas** — nama kontak, WhatsApp, nomor member yang diklaim, waktu dikirim, registration ID (font-mono kecil muted, selectable).
2. **Peran & pasangan** — peran tiket (Utama/Partner); jika partner → link "Pembeli utama: nama"; jika primary dengan partner → list link partner. Reuse `eventRegistrationDetailPath`.
3. **Tiket & menu** — `RegistrationTicketsTable` di ≥ `sm`; di < `sm` jatuh ke list-card stacked agar 5 kolom tidak menjepit.
4. **Rincian harga (snapshot)** — baris `flex justify-between`: Tiket, Menu wajib + nama, **Total saat kirim** (border-top + semibold).
5. **Acara** — judul acara, venue, kickoff datetime. Bank account ditampilkan di sini sebagai referensi operasional, dengan tombol "Salin" kecil untuk nomor rekening.

### Tab 2 — Verifikasi & Komunikasi

Satu `Card` tab, tiga section dipisah `Separator`:

1. **Keputusan verifikasi**
   - Indikator status saat ini (label).
   - `RegistrationActions` (Approve / Reject inline / Payment issue inline) dengan satu perubahan perilaku:
     - **Status terminal** (`approved`, `rejected`, `cancelled`, `refunded`): tiga tombol utama disembunyikan secara default; ringkasan singkat "Disetujui." / dst. dengan tombol kecil "Ubah keputusan" untuk membuka ulang form. Mengurangi klik tidak sengaja.
   - **Validasi member** sebagai sub-blok Collapsible (default expanded untuk tiket primary, hidden untuk partner). Memanggil `MemberValidationPanel` apa adanya.
2. **Bukti pendukung**
   - **Uploads grid** — `grid-cols-2 sm:grid-cols-3`, thumbnail `aspect-square` ~140 px (ganti dari `aspect-video` saat ini). Klik tetap buka URL di tab baru.
   - **Konteks tiket & kursi** — list flat (label-value) untuk: status pengurus (kode/lookup), tiket partner, bentrok nomor (link ke `eventRegistrationDetailPath`). Tidak lagi memakai tiga sub-heading + paragraf.
3. **Komunikasi (WhatsApp)**
   - Chip horizontal seperti sekarang, filter sesuai status (logika `show:` yang sudah ada dipertahankan).
   - Loop `adjustments.unpaid` → chip "WA · tagihan kekurangan (Rp X)".

### Tab 3 — Operasi

Satu `Card` tab, tiga section dipisah `Separator`:

1. **Kehadiran** — wraps `AttendancePanel`. Tombol full-width stack di mobile (`flex-col sm:flex-row`). Tetap disabled kecuali status `approved`.
2. **Penyesuaian invoice** — wraps `InvoiceAdjustmentPanel` (logika tidak berubah).
3. **Pembatalan & refund** — wraps `CancelRefundPanel` (logika tidak berubah).

## Perilaku status-aware, URL, badge, sticky

### URL `?tab=`

- Nilai: `ringkasan` | `verifikasi` | `operasi`.
- Jika `?tab=` tidak valid atau kosong → server hitung default (lihat tabel), lalu `redirect` ke URL dengan `?tab=` yang sesuai untuk kanonikalisasi (pola sama dengan indeks acara).

### Default tab

| Status registrasi                              | Default tab  |
| ---------------------------------------------- | ------------ |
| `submitted`, `pending_review`, `payment_issue` | `verifikasi` |
| `approved` (tanpa unpaid adjustment)           | `ringkasan`  |
| `approved` (≥ 1 unpaid adjustment)             | `operasi`    |
| `rejected`, `cancelled`, `refunded`            | `ringkasan`  |

### Badge

- Tab **Operasi**: titik indikator jika ada minimal satu `InvoiceAdjustment` berstatus `unpaid`.
- Tab **Verifikasi**: tidak ada badge (status sudah jelas di header).

### Sticky (mobile-friendly)

- `TabList` sticky di bawah breadcrumb/admin shell: `sticky top-0 z-10` (offset menyesuaikan `admin-app-shell`), `bg-background/95 backdrop-blur`, garis bawah tipis.
- Header ringkas tidak sticky di iterasi pertama untuk menghindari overlap dengan shell. Bisa digabung sticky belakangan jika dibutuhkan.

### A11y

- Tab memakai keyboard pattern bawaan (`base-ui`): panah, Home/End.
- Label tab dalam bahasa Indonesia.
- Banner alasan rejection / payment_issue diberi `role="status"` + warna semantik.

## Pemecahan file & komponen

### Logika murni (testable)

```
src/lib/admin/event-registration-detail-tab.ts        (BARU)
src/lib/admin/event-registration-detail-tab.test.ts   (BARU)
```

Ekspor:

```ts
export type RegistrationDetailTab = 'ringkasan' | 'verifikasi' | 'operasi'

export function parseRegistrationDetailTab(raw: string | string[] | undefined): RegistrationDetailTab | null

export function defaultRegistrationDetailTab(input: {
  status: RegistrationStatus
  hasUnpaidAdjustment: boolean
}): RegistrationDetailTab

export function buildRegistrationDetailPath(
  eventId: string,
  registrationId: string,
  tab?: RegistrationDetailTab,
): string
```

### Komponen

```
src/components/admin/registration-detail-panels/
  registration-detail-shell.tsx        (server; menggantikan file lama)
  registration-detail-header.tsx       (server)
  registration-detail-tabs.tsx         ("use client"; sticky TabList + sync URL)

  shared/
    registration-detail-types.ts       (DetailRegistration + helper merge uploads)
    format.ts                          (formatCurrencyIdr, formatUploadPurpose, dateFormatter)

  tab-summary/
    summary-tab.tsx
    identity-section.tsx
    relations-section.tsx
    tickets-and-menu-section.tsx       (RegistrationTicketsTable + fallback list-card mobile)
    price-snapshot-section.tsx
    event-context-section.tsx          (acara + bank account + tombol salin)

  tab-verification/
    verification-tab.tsx
    decision-section.tsx               (RegistrationActions + MemberValidationPanel sebagai Collapsible)
    evidence-section.tsx               (Uploads grid + Konteks tiket & kursi)
    communication-section.tsx          (WA chips + tagihan kekurangan)

  tab-operations/
    operations-tab.tsx
    attendance-section.tsx             (wraps AttendancePanel)
    invoice-adjustments-section.tsx    (wraps InvoiceAdjustmentPanel)
    cancel-refund-section.tsx          (wraps CancelRefundPanel)
```

File lama yang dihapus pada PR yang sama (atau menjadi re-export tipis selama transisi singkat):

- `src/components/admin/registration-detail.tsx`
- `src/components/admin/registration-detail-panels/registration-status-panel.tsx` (sudah dilebur ke `decision-section.tsx`)
- `src/components/admin/registration-detail-panels/registration-relations-card.tsx` (sudah dilebur ke `relations-section.tsx`)

### Halaman pemanggil

`src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`:

- Parse `searchParams` (Next 16 async API) → `tab` mentah.
- Hitung `hasUnpaidAdjustment` dari `registration.adjustments`.
- Pilih tab dan kanonikalisasi URL:
  ```ts
  const parsed = parseRegistrationDetailTab(rawTab)
  const fallback = defaultRegistrationDetailTab({
    status: registration.status,
    hasUnpaidAdjustment,
  })
  const tab = parsed ?? fallback
  if (rawTab !== tab) {
    redirect(buildRegistrationDetailPath(eventId, registrationId, tab))
  }
  ```
- **Kanonikalisasi:** URL selalu menyertakan `?tab=<effective>` setelah resolusi (mirip pola indeks acara yang memastikan `tab=active` selalu eksplisit). `buildRegistrationDetailPath` dengan `tab` undefined menghasilkan URL tanpa query — dipakai untuk pemanggil eksternal (link konflik nomor, breadcrumb) sehingga halaman tujuan-lah yang melakukan redirect kanonikal.

## Pengujian

Konvensi proyek: tes co-located untuk logika murni, tidak ada DOM/browser test.

- `event-registration-detail-tab.test.ts`:
  - parser menerima `ringkasan` / `verifikasi` / `operasi`; nilai lain → `null`.
  - default per status:
    - `submitted`, `pending_review`, `payment_issue` → `verifikasi`.
    - `approved` tanpa unpaid → `ringkasan`.
    - `approved` dengan unpaid → `operasi`.
    - `rejected`, `cancelled`, `refunded` → `ringkasan`.
  - `buildRegistrationDetailPath` menghasilkan `/admin/events/{eventId}/registrants/{registrationId}` tanpa query saat `tab` undefined; menambahkan `?tab=<value>` saat diberikan (termasuk saat `value` adalah default — kanonikalisasi selalu eksplisit).

Tidak ada tes komponen UI; smoke melalui `pnpm build` + `pnpm lint`.

## Penanganan kasus khusus

- **Tiket partner**: section "Peran & pasangan" menampilkan link ke pembeli utama; section "Validasi member" disembunyikan; uploads tetap memakai logika gabung (`mergeUploadsForDetail` yang sudah ada di page) sehingga partner bisa melihat unggahan primary.
- **Status terminal**: tombol Approve/Reject/Payment Issue disembunyikan default; "Ubah keputusan" membuka kembali aksi-aksi tersebut. Validasi member dan adjustments tetap dapat diubah sesuai aturan bisnis saat ini.
- **Kehadiran**: hanya aktif jika status `approved`; di luar itu tampil "Kehadiran hanya dapat dicatat untuk pendaftaran yang sudah disetujui." (sama persis dengan sekarang).
- **Tab tidak valid**: server-side redirect kanonikalisasi (lihat di atas).

## Risiko & mitigasi

| Risiko                                               | Mitigasi                                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pemisahan file bertumpuk-tumpuk → import noise.      | Folder per-tab membuat lokasi prediktif; section diekspor flat lewat barrel `index.ts` opsional bila terbukti perlu (default: tanpa barrel). |
| Sticky TabList bentrok dengan top bar admin shell.   | Offset `top-` disesuaikan dengan tinggi shell; verifikasi visual saat implementasi.                                                          |
| Pengguna desktop terganggu dengan tab (klik ekstra). | Default tab status-aware mendaratkan pengguna ke tab paling relevan tanpa klik ekstra di 90% kasus operasional.                              |
| Tab `?tab=` membingungkan saat di-share.             | Slug bahasa Indonesia mudah diingat; redirect kanonikal menjaga URL stabil.                                                                  |

## Definition of Done

- Halaman detail pendaftar memakai header ringkas + 3 tab seperti di atas.
- File `registration-detail.tsx` lama digantikan oleh struktur folder baru; tidak ada file komponen tunggal > ~300 baris.
- `?tab=` bekerja dengan redirect kanonikal dan default status-aware.
- Badge dot di tab Operasi muncul saat ada unpaid adjustment.
- `event-registration-detail-tab.test.ts` lulus.
- `pnpm lint` + `pnpm build` + `pnpm test` hijau.
- `CLAUDE.md` diperbarui pada bagian "Key library modules" dan "UI components" untuk mencerminkan modul/komponen baru.
