# Admin community hub + event dashboard IA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengalihkan `/admin` menjadi hub pratinjau komunitas/CRM (bukan pusat daftar acara), memindahkan daftar acara bergaya dashboard (kartu + filter tab + KPI) ke `/admin/events`, membuka akses halaman acara untuk peran non-operasional yang berhak melihat acara, dan menambahkan tautan **Pengaturan acara** (`/edit`) di chrome layout per-acara (subnav mobile + blok sidebar desktop).

**Architecture:** Konten kartu dashboard yang hari ini ada di `src/app/admin/page.tsx` dipindahkan ke `src/app/admin/events/page.tsx` dengan parameter `tab` yang sama (`all` | `active` | `draft` | `finished`). Halaman beranda baru memuat ringkasan statis/ringan (saluran ke Anggota, Kepengurusan, Venue, Acara) plus blok opsional “butuh tindakan” yang merujuk ke `/admin/events?tab=active`. Chrome per-acara (`AdminEventSubnav`, `AdminEventSidebarBlock`) diperluas agar mencakup rute `/edit` dan tautan Pengaturan untuk `Owner`/`Admin` saja. **Tidak** memindahkan `/admin/settings` (komite) ke bawah layout acara.

**Tech Stack:** Next.js App Router, Prisma, modul ada `loadAdminDashboard` (`src/lib/admin/load-admin-dashboard.ts`), `dashboard-view-model`, komponen client `AdminEventSidebarBlock` / `AdminEventSubnav`, `AdminEventBreadcrumbs`.

---

### Task 1: Parameter tampilan indeks acara (kartu vs tabel)

**Files:**

- Create: `src/lib/admin/events-index-view.ts` — parser `view` untuk query `?view=`
- Create: `src/lib/admin/events-index-view.test.ts`
- Modify: `src/app/admin/events/page.tsx` (nanti Task 2–3 memakai parser ini)

**Semantik yang disarankan:**

- `view` tidak ada atau `view=kartu` → tampilan kartu dashboard (default baru).
- `view=tabel` → pertahankan tabel paginasi operasional yang sudah ada (`AdminEventsTable`) **hanya** untuk `hasOperationalOwnerParity`.

Alasan: `loadAdminDashboard` memuat semua acara yang diizinkan sekaligus (tanpa paginasi). Untuk klub dengan banyak acara bersejarah, tabel paginasi tetap berguna sebagai jalur sekunder.

- [ ] **Step 1: Uji parser `view`**

Buat `src/lib/admin/events-index-view.ts`:

```ts
export type EventsIndexViewMode = 'cards' | 'table'

export function parseEventsIndexViewParam(raw: string | string[] | undefined): EventsIndexViewMode {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'tabel' || v === 'table') return 'table'
  return 'cards'
}
```

Buat `src/lib/admin/events-index-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEventsIndexViewParam } from './events-index-view'

describe('parseEventsIndexViewParam', () => {
  it('defaults to cards', () => {
    expect(parseEventsIndexViewParam(undefined)).toBe('cards')
    expect(parseEventsIndexViewParam('')).toBe('cards')
    expect(parseEventsIndexViewParam('kartu')).toBe('cards')
  })
  it('accepts table aliases', () => {
    expect(parseEventsIndexViewParam('tabel')).toBe('table')
    expect(parseEventsIndexViewParam('table')).toBe('table')
  })
  it('uses first array entry', () => {
    expect(parseEventsIndexViewParam(['tabel', 'x'])).toBe('table')
  })
})
```

- [ ] **Step 2: Jalankan tes**

Run:

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/events-index-view.test.ts
```

Expected: semua tes PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/events-index-view.ts src/lib/admin/events-index-view.test.ts
git commit -m "feat(admin): parse events index view mode for cards vs table"
```

---

### Task 2: Buka `/admin/events` untuk Verifier dan Viewer (tanpa tabel operasional)

