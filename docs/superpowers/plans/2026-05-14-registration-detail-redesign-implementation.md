# Registration Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memecah `RegistrationDetail` menjadi header ringkas + 3 tab (Ringkasan, Verifikasi & Komunikasi, Operasi) dengan URL `?tab=`, redirect kanonikal, badge unpaid di tab Operasi, dan layout mobile-friendly sesuai spec [`docs/superpowers/specs/2026-05-14-registration-detail-redesign-design.md`](../specs/2026-05-14-registration-detail-redesign-design.md).

**Architecture:** Logika tab URL + default status-aware di modul murni `src/lib/admin/event-registration-detail-tab.ts` (TDD). Halaman RSC mem-parse `searchParams`, menghitung `hasUnpaidAdjustment`, redirect kanonikal bila `tab` hilang/invalid. Shell server (`registration-detail-shell.tsx`) merakit header + client `registration-detail-tabs.tsx` (sinkron `router.replace`). Konten per tab dipecah ke section server/client sesuai kebutuhan; panel aksi yang sudah ada (`RegistrationActions`, `MemberValidationPanel`, dll.) dipanggil ulang tanpa mengubah server actions.

**Tech Stack:** Next.js App Router (RSC + `searchParams` as `Promise`), `@base-ui/react` Tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, variant `line`), Vitest, Prisma enums (`RegistrationStatus`, `InvoiceAdjustmentStatus`, `TicketRole`), `next/navigation` (`redirect`, `useRouter`).

---

## File map (create / modify / delete)

| Path                                                                                             | Aksi                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| `src/lib/admin/event-registration-detail-tab.ts`                                                 | Create                                     |
| `src/lib/admin/event-registration-detail-tab.test.ts`                                            | Create                                     |
| `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts`            | Create                                     |
| `src/components/admin/registration-detail-panels/shared/format.ts`                               | Create                                     |
| `src/components/admin/registration-detail-panels/registration-detail-header.tsx`                 | Create                                     |
| `src/components/admin/registration-detail-panels/registration-detail-tabs.tsx`                   | Create                                     |
| `src/components/admin/registration-detail-panels/registration-detail-shell.tsx`                  | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/summary-tab.tsx`                    | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/identity-section.tsx`               | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/relations-section.tsx`              | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/tickets-and-menu-section.tsx`       | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/price-snapshot-section.tsx`         | Create                                     |
| `src/components/admin/registration-detail-panels/tab-summary/event-context-section.tsx`          | Create                                     |
| `src/components/admin/registration-detail-panels/tab-verification/verification-tab.tsx`          | Create                                     |
| `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx`          | Create                                     |
| `src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx`          | Create                                     |
| `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx`     | Create                                     |
| `src/components/admin/registration-detail-panels/tab-operations/operations-tab.tsx`              | Create                                     |
| `src/components/admin/registration-detail-panels/tab-operations/attendance-section.tsx`          | Create                                     |
| `src/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section.tsx` | Create                                     |
| `src/components/admin/registration-detail-panels/tab-operations/cancel-refund-section.tsx`       | Create                                     |
| `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`                           | Modify                                     |
| `src/components/admin/registration-detail.tsx`                                                   | Delete                                     |
| `src/components/admin/registration-detail-panels/registration-status-panel.tsx`                  | Delete                                     |
| `src/components/admin/registration-detail-panels/registration-relations-card.tsx`                | Delete                                     |
| `src/components/admin/registration-detail.test.ts`                                               | Modify (impor helper dari `shared/format`) |
| `CLAUDE.md`                                                                                      | Modify                                     |

---

### Task 1: `event-registration-detail-tab` — tes gagal dulu

**Files:**

- Create: `src/lib/admin/event-registration-detail-tab.test.ts`
- Create: `src/lib/admin/event-registration-detail-tab.ts` (stub kosong agar impor resolve; isi di Task 2)

- [ ] **Step 1: Buat modul stub + berkas tes lengkap**

Isi `src/lib/admin/event-registration-detail-tab.ts` sementara (supaya TypeScript compile; tes akan gagal pada assertion):

```ts
import type { RegistrationStatus } from '@prisma/client'

import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'

export type RegistrationDetailTab = 'ringkasan' | 'verifikasi' | 'operasi'

export function parseRegistrationDetailTab(_raw: string | string[] | undefined): RegistrationDetailTab | null {
  return null
}

