# Pemesan/Peserta Visual Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pisahkan pemesan (holder utama) dari peserta lainnya secara visual di form registrasi publik, agar user tidak bingung ketika data peserta dibuat opsional.

**Architecture:** Dua perubahan lokal: (1) `holder-card.tsx` menambahkan elevated styling + badge "Pemesan" ketika `isPrimary=true`; (2) `step-one.tsx` menambahkan info callout di bawah card ketika mode primary-only (`!requireAllHolderData`) dan `ticketQty > 1`. Tidak ada perubahan schema, server action, atau komponen lain.

**Tech Stack:** React, Tailwind CSS, `cn()` dari `@/lib/utils`.

---

### Task 1: Elevated styling + badge "Pemesan" di `holder-card.tsx`

**Files:**
- Modify: `src/components/public/registration-form/holder-card.tsx`

Saat ini wrapper div card dan header button tidak membedakan `isPrimary` secara visual. Kita tambahkan:
- Border biru + bg subtle pada wrapper ketika `isPrimary`
- Badge "Pemesan" di sebelah teks header ketika `isPrimary`

- [ ] **Step 1: Ubah wrapper div card untuk elevated styling**

Temukan baris:
```tsx
  return (
    <div className='rounded-lg border'>
```

Ganti dengan:
```tsx
  return (
    <div className={cn('rounded-lg border', isPrimary && 'border-primary bg-primary/5')}>
```

`cn` sudah diimport di baris 14: `import { cn } from '@/lib/utils'`

- [ ] **Step 2: Tambah badge "Pemesan" di header button**

Temukan baris berikut di dalam `<button>`:
```tsx
        <span className='font-medium'>
          Tiket {index + 1}
          {isPrimary && ' (Anda)'}
        </span>
```

Ganti dengan:
```tsx
        <span className='flex items-center gap-2 font-medium'>
          Tiket {index + 1}
          {isPrimary && ' (Anda)'}
          {isPrimary && (
            <span className='rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary'>
              Pemesan
            </span>
          )}
        </span>
```

- [ ] **Step 3: Verifikasi tidak ada TypeScript error**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error baru terkait file ini.

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/holder-card.tsx
git commit -m "feat(registration-form): elevate primary holder card with pemesan badge"
```

---

### Task 2: Info callout di `step-one.tsx` untuk mode primary-only

**Files:**
- Modify: `src/components/public/registration-form/step-one.tsx`

Tambahkan callout di bawah list holder cards, hanya tampil ketika `!event.requireAllHolderData && ticketQty > 1`.

- [ ] **Step 1: Tambahkan callout setelah closing `</div>` list holder cards**

Temukan blok ini di `step-one.tsx` (sekitar baris 65–78):
```tsx
        <div className='space-y-3'>
          {(event.requireAllHolderData ? fields : fields.slice(0, 1)).map((field, index) => (
            <HolderCard
              key={field.id}
              index={index}
              isPrimary={index === 0}
              menuItems={event.mandatoryMenuItems}
              menuRequired={event.menuRequired ?? false}
              eventId={event.id}
              onValidationChange={onValidationChange}
            />
          ))}
        </div>
```

Ganti dengan:
```tsx
        <div className='space-y-3'>
          {(event.requireAllHolderData ? fields : fields.slice(0, 1)).map((field, index) => (
            <HolderCard
              key={field.id}
              index={index}
              isPrimary={index === 0}
              menuItems={event.mandatoryMenuItems}
              menuRequired={event.menuRequired ?? false}
              eventId={event.id}
              onValidationChange={onValidationChange}
            />
          ))}
          {!event.requireAllHolderData && ticketQty > 1 && (
            <p className='rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground'>
              Tiket 2–{ticketQty} tidak memerlukan data peserta untuk acara ini.
            </p>
          )}
        </div>
```

- [ ] **Step 2: Verifikasi tidak ada TypeScript error**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git add src/components/public/registration-form/step-one.tsx
git commit -m "feat(registration-form): add primary-only callout for non-primary ticket holders"
```

---

### Task 3: Verifikasi visual di browser

**Files:** (tidak ada perubahan kode)

- [ ] **Step 1: Jalankan dev server**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm dev
```

- [ ] **Step 2: Buka form registrasi acara dengan `requireAllHolderData = false`, beli ≥2 tiket**

Verifikasi:
- Card tiket 1 punya border biru dan background biru subtle
- Badge "Pemesan" muncul di header card tiket 1
- Callout "Tiket 2–N tidak memerlukan data peserta…" muncul di bawah card
- Card tiket 1 tetap bisa di-expand/collapse seperti biasa

- [ ] **Step 3: Buka form registrasi acara dengan `requireAllHolderData = true`, beli ≥2 tiket**

Verifikasi:
- Card tiket 1 punya border biru + badge "Pemesan"
- Card tiket 2, 3, dst tampil normal (border abu)
- Tidak ada callout muncul
- Semua card tetap bisa di-expand/collapse

- [ ] **Step 4: Edge case — `ticketQty = 1` dengan `requireAllHolderData = false`**

Verifikasi:
- Card tiket 1 tetap elevated (border biru + badge)
- Tidak ada callout muncul (tidak perlu, hanya 1 tiket)