**Files:**

- Modify: `src/app/admin/events/page.tsx` — hapus `notFound()` untuk non-operasional; cabangkan UI berdasarkan `hasOperationalOwnerParity(ctx.role)` dan `parseEventsIndexViewParam`

- [ ] **Step 1: Sesuaikan guard**

- Untuk **semua** konteks yang punya `ctx` (sudah dicek di halaman): izinkan akses halaman.
- Jika `!hasOperationalOwnerParity`: paksa `viewMode === "cards"` (abaikan `?view=tabel`), sembunyikan header “Buat acara” dan semua blok yang memanggil query tabel paginasi (`prisma.event.findMany` dengan `skip`/`take` dari Task 3 hanya di cabang operasional + `view=tabel`).

- [ ] **Step 2: Verifikasi**

Run: `pnpm lint`  
Expected: tanpa error pada file tersebut.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/events/page.tsx
git commit -m "fix(admin): allow verifiers and viewers on events index"
```

---

### Task 3: Gabungkan kartu dashboard + tabel operasional di `events/page.tsx`

**Files:**

- Modify: `src/app/admin/events/page.tsx`
- Create (disarankan): `src/components/admin/admin-events-dashboard-cards.tsx` — pindahkan JSX `EventSummaryCard`, `tabDefs`, format helper dari `src/app/admin/page.tsx` agar halaman tetap ramping
- Modify: `src/app/admin/page.tsx` (Task 4 bisa menyentuh impor; urutan kerja: pindahkan dulu kartu ke komponen, lalu halaman events impor komponen tersebut)

** perilaku `searchParams` pada `/admin/events`:**

- Jika `tab` kosong: `redirect("/admin/events?tab=active")` (sama seperti beranda lama).
- `tab` diparsing lewat `loadAdminDashboard(ctx, { tab: sp.tab })` seperti di `admin/page.tsx` hari ini.
- `view=tabel` + operasional → render blok tabel yang ada sekarang (header + `AdminEventsTable` + pagination).
- `view=kartu` atau default + semua peran yang punya kartu → render alert KPI + tab + grid kartu.

- [ ] **Step 1: Ekstrak kartu**

Salin struktur dari `src/app/admin/page.tsx` baris ~23–210 ke komponen server baru `AdminEventsDashboardCards` (props: `session`, `loaded` dari `LoadAdminDashboardResult` sukses, atau props minimal: `events`, `tab`, `pendingReviewRecapTotal`, `userEmail`).

- [ ] **Step 2: Susun ulang `events/page.tsx`**

1. `requireAdminSession` + `getAdminContext` seperti sekarang.
2. Parse `tab` + `view` dari `searchParams`.
3. Cabang:
   - Non-ops: panggil `loadAdminDashboard` saja; render komponen kartu; metadata title tetap “Acara”.
   - Ops + `view=tabel`: pertahankan query Prisma + `AdminEventsTable` yang ada.
   - Ops + `view=cards`: `loadAdminDashboard` + kartu; sediakan `Link` ke `/admin/events?view=tabel` dengan teks Indonesia mis. “Tampilan tabel (paginasi)”.

- [ ] **Step 3: Lint**

Run: `pnpm lint`

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/events/page.tsx src/components/admin/admin-events-dashboard-cards.tsx
git commit -m "feat(admin): events index as dashboard cards with optional table view"
```

---

### Task 4: Halaman beranda `/admin` — pratinjau komunitas

**Files:**

- Modify: `src/app/admin/page.tsx` — hapus `loadAdminDashboard`, hapus redirect `?tab=`, ganti konten
- Modify: `src/components/admin/admin-app-shell.tsx` — label link pertama (opsional): dari “Beranda” ke “Komunitas” atau pertahankan “Beranda” dengan subtitle baru (pilih satu; dokumentasikan di CLAUDE.md)
- Optional baca: `src/lib/public/load-club-branding.ts` untuk menampilkan nama klub jika sudah ada pola aman di server