export function defaultRegistrationDetailTab(_input: {
  status: RegistrationStatus
  hasUnpaidAdjustment: boolean
}): RegistrationDetailTab {
  return 'ringkasan'
}

export function buildRegistrationDetailPath(
  eventId: string,
  registrationId: string,
  tab?: RegistrationDetailTab,
): string {
  const base = eventRegistrationDetailPath(eventId, registrationId)
  if (tab === undefined) return base
  return `${base}?tab=${tab}`
}
```

Isi penuh `src/lib/admin/event-registration-detail-tab.test.ts`:

```ts
import { RegistrationStatus } from '@prisma/client'
import { describe, expect, test } from 'vitest'

import {
  buildRegistrationDetailPath,
  defaultRegistrationDetailTab,
  parseRegistrationDetailTab,
} from '@/lib/admin/event-registration-detail-tab'

describe('parseRegistrationDetailTab', () => {
  test('returns null for undefined, empty, or unknown', () => {
    expect(parseRegistrationDetailTab(undefined)).toBeNull()
    expect(parseRegistrationDetailTab('')).toBeNull()
    expect(parseRegistrationDetailTab([])).toBeNull()
    expect(parseRegistrationDetailTab([''])).toBeNull()
    expect(parseRegistrationDetailTab('foo')).toBeNull()
  })

  test('accepts valid slugs', () => {
    expect(parseRegistrationDetailTab('ringkasan')).toBe('ringkasan')
    expect(parseRegistrationDetailTab('verifikasi')).toBe('verifikasi')
    expect(parseRegistrationDetailTab('operasi')).toBe('operasi')
    expect(parseRegistrationDetailTab(['operasi'])).toBe('operasi')
  })
})

describe('defaultRegistrationDetailTab', () => {
  test('submitted, pending_review, payment_issue → verifikasi', () => {
    for (const status of [
      RegistrationStatus.submitted,
      RegistrationStatus.pending_review,
      RegistrationStatus.payment_issue,
    ]) {
      expect(
        defaultRegistrationDetailTab({
          status,
          hasUnpaidAdjustment: false,
        }),
      ).toBe('verifikasi')
    }
  })

  test('approved without unpaid → ringkasan', () => {
    expect(
      defaultRegistrationDetailTab({
        status: RegistrationStatus.approved,
        hasUnpaidAdjustment: false,
      }),
    ).toBe('ringkasan')
  })

  test('approved with unpaid → operasi', () => {
    expect(
      defaultRegistrationDetailTab({
        status: RegistrationStatus.approved,
        hasUnpaidAdjustment: true,
      }),
    ).toBe('operasi')
  })

  test('rejected, cancelled, refunded → ringkasan', () => {
    for (const status of [RegistrationStatus.rejected, RegistrationStatus.cancelled, RegistrationStatus.refunded]) {
      expect(
        defaultRegistrationDetailTab({
          status,
          hasUnpaidAdjustment: false,
        }),
      ).toBe('ringkasan')
    }
  })
})

describe('buildRegistrationDetailPath', () => {
  const eventId = 'evt_1'
  const registrationId = 'reg_1'

  test('without tab omits query string', () => {
    expect(buildRegistrationDetailPath(eventId, registrationId)).toBe('/admin/events/evt_1/registrants/reg_1')
  })

  test('with tab appends ?tab=', () => {
    expect(buildRegistrationDetailPath(eventId, registrationId, 'verifikasi')).toBe(
      '/admin/events/evt_1/registrants/reg_1?tab=verifikasi',
    )
  })
})
```

- [ ] **Step 2: Jalankan tes — expect FAIL pada parse/default**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/event-registration-detail-tab.test.ts
```

**Expected:** beberapa assertion gagal (`parseRegistrationDetailTab` mengembalikan `null` untuk input valid, `defaultRegistrationDetailTab` salah).

- [ ] **Step 3: Commit WIP (opsional)**

```bash
git add src/lib/admin/event-registration-detail-tab.ts src/lib/admin/event-registration-detail-tab.test.ts
git commit -m "test: add registration detail tab URL helpers (failing)"
```

---

### Task 2: Implementasi penuh `event-registration-detail-tab.ts`

**Files:**

- Modify: `src/lib/admin/event-registration-detail-tab.ts`

