# Input & Tampilan Harga Rupiah — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Input harga admin memakai format Rupiah (pemisah ribuan + label Rp) saat mengetik, dengan parsing ke bilangan bulat IDR; tampilan daftar harga menu memakai `formatIdr` yang sama dengan area publik.

**Architecture:** Fungsi murni `parseIdrDigitsToInt` memetakan string input → integer (digit saja, aman ke `MAX_SAFE_INTEGER`). Komponen `IdrAmountInput` controlled: nilai tampilan = `formatIdr(n)` dari `lib/utils/format-idr.ts`, perubahan = ekstraksi digit + update callback. Form acara memakai `<Controller>` RHF menggantikan `register(..., valueAsNumber)`.

**Tech Stack:** `Intl` (`id-ID`), Vitest, react-hook-form `Controller`, shadcn `Input`.

---

## File Map

| File | Tanggung jawab |
|------|------------------|
| `src/lib/utils/idr-input.ts` | `parseIdrDigitsToInt` |
| `src/lib/utils/idr-input.test.ts` | Unit test parser |
| `src/components/ui/idr-amount-input.tsx` | Input teks format Rupiah |
| `src/components/admin/forms/event-admin-form.tsx` | Tiket member/non-member |
| `src/components/admin/venues/venue-catalog-editor.tsx` | Harga menu kanonik |
| `src/components/admin/invoice-adjustment-panel.tsx` | Jumlah penyesuaian + DRY `formatIdr` |

---

## Task 1: Parser + tes

**Files:** Create `src/lib/utils/idr-input.ts`, `src/lib/utils/idr-input.test.ts`

- [ ] Implement `parseIdrDigitsToInt` dan jalankan `pnpm vitest run src/lib/utils/idr-input.test.ts`.

---

## Task 2: Komponen + wiring UI

**Files:** Create `idr-amount-input.tsx`; modify tiga komponen admin di atas.

- [ ] Ganti input `type="number"` harga dengan `IdrAmountInput` + `Controller` di mana perlu.
- [ ] `event-admin-form`: label bisa menyebut "Rupiah" saja karena field sudah berformat mata uang.
- [ ] Jalankan `pnpm lint` dan `pnpm test`.

**Plan complete.** Eksekusi: inline di sesi yang sama.