**Konten minimal yang disarankan (YAGNI):**

- Judul + deskripsi satu paragraf: alat backoffice komunitas (anggota, acara, venue, kepengurusan).
- Grid kartu pintasan (reuse `Card` + `Link`) ke: `/admin/members`, `/admin/management`, `/admin/venues`, `/admin/events?tab=active` — sembunyikan link yang `navFlags` tidak izinkan (pass `navFlags` dari layout tidak langsung tersedia di server page; **solusi ringan:** render semua pintasan yang halaman target sendiri yang melakukan `notFound`/guard, atau duplikasi matriks dengan `deriveGlobalSidebarNav(ctx)` di `page.tsx` dengan `getAdminContext` yang sama seperti layout).

Gunakan `deriveGlobalSidebarNav(ctx)` di `admin/page.tsx` agar pintasan konsisten dengan sidebar.

- Blok ringkas: “Registrasi menunggu tinjauan” dengan angka agregat — **tanpa** menduplikasi seluruh query dashboard: hitung satu angka saja dengan query Prisma ringan dibatasi `canVerifyEvent` (polos: `registration.count` dengan `status: pending_review` dan `eventId` dalam daftar acara yang boleh diverifikasi). Ekstrak ke `src/lib/admin/pending-review-total-for-context.ts` jika ingin menguji unit dengan mock kecil; jika tidak, inline di page dengan komentar singkat.

- [ ] **Step 1: Implementasi `admin/page.tsx`**

Hapus `redirect("/admin?tab=active")`. Metadata title: mis. “Komunitas” atau “Beranda”.

- [ ] **Step 2: Lint + smoke**

Run: `pnpm lint`  
Manual: buka `/admin` tanpa query — tidak boleh 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx src/lib/admin/pending-review-total-for-context.ts
git commit -m "feat(admin): reframe home as community hub preview"
```

_(Hapus baris file pending helper jika logika di-inline.)_

---

### Task 5: Navigasi shell — URL beranda & acara

**Files:**

- Modify: `src/components/admin/admin-app-shell.tsx` — `href` Beranda: `/admin` (bukan `/admin?tab=active`); untuk Acara gunakan `/admin/events?tab=active` agar langsung ke filter aktif
- Modify: `src/components/admin/admin-event-breadcrumbs.tsx` — crumb “Beranda” → `href: "/admin"` (bukan `"/admin?tab=active"`)

- [ ] **Step 1: Edit file di atas**

- [ ] **Step 2: `pnpm lint`**

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/admin-app-shell.tsx src/components/admin/admin-event-breadcrumbs.tsx
git commit -m "fix(admin): point shell nav and breadcrumbs to new home URL"
```

---

### Task 6: Chrome per-acara — tautan Pengaturan + dukungan rute `/edit`

**Files:**

- Modify: `src/app/admin/events/[eventId]/layout.tsx` — oper `canManageEventSettings={hasOperationalOwnerParity(ctx.role)}` ke `AdminEventSubnav` (dan breadcrumbs jika perlu)
- Modify: `src/components/admin/admin-event-subnav.tsx` — props `canManageEventSettings?: boolean`; tambah `Link` “Pengaturan” ke `/admin/events/${eventId}/edit` dengan styling pill konsisten; deteksi pathname `.../edit`
- Modify: `src/components/admin/admin-event-sidebar-block.tsx` — perluas `EVENT_BRANCH_RE` agar mencocokkan `/edit` serta `/inbox` dan `/report` sehingga blok sidebar tetap tampil di halaman edit; tambah link Pengaturan dengan `Settings` icon dari `lucide-react`; `canManageEventSettings` dari fetch API

**API:**

- Modify: `src/app/api/admin/events/[eventId]/title/route.ts` (atau berkas setara) — tambahkan field JSON `canManageEventSettings: boolean` dengan `getAdminContext` + `hasOperationalOwnerParity` pada session yang sama seperti guard edit.