- [ ] **Step 1: Ganti isi file dengan implementasi final**

```ts
import { RegistrationStatus } from '@prisma/client'

import { eventRegistrationDetailPath } from '@/lib/admin/event-registrants-paths'

export type RegistrationDetailTab = 'ringkasan' | 'verifikasi' | 'operasi'

const TABS = new Set<RegistrationDetailTab>(['ringkasan', 'verifikasi', 'operasi'])

function firstString(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) return raw[0]
  return raw
}

export function parseRegistrationDetailTab(raw: string | string[] | undefined): RegistrationDetailTab | null {
  const v = firstString(raw)
  if (!v || v.trim() === '') return null
  if (!TABS.has(v as RegistrationDetailTab)) return null
  return v as RegistrationDetailTab
}

export function defaultRegistrationDetailTab(input: {
  status: RegistrationStatus
  hasUnpaidAdjustment: boolean
}): RegistrationDetailTab {
  const { status, hasUnpaidAdjustment } = input

  if (
    status === RegistrationStatus.submitted ||
    status === RegistrationStatus.pending_review ||
    status === RegistrationStatus.payment_issue
  ) {
    return 'verifikasi'
  }

  if (status === RegistrationStatus.approved) {
    return hasUnpaidAdjustment ? 'operasi' : 'ringkasan'
  }

  if (
    status === RegistrationStatus.rejected ||
    status === RegistrationStatus.cancelled ||
    status === RegistrationStatus.refunded
  ) {
    return 'ringkasan'
  }

  return 'ringkasan'
}

export function buildRegistrationDetailPath(
  eventId: string,
  registrationId: string,
  tab?: RegistrationDetailTab,
): string {
  const base = eventRegistrationDetailPath(eventId, registrationId)
  if (tab === undefined) return base
  return `${base}?tab=${tab}`
}
```

Catatan: jika enum `RegistrationStatus` mendapat nilai baru di masa depan, cabang `return "ringkasan"` di akhir memastikan perilaku aman.

- [ ] **Step 2: Jalankan tes — expect PASS**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/admin/event-registration-detail-tab.test.ts
```

**Expected:** semua tes lulus.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/event-registration-detail-tab.ts src/lib/admin/event-registration-detail-tab.test.ts
git commit -m "feat(admin): add registration detail tab URL helpers"
```

---

### Task 3: Tipe `DetailRegistration` + helper format

**Files:**

- Create: `src/components/admin/registration-detail-panels/shared/registration-detail-types.ts`
- Create: `src/components/admin/registration-detail-panels/shared/format.ts`
- Modify: `src/components/admin/registration-detail.test.ts`

- [ ] **Step 1: Salin type `DetailRegistration` persis dari `registration-detail.tsx` baris 66–123**

Buat `registration-detail-types.ts` yang mengekspor `export type DetailRegistration = { ... }` — salin field demi field dari file lama (termasuk nested `event`, `tickets`, `uploads`, `adjustments`). Tambahkan `export type { TicketContextVm }` tidak perlu di file ini; `TicketContextVm` tetap diimpor dari `@/lib/registrations/admin-ticket-context` di komponen yang butuh.

- [ ] **Step 2: Buat `format.ts`**

```ts
import type { UploadPurpose } from '@prisma/client'

export function formatCurrencyIdr(n: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
  return formatted.replace(/\s+/g, '')
}

export function formatUploadPurpose(purpose: UploadPurpose): string {
  if (purpose === 'transfer_proof') return 'Bukti transfer'
  if (purpose === 'member_card_photo') return 'Foto kartu member'
  if (purpose === 'partner_member_card_photo') return 'Foto kartu member (partner)'
  return 'Bukti penyesuaian invoice'
}

export const registrationDetailDateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
```

- [ ] **Step 3: Ubah impor di `registration-detail.test.ts`**

Ganti:

```ts
import { formatCurrencyIdr, formatUploadPurpose } from '@/components/admin/registration-detail'
```

menjadi:

```ts
import { formatCurrencyIdr, formatUploadPurpose } from '@/components/admin/registration-detail-panels/shared/format'
```

- [ ] **Step 4: Jalankan tes helper**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/components/admin/registration-detail.test.ts
```

**Expected:** PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/registration-detail-panels/shared/registration-detail-types.ts src/components/admin/registration-detail-panels/shared/format.ts src/components/admin/registration-detail.test.ts
git commit -m "refactor(admin): extract registration detail types and format helpers"
```

