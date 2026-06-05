# Event Registrants Performance and Default Pending Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat halaman `Peserta Acara` lebih responsif untuk initial load dan perubahan filter, sekaligus menjadikan `pending_review` sebagai status default saat `tab` tidak ada di URL.

**Architecture:** Perubahan fokus pada lapisan URL/filter parsing dan interaksi toolbar, tanpa mengubah schema database. Default tab dipindah dari `all` ke `pending_review`, lalu serialisasi URL disesuaikan agar default state tetap menghasilkan URL bersih. Untuk menurunkan frekuensi request saat mengetik, debounce search di toolbar registrants ditingkatkan melalui konfigurasi per-halaman (bukan global), agar dampak perubahan terlokalisasi.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Vitest, React (client toolbar components)

---

## File Structure and Responsibilities

- Modify: `src/lib/admin/event-registrants-list-url.ts`
  - Sumber kebenaran parsing tab registrants + URL builder + preserved query.
- Modify: `src/lib/admin/event-registrants-list-url.test.ts`
  - Unit test parser/url behavior untuk tab default baru.
- Modify: `src/components/admin/admin-event-registrants-toolbar.tsx`
  - Konfigurasi debounce search khusus halaman registrants.
- Verify (no code change expected): `src/app/admin/events/[eventId]/registrants/page.tsx`
  - Pastikan penggunaan parser/tab tetap konsisten setelah perubahan.

### Task 1: Update Failing Tests for New Default Tab Behavior

**Files:**
- Modify: `src/lib/admin/event-registrants-list-url.test.ts`
- Test: `src/lib/admin/event-registrants-list-url.test.ts`

- [ ] **Step 1: Write failing tests for default tab fallback**

```ts
it('parseEventRegistrantsTab defaults unknown to pending_review', () => {
  expect(parseEventRegistrantsTab(undefined)).toBe('pending_review')
  expect(parseEventRegistrantsTab('bogus')).toBe('pending_review')
})
```

- [ ] **Step 2: Write failing tests for URL default omission with pending_review**

```ts
it('buildEventRegistrantsListUrl omits default pending_review tab and cards view', () => {
  expect(
    buildEventRegistrantsListUrl(eventId, {
      tab: 'pending_review',
      view: 'cards',
      q: undefined,
    }),
  ).toBe(`/admin/events/${eventId}/registrants`)
})

it('buildEventRegistrantsListUrl keeps non-default tab=all in query string', () => {
  const url = buildEventRegistrantsListUrl(eventId, {
    tab: 'all',
    view: 'cards',
    q: undefined,
  })
  expect(url).toContain('tab=all')
})
```

- [ ] **Step 3: Run targeted tests to confirm failure**

Run: `pnpm vitest run src/lib/admin/event-registrants-list-url.test.ts`

Expected: FAIL pada assertion default tab / URL default karena implementasi masih `all`.

- [ ] **Step 4: Commit failing-test checkpoint**

```bash
git add src/lib/admin/event-registrants-list-url.test.ts
git commit -m "test(admin): cover pending_review as default registrants tab"
```

### Task 2: Implement Default `pending_review` in Parser and URL Builder

**Files:**
- Modify: `src/lib/admin/event-registrants-list-url.ts`
- Test: `src/lib/admin/event-registrants-list-url.test.ts`

- [ ] **Step 1: Update parser fallback from all to pending_review**

```ts
export function parseEventRegistrantsTab(raw: string | string[] | undefined): EventRegistrantsTab {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v && TABS.has(v as EventRegistrantsTab)) return v as EventRegistrantsTab
  return 'pending_review'
}
```

- [ ] **Step 2: Update URL/preserved-query default omission rules**

```ts
if (opts.tab !== 'pending_review') entries.tab = opts.tab
```

```ts
...(opts.tab !== 'pending_review' ? { tab: opts.tab } : {}),
```

- [ ] **Step 3: Run targeted tests to verify pass**

Run: `pnpm vitest run src/lib/admin/event-registrants-list-url.test.ts`

Expected: PASS semua test di file tersebut.

- [ ] **Step 4: Run related guard test command**

Run: `pnpm test`

Expected: suite tetap hijau atau setidaknya tidak ada regresi baru dari perubahan tab default.

- [ ] **Step 5: Commit implementation**

```bash
git add src/lib/admin/event-registrants-list-url.ts src/lib/admin/event-registrants-list-url.test.ts
git commit -m "feat(admin): default registrants tab to pending_review"
```

### Task 3: Tune Search Debounce for Registrants Toolbar

**Files:**
- Modify: `src/components/admin/admin-event-registrants-toolbar.tsx`
- Verify: `src/components/admin/admin-list-toolbar.tsx`

- [ ] **Step 1: Add per-page debounce value for registrants search**

```ts
const REGISTRANTS_SEARCH_DEBOUNCE_MS = 550
```

```tsx
search={{
  inputId: 'admin-event-registrants-search',
  label: 'Cari peserta',
  placeholder: 'Nama, WhatsApp, atau nomor anggota…',
  value: searchQuery,
  debounceMs: REGISTRANTS_SEARCH_DEBOUNCE_MS,
  getUrlForQuery: q =>
    buildEventRegistrantsListUrl(eventId, {
      tab,
      view: viewMode,
      q,
      page: 1,
    }),
}}
```

- [ ] **Step 2: Typecheck/lint affected files**

Run: `pnpm lint`

Expected: tidak ada error lint baru pada komponen toolbar registrants.

- [ ] **Step 3: Manual verification in browser/dev server**

Run: `pnpm dev`

Manual checks:
- Buka `/admin/events/{eventId}/registrants` tanpa query -> filter aktif `pending_review`.
- Ketik cepat di search -> perpindahan URL/list tidak terlalu sering (lebih stabil dibanding sebelumnya).
- Ganti tab status -> tetap navigasi benar.

Expected: UX filter/search terasa lebih ringan; behavior default tab sesuai requirement.

- [ ] **Step 4: Commit debounce tuning**

```bash
git add src/components/admin/admin-event-registrants-toolbar.tsx
git commit -m "perf(admin): reduce registrants search churn with longer debounce"
```

### Task 4: Final Regression Sweep and Documentation Alignment

**Files:**
- Verify: `CLAUDE.md` (no update expected unless behavior docs need explicit change)
- Verify: `src/app/admin/events/[eventId]/registrants/page.tsx`

- [ ] **Step 1: Run focused verification commands**

Run:
- `pnpm vitest run src/lib/admin/event-registrants-list-url.test.ts`
- `pnpm lint`

Expected: PASS / no new errors.

- [ ] **Step 2: Evaluate whether docs update is required**

Checklist:
- Jika route/query default behavior dianggap cross-file invariant penting, tambahkan catatan singkat di `CLAUDE.md`.
- Jika tidak dianggap invariant besar, biarkan tanpa perubahan.

Expected: keputusan dokumentasi eksplisit (update atau tidak update) dengan alasan jelas di PR/commit notes.

- [ ] **Step 3: Create final integration commit**

```bash
git add -A
git commit -m "refactor(admin): improve registrants default filter and interaction responsiveness"
```