**Layout server:**

- `AdminEventSubnav` saat ini hanya `lg:hidden`. Tambahkan prop boolean dari layout server.

- [ ] **Step 1: Perluas API title**

Response: `{ "title": string, "canManageEventSettings": boolean }`

- [ ] **Step 2: Sidebar client**

Di `useEffect` fetch yang sama, set state `canManageEventSettings`. Render link Pengaturan hanya jika true.

- [ ] **Step 3: Subnav**

Tambah pill ketiga untuk desktop tidak berubah (subnav mobile-only); pastikan `aria-label` diubah mis. “Inbox, laporan, dan pengaturan”.

- [ ] **Step 4: Lint**

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/events/[eventId]/layout.tsx src/components/admin/admin-event-subnav.tsx src/components/admin/admin-event-sidebar-block.tsx src/app/api/admin/events/[eventId]/title/route.ts
git commit -m "feat(admin): event settings link in event chrome and edit route in sidebar"
```

---

### Task 7: Dokumentasi & metadata

**Files:**

- Modify: `CLAUDE.md` — bagian “Route layout” untuk `admin/` — jelaskan `/admin` sebagai hub komunitas ringkas, `/admin/events` sebagai indeks acara bergaya dashboard + opsi `?view=tabel`, dan chrome acara mencakup Pengaturan untuk Owner/Admin.

- Modify: `src/app/admin/page.tsx` — `metadata.title` selaras label navigasi.

- [ ] **Step 1: Edit CLAUDE.md**

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md src/app/admin/page.tsx
git commit -m "docs: update admin IA for community hub and events dashboard"
```

---

### Task 8: Verifikasi akhir

- [ ] **Step 1: Lint + tes**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test
```

Expected: lint bersih; semua tes Vitest lulus.

- [ ] **Step 2: Commit hanya jika ada perbaikan otomatis** (biasanya tidak perlu commit kosong).

---

## Self-review

**1. Spec coverage**

| Permintaan                                               | Task                                                    |
| -------------------------------------------------------- | ------------------------------------------------------- |
| Dashboard = pratinjau komunitas/CRM, bukan sekadar acara | Task 4, 5                                               |
| Acara = dashboard list (kartu + filter)                  | Task 1–3                                                |
| Settings ke event layout (pengaturan acara)              | Task 6                                                  |
| Komite global `/admin/settings` tidak dipindah           | Architecture + tidak ada task memindahkan settings tree |

**2. Placeholder scan**

Tidak ada TBD pada langkah eksekusi; opsional “load-club-branding” disebut sebagai optional read only.

**3. Type consistency**

`parseEventsIndexViewParam` dan `EventsIndexViewMode` konsisten di seluruh rencana; API title memperluas response yang sudah ada — pastikan consumer `AdminEventSidebarBlock` menangani JSON baru tanpa memecahkan parse title saja.

---

## Catatan produk (bahasa Indonesia untuk stakeholder)

- **Beranda** menjadi tempat “mengapa saya di sini” untuk seluruh modul klub; **Acara** menjadi tempat kerja harian PIC terkait pendaftaran.
- **Verifier/Viewer** mendapatkan indeks acara yang sama (kartu) tanpa fitur tabel bulk atau tombol buat acara.
- **Owner/Admin** melihat tautan **Pengaturan** di area acara yang sama dengan Inbox/Laporan, sejajar mental model “satu acara, satu set tab”.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-14-admin-community-hub-reframe.md`. Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — agen baru per tugas, review antar tugas, iterasi cepat. **Wajib** memakai skill superpowers:subagent-driven-development.

**2. Inline Execution** — jalankan tugas di sesi ini dengan superpowers:executing-plans, batch dengan checkpoint review.

**Mau pendekatan yang mana?**