---

### Task 4: Header + tab summary (identitas, relasi, tiket, harga, acara)

**Files:**

- Create: `src/components/admin/registration-detail-panels/registration-detail-header.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/identity-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/relations-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/tickets-and-menu-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/price-snapshot-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/event-context-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-summary/summary-tab.tsx`

- [ ] **Step 1: `registration-detail-header.tsx`**

Server component. Props: `registration: Pick<DetailRegistration, "contactName" | "contactWhatsapp" | "claimedMemberNumber" | "computedTotalAtSubmit" | "createdAt" | "ticketRole" | "status" | "rejectionReason" | "paymentIssueReason">` + `peranLabel: string` (string sudah dihitung di shell: `"Utama"` / `"Partner"`).

Render:

- `h1` + `RegistrationStatusBadge` (`flex flex-wrap items-center gap-3`).
- Baris meta: `${peranLabel} · ${member ?? "-"} · ${whatsapp}` (nomor member tanpa `#` kecuali data sudah menyertakan; gunakan label "Nomor member:" singkat jika perlu).
- Baris berikutnya: `formatCurrencyIdr(computedTotalAtSubmit) · Dikirim {registrationDetailDateFormatter.format(createdAt)}`.
- Jika `rejectionReason`: `<Alert variant="destructive" role="status">`.
- Jika `paymentIssueReason`: `<Alert variant="default" className="border-amber-500/50 bg-amber-500/10">` + `role="status"`.

Impor: `RegistrationStatusBadge`, `Alert`, `AlertTitle`, `AlertDescription`, `formatCurrencyIdr`, `registrationDetailDateFormatter` dari `shared/format`.

- [ ] **Step 2: `identity-section.tsx`**

Tampilkan nama, WA, nomor member, waktu kirim, `registration.id` dalam `font-mono text-xs text-muted-foreground`.

- [ ] **Step 3: `relations-section.tsx`**

Gantikan `RegistrationRelationsCard`: peran, link pembeli utama (partner), daftar partner (primary). Snapshot harga **tidak** di sini (pindah ke `price-snapshot-section`). Gunakan `eventRegistrationDetailPath` dari `@/lib/admin/event-registrants-paths`.

- [ ] **Step 4: `tickets-and-menu-section.tsx`**

- `hidden sm:block` → `<RegistrationTicketsTable tickets={...} />` (bangun `RegistrationTicketRow[]` seperti di `registration-detail.tsx` saat ini).
- `block sm:hidden` → list card: per tiket satu `div` border rounded dengan baris Nama, WA, Member #, Menu (wrap).

- [ ] **Step 5: `price-snapshot-section.tsx`**

Baris Tiket (`ticketPriceApplied`), Menu wajib + nama (`mandatoryMenuItemName` + `mandatoryMenuPriceApplied`), pemisah, Total (`computedTotalAtSubmit`). Gunakan `formatCurrencyIdr` dari `shared/format`.

- [ ] **Step 6: `event-context-section.tsx`**

Judul acara, `venueName`, `kickOffAt` terformat. Blok rekening: `bankName`, `accountNumber`, `accountName`. Tombol **Salin** nomor rekening: komponen kecil `"use client"` dalam file yang sama (mis. `function CopyAccountNumberButton({ text }: { text: string })`) memakai `navigator.clipboard.writeText` + `toastCudSuccess` / `toastActionErr` dari `@/lib/client/cud-notify` (teks toast bahasa Indonesia, mis. "Nomor rekening disalin.").

- [ ] **Step 7: `summary-tab.tsx`**

Satu `Card` dengan `CardHeader` ("Ringkasan") + `CardContent` berisi section di atas dipisah `Separator` dari `@/components/ui/separator`.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/registration-detail-panels/registration-detail-header.tsx src/components/admin/registration-detail-panels/tab-summary/
git commit -m "feat(admin): add registration detail summary tab sections"
```

---

### Task 5: Tab verifikasi (keputusan, bukti, komunikasi)

**Files:**

- Create: `src/components/admin/registration-detail-panels/tab-verification/decision-section.tsx` (`"use client"`)
- Create: `src/components/admin/registration-detail-panels/tab-verification/evidence-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-verification/communication-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-verification/verification-tab.tsx`

- [ ] **Step 1: `decision-section.tsx`**

Props: `eventId`, `registrationId`, `registrationStatus`, `ticketRole`, + props untuk `MemberValidationPanel` (sama seperti di `registration-detail.tsx` saat ini untuk primary).

Logika:

- `const terminal = new Set([...]).has(registrationStatus)` untuk `approved` | `rejected` | `cancelled` | `refunded`.
- State `const [showActions, setShowActions] = useState(!terminal)`.
- Render ringkasan status teks Indonesia singkat jika `terminal && !showActions` (mis. "Pendaftaran disetujui." / "Pendaftaran ditolak." / dst.).
- Tombol outline kecil "Ubah keputusan" jika `terminal && !showActions` → `setShowActions(true)`.
- Jika `showActions` atau `!terminal`: render `<RegistrationActions ... />`.
- Di bawahnya: jika `ticketRole === TicketRole.primary`, bungkus `<MemberValidationPanel ... />` dengan `<details open className="..."><summary>Validasi member</summary>...</details>`. Jika partner, jangan render panel.

- [ ] **Step 2: `evidence-section.tsx`**

Gabung uploads + ticket context:

- **Uploads:** grid `grid grid-cols-2 gap-3 sm:grid-cols-3`, tiap item link `<a href={blobUrl}>`, thumbnail `relative aspect-square max-h-[140px]` + `Image fill className="object-contain"`. Header kecil purpose + KB.
- **Konteks tiket:** pindahkan markup dari `registration-detail.tsx` (blok `ticketContext`) ke list flat label/value; pertahankan `Link` ke `eventRegistrationDetailPath` untuk konflik.

Impor `formatUploadPurpose` dari `shared/format`.

- [ ] **Step 3: `communication-section.tsx`**

Pindahkan pembentukan array `waLinks` dan map chip `<a>` dari `registration-detail.tsx` (filter `show`, loop adjustments unpaid). Pastikan impor `WaTemplateKey`, `render*Message`, `waMeLink`, `ClubWaBodies` sama seperti asli.

- [ ] **Step 4: `verification-tab.tsx`**

Satu `Card` "Verifikasi & Komunikasi" + tiga section + `Separator`.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/registration-detail-panels/tab-verification/
git commit -m "feat(admin): add registration detail verification tab"
```

---

### Task 6: Tab operasi + client tabs + shell

**Files:**

- Create: `src/components/admin/registration-detail-panels/tab-operations/attendance-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-operations/invoice-adjustments-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-operations/cancel-refund-section.tsx`
- Create: `src/components/admin/registration-detail-panels/tab-operations/operations-tab.tsx`
- Create: `src/components/admin/registration-detail-panels/registration-detail-tabs.tsx` (`"use client"`)
- Create: `src/components/admin/registration-detail-panels/registration-detail-shell.tsx`

- [ ] **Step 1: Section operasi**

Masing-masing file tipis: render `Card` section title + `AttendancePanel` / `InvoiceAdjustmentPanel` / `CancelRefundPanel` dengan props yang sama seperti di `registration-detail.tsx`. Pada `attendance-section`, bungkus area tombol panel dengan `className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"` jika perlu override (atau patch `AttendancePanel` hanya bila tidak cukup — prefer wrapper dulu).

- [ ] **Step 2: `operations-tab.tsx`**

Satu `Card` "Operasi" + tiga section.

- [ ] **Step 3: `registration-detail-tabs.tsx`**

Props:

```ts
type Props = {
  eventId: string
  registrationId: string
  tab: RegistrationDetailTab
  showOperasiBadge: boolean
  children: {
    ringkasan: React.ReactNode
    verifikasi: React.ReactNode
    operasi: React.ReactNode
  }
}
```

Implementasi:

```tsx
'use client'

import { useRouter } from 'next/navigation'

import type { RegistrationDetailTab } from '@/lib/admin/event-registration-detail-tab'
import { buildRegistrationDetailPath } from '@/lib/admin/event-registration-detail-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function RegistrationDetailTabs(props: Props) {
  const router = useRouter()
  const { eventId, registrationId, tab, showOperasiBadge, children } = props

  return (
    <Tabs
      value={tab}
      onValueChange={next => {
        router.replace(buildRegistrationDetailPath(eventId, registrationId, next as RegistrationDetailTab))
      }}
      className='gap-0'
    >
      <div
        className={cn(
          'sticky z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80',
          'top-0',
        )}
      >
        <TabsList
          variant='line'
          className='h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto bg-transparent p-0'
        >
          <TabsTrigger value='ringkasan'>Ringkasan</TabsTrigger>
          <TabsTrigger value='verifikasi'>Verifikasi & Komunikasi</TabsTrigger>
          <TabsTrigger value='operasi' className='relative'>
            Operasi
            {showOperasiBadge ? (
              <span className='absolute right-1 top-1 size-2 rounded-full bg-destructive' aria-hidden />
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value='ringkasan' className='mt-4 max-w-3xl self-center'>
        {children.ringkasan}
      </TabsContent>
      <TabsContent value='verifikasi' className='mt-4 max-w-3xl self-center'>
        {children.verifikasi}
      </TabsContent>
      <TabsContent value='operasi' className='mt-4 max-w-3xl self-center'>
        {children.operasi}
      </TabsContent>
    </Tabs>
  )
}
```

Sesuaikan `-mx-6` dengan padding `main` halaman (saat ini `px-6`) agar sticky full-bleed selaras.

- [ ] **Step 4: `registration-detail-shell.tsx`**

Props: `eventId`, `tab: RegistrationDetailTab`, `registration: DetailRegistration`, `ticketContext: TicketContextVm`, `waBodies: ClubWaBodies`, `showOperasiBadge: boolean`.

- Hitung `peranLabel` dari `registration.ticketRole` (`TicketRole.primary` → `"Utama"`, else `"Partner"`).
- Render `<RegistrationDetailHeader ... />` lalu `<RegistrationDetailTabs tab={tab} ...>` dengan `children` berisi `<SummaryTab ... />`, `<VerificationTab ... />`, `<OperationsTab ... />`.
- Pass props turunan sesuai kebutuhan masing-masing tab (gabungkan `registration` + `eventId` + `ticketContext` + `waBodies`).

Export named `RegistrationDetailShell` (atau nama default yang dipakai halaman).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/registration-detail-panels/tab-operations/ src/components/admin/registration-detail-panels/registration-detail-tabs.tsx src/components/admin/registration-detail-panels/registration-detail-shell.tsx
git commit -m "feat(admin): add registration detail operations tab and tab shell"
```

---

### Task 7: Wire halaman + hapus file lama

**Files:**

- Modify: `src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx`
- Delete: `src/components/admin/registration-detail.tsx`
- Delete: `src/components/admin/registration-detail-panels/registration-status-panel.tsx`
- Delete: `src/components/admin/registration-detail-panels/registration-relations-card.tsx`

- [ ] **Step 1: Helper `firstString` + `tabParamMissing` (salin pola dari `src/app/admin/events/page.tsx`)**

Di dalam `page.tsx` (atau fungsi lokal di atas default export):

```ts
function firstString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  if (Array.isArray(param)) return param[0]
  return param
}

function tabParamMissing(param: string | string[] | undefined): boolean {
  return param === undefined || param === '' || (Array.isArray(param) && (param.length === 0 || param[0] === ''))
}
```

- [ ] **Step 2: Ubah signature `page` untuk `searchParams`**

```ts
export default async function AdminEventRegistrantsDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; registrationId: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  // ...
}
```

- [ ] **Step 3: Setelah `registration` di-load dari Prisma, hitung**

```ts
import { InvoiceAdjustmentStatus, RegistrationStatus } from '@prisma/client'
import { redirect } from 'next/navigation'

import {
  buildRegistrationDetailPath,
  defaultRegistrationDetailTab,
  parseRegistrationDetailTab,
} from '@/lib/admin/event-registration-detail-tab'
import { RegistrationDetailShell } from '@/components/admin/registration-detail-panels/registration-detail-shell'
import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

const hasUnpaidAdjustment = registration.adjustments.some(a => a.status === InvoiceAdjustmentStatus.unpaid)

const fallbackTab = defaultRegistrationDetailTab({
  status: registration.status,
  hasUnpaidAdjustment,
})

if (tabParamMissing(sp.tab)) {
  redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab))
}

const rawTab = firstString(sp.tab)
const parsedTab = parseRegistrationDetailTab(rawTab)
if (parsedTab === null) {
  redirect(buildRegistrationDetailPath(eventId, registrationId, fallbackTab))
}

const tab = parsedTab
```

- [ ] **Step 4: Ganti JSX akhir**

Hapus impor `RegistrationDetail` / `DetailRegistration` dari `@/components/admin/registration-detail`. Impor `DetailRegistration` dari `shared/registration-detail-types`. Render:

```tsx
<RegistrationDetailShell
  eventId={eventId}
  tab={tab}
  registration={registrationForDetail}
  ticketContext={ticketContext}
  waBodies={waBodies}
  showOperasiBadge={hasUnpaidAdjustment}
/>
```

Header `<h1>Detail pendaftar</h1>` di `page.tsx` bisa dihapus atau diganti judul minimal karena header baru sudah memuat nama — pilih satu agar tidak duplikat (disarankan: hapus `h1` duplikat di `main`, pertahankan `main` wrapper + padding).

- [ ] **Step 5: Hapus tiga file lama** dan pastikan tidak ada impor tersisa (`grep RegistrationDetail` / `registration-status-panel` / `registration-relations-card`).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/events/[eventId]/registrants/[registrationId]/page.tsx
git rm src/components/admin/registration-detail.tsx src/components/admin/registration-detail-panels/registration-status-panel.tsx src/components/admin/registration-detail-panels/registration-relations-card.tsx
git commit -m "feat(admin): wire registration detail shell and remove monolith component"
```

---

### Task 8: Dokumentasi + verifikasi penuh

**Files:**

- Modify: `CLAUDE.md` (bagian `Key library modules` + `UI components` — ganti referensi `RegistrationDetail` monolit dengan shell + `lib/admin/event-registration-detail-tab.ts`; hapus mention `RegistrationRelationsCard` / `RegistrationStatusPanel` jika masih ada).
- Modify (opsional): `docs/superpowers/plans/2026-05-04-user-stories-traceability.md` baris yang menunjuk ke path file lama → path baru `registration-detail-shell.tsx` + folder `tab-*`.

- [ ] **Step 1: Perbarui `CLAUDE.md`**

- [ ] **Step 2: Lint + tes + build**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm lint && pnpm test && pnpm build
```

**Expected:** tidak ada error ESLint, semua tes Vitest lulus, `next build` sukses.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-05-04-user-stories-traceability.md
git commit -m "docs: update CLAUDE for registration detail redesign"
```

---

## Self-review (plan vs spec)

| Requirement spec                                                         | Task                                  |
| ------------------------------------------------------------------------ | ------------------------------------- |
| Header ringkas + status + meta + banner                                  | Task 4 (`registration-detail-header`) |
| 3 tab + `?tab=` + redirect missing/invalid                               | Task 2, 7                             |
| Default tab status-aware + approved+unpaid→operasi                       | Task 2, 7                             |
| Badge Operasi unpaid                                                     | Task 6 (`showOperasiBadge`)           |
| Sticky TabList                                                           | Task 6                                |
| Ringkasan: identitas, relasi, tiket+menu mobile, harga, acara+bank salin | Task 4                                |
| Verifikasi: actions + terminal gate + member validation details          | Task 5                                |
| Bukti: uploads grid square + ticket context flat                         | Task 5                                |
| WA chips + underpayment loop                                             | Task 5                                |
| Operasi: attendance, adjustment, cancel                                  | Task 6                                |
| Hapus monolit + relations/status panel cards                             | Task 7                                |
| Tes murni tab URL                                                        | Task 1–2                              |
| CLAUDE update                                                            | Task 8                                |

**Placeholder scan:** tidak ada TBD/TODO dalam rencana ini.

**Konsistensi nama:** `RegistrationDetailTab` slug string sama di URL, `TabsTrigger value`, dan `parseRegistrationDetailTab`.

---

## Plan complete

Rencana tersimpan di [`docs/superpowers/plans/2026-05-14-registration-detail-redesign-implementation.md`](2026-05-14-registration-detail-redesign-implementation.md).

**Dua opsi eksekusi:**

1. **Subagent-driven (disarankan)** — satu subagent per task, review antar task, iterasi cepat. **Sub-skill wajib:** `superpowers:subagent-driven-development`.

2. **Inline execution** — jalankan task dalam sesi ini memakai `superpowers:executing-plans`, batch dengan checkpoint review.

**Mau pakai opsi mana?**
