# Unified Purchaser Identity Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satu field teks untuk pemesan member: pengguna mengisi nomor member direktori **atau** kode akses pengurus (tanpa dua kotak terpisah dan tanpa teks penjelasan jalur pengurus di UI publik), sambil mempertahankan model form/server yang ada (`claimedMemberNumber` XOR `managementPublicCode`).

**Architecture:** Ekstrak aturan urutan resolusi **member direktori dulu, lalu kode pengurus** ke fungsi async murni yang dapat diuji dengan injeksi lookup. Hook klien baru menggantikan kombinasi `usePartnerGate` + `useManagementCodeGate` untuk identitas utama: debounce, memanggil resolver, menulis ke salah satu field RHF, menjalankan cek kursi event untuk jalur member, mengisi nama dari direktori/kode, dan menetapkan error pada field yang relevan (UI menampilkan satu `FieldError` gabungan). Skema Zod, `submit-registration` server action, dan FormData **tetap** mengirim dua kunci terpisah.

**Tech Stack:** Next.js App Router, React Hook Form, Zod, Vitest (node), server actions yang sudah ada (`lookupMemberPartnerEligibility`, `lookupManagementCodeForRegistration`, `primaryMemberSeatTakenForActiveEventSlug`).

**Context:** Rencana ini ditulis agar bisa dieksekusi di worktree terpisah (lihat skill brainstorming / git worktrees) agar tidak bentrok dengan pekerjaan lain.

---

## File map

| File                                                                             | Peran                                                                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/registrations/resolve-primary-purchaser-identity.ts`                    | Fungsi murni `resolvePrimaryPurchaserIdentity(trimmed, deps)` — urutan: lookup member → jika tidak ditemukan lookup management; hasil discriminated union. |
| `src/lib/registrations/resolve-primary-purchaser-identity.test.ts`               | Vitest: empat skenario (empty, member, management, neither) dengan `vi.fn` mock deps.                                                                      |
| `src/lib/forms/submit-registration-schema.ts`                                    | Tambah konstanta pesan error gabungan opsional untuk parity dengan UI (bila hook memakai string yang sama).                                                |
| `src/components/public/registration-form/use-primary-purchaser-identity-gate.ts` | Hook baru: menggantikan pemakaian `usePartnerGate` + `useManagementCodeGate` untuk identitas utama pada `RegistrationForm`.                                |
| `src/components/public/registration-form/registration-form.tsx`                  | Wire hook baru; sesuaikan `goNext` / `submitForm` fokus & pesan "tunggu validasi" agar satu id input; hapus impor hook lama yang tidak terpakai.           |
| `src/components/public/registration-form/purchaser-info-section.tsx`             | Satu `Input` + label/deskripsi tanpa narasi pengurus; gabungkan indikator "memeriksa…" dan error dari kedua path.                                          |
| `src/components/public/registration-form/registration-steps.ts`                  | Opsional: tetap `trigger` kedua field untuk `superRefine` Zod (disarankan **tidak** mengurangi field agar tidak mengubah perilaku validasi).               |
| `src/components/public/registration-form/use-partner-gate.ts`                    | Hapus dari rantai form jika tidak ada konsumen lain; jika masih dipakai di luar, biarkan — grep sebelum hapus.                                             |
| `src/components/public/registration-form/use-management-code-gate.ts`            | Sama seperti di atas.                                                                                                                                      |

---

### Task 1: Resolver murni + unit test (TDD)

**Files:**

- Create: `src/lib/registrations/resolve-primary-purchaser-identity.ts`
- Create: `src/lib/registrations/resolve-primary-purchaser-identity.test.ts`
- Modify: `src/lib/forms/submit-registration-schema.ts` (tambah konstanta pesan — lihat Step 3)

- [ ] **Step 1: Tambah konstanta pesan (agar hook & UI memakai satu sumber)**

Modify `src/lib/forms/submit-registration-schema.ts` — setelah `MEMBER_NOT_IN_DIRECTORY_MESSAGE`:

```ts
/** Dipakai setelah direktori & jalur kode pengurus sama-sama gagal (satu field identitas). */
export const PRIMARY_PURCHASER_IDENTITY_NOT_RECOGNIZED_MESSAGE =
  'Identitas tidak dikenali. Periksa nomor member di direktori atau kode akses yang Anda terima.' as const
```

- [ ] **Step 2: Tulis modul resolver**

Create `src/lib/registrations/resolve-primary-purchaser-identity.ts`:

```ts
import type { LookupManagementCodeResult } from '@/lib/actions/lookup-management-code-for-registration'
import type { MemberPartnerLookupResult } from '@/lib/actions/lookup-member-partner-eligibility'
import { normalizePublicManagementCode } from '@/lib/management/normalize-public-code'

export type PrimaryPurchaserIdentityDeps = {
  lookupMember: (raw: string) => Promise<MemberPartnerLookupResult>
  lookupManagement: (raw: string) => Promise<LookupManagementCodeResult>
}

export type ResolvePrimaryPurchaserIdentityResult =
  | { branch: 'empty' }
  | {
      branch: 'member'
      inputTrim: string
      canonicalMemberNumber: string
      fullName: string
      whatsapp: string | null
      isManagementMember: boolean
    }
  | {
      branch: 'management'
      inputTrim: string
      normalizedCode: string
      fullName: string
      managementMemberId: string
    }
  | { branch: 'neither'; inputTrim: string }

export async function resolvePrimaryPurchaserIdentity(
  raw: string,
  deps: PrimaryPurchaserIdentityDeps,
): Promise<ResolvePrimaryPurchaserIdentityResult> {
  const inputTrim = raw.trim()
  if (!inputTrim) {
    return { branch: 'empty' }
  }

  const member = await deps.lookupMember(inputTrim)
  if (member.kind === 'ok' && member.found) {
    return {
      branch: 'member',
      inputTrim,
      canonicalMemberNumber: member.canonicalMemberNumber,
      fullName: member.fullName,
      whatsapp: member.whatsapp,
      isManagementMember: member.isManagementMember,
    }
  }

  const management = await deps.lookupManagement(inputTrim)
  if (management.kind === 'ok') {
    return {
      branch: 'management',
      inputTrim,
      normalizedCode: normalizePublicManagementCode(inputTrim),
      fullName: management.fullName,
      managementMemberId: management.managementMemberId,
    }
  }

  return { branch: 'neither', inputTrim }
}
```

- [ ] **Step 3: Tulis tes yang gagal dulu (belum ada file implementasi — Vitest akan error import)**

Create `src/lib/registrations/resolve-primary-purchaser-identity.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import type { LookupManagementCodeResult } from '@/lib/actions/lookup-management-code-for-registration'
import type { MemberPartnerLookupResult } from '@/lib/actions/lookup-member-partner-eligibility'

import {
  resolvePrimaryPurchaserIdentity,
  type PrimaryPurchaserIdentityDeps,
} from './resolve-primary-purchaser-identity'

function memberFound(
  overrides: Partial<Extract<MemberPartnerLookupResult, { kind: 'ok'; found: true }>> = {},
): MemberPartnerLookupResult {
  return {
    kind: 'ok',
    found: true,
    canonicalMemberNumber: 'CISC-1',
    fullName: 'Budi',
    whatsapp: '08123456789',
    isManagementMember: false,
    ...overrides,
  }
}

function memberNotFound(): MemberPartnerLookupResult {
  return { kind: 'ok', found: false, isManagementMember: false }
}

function managementOk(
  overrides: Partial<Extract<LookupManagementCodeResult, { kind: 'ok' }>> = {},
): LookupManagementCodeResult {
  return {
    kind: 'ok',
    fullName: 'Ani',
    managementMemberId: 'mm-1',
    ...overrides,
  }
}

describe('resolvePrimaryPurchaserIdentity', () => {
  it('returns empty for whitespace-only input', async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn(),
      lookupManagement: vi.fn(),
    }
    const r = await resolvePrimaryPurchaserIdentity('  \t ', deps)
    expect(r.branch).toBe('empty')
    expect(deps.lookupMember).not.toHaveBeenCalled()
    expect(deps.lookupManagement).not.toHaveBeenCalled()
  })

  it('returns member and does not call management when directory matches', async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberFound()),
      lookupManagement: vi.fn(),
    }
    const r = await resolvePrimaryPurchaserIdentity(' cisc-1 ', deps)
    expect(r.branch).toBe('member')
    if (r.branch !== 'member') throw new Error('expected member')
    expect(r.canonicalMemberNumber).toBe('CISC-1')
    expect(deps.lookupManagement).not.toHaveBeenCalled()
  })

  it('returns management when member not found and code resolves', async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberNotFound()),
      lookupManagement: vi.fn().mockResolvedValue(managementOk()),
    }
    const r = await resolvePrimaryPurchaserIdentity('reg-a', deps)
    expect(r.branch).toBe('management')
    if (r.branch !== 'management') throw new Error('expected management')
    expect(r.normalizedCode).toBe('REG-A')
    expect(deps.lookupMember).toHaveBeenCalledWith('reg-a')
    expect(deps.lookupManagement).toHaveBeenCalledWith('reg-a')
  })

  it('returns neither when member not found and management fails', async () => {
    const deps: PrimaryPurchaserIdentityDeps = {
      lookupMember: vi.fn().mockResolvedValue(memberNotFound()),
      lookupManagement: vi.fn().mockResolvedValue({ kind: 'not_found' }),
    }
    const r = await resolvePrimaryPurchaserIdentity('zzz', deps)
    expect(r.branch).toBe('neither')
    if (r.branch !== 'neither') throw new Error('expected neither')
    expect(r.inputTrim).toBe('zzz')
  })
})
```

- [ ] **Step 4: Jalankan tes**

Run (dari root repo, dengan Node 24 / `nvm use` sesuai `AGENTS.md`):

```bash
cd /Users/mac/Documents/CISC/match-screening && export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use && pnpm vitest run src/lib/registrations/resolve-primary-purchaser-identity.test.ts
```

Expected: **PASS** (empat tes hijau).

- [ ] **Step 5: Commit**

```bash
git add src/lib/registrations/resolve-primary-purchaser-identity.ts \
  src/lib/registrations/resolve-primary-purchaser-identity.test.ts \
  src/lib/forms/submit-registration-schema.ts
git commit -m "feat(registration): add primary purchaser identity resolver"
```

---

### Task 2: Hook `usePrimaryPurchaserIdentityGate`

**Files:**

- Create: `src/components/public/registration-form/use-primary-purchaser-identity-gate.ts`
- Modify: `src/components/public/registration-form/registration-form.tsx`
- Modify (jika perlu re-export tipe): `src/components/public/registration-form/types.ts`

- [ ] **Step 1: Implementasikan hook**

Create `src/components/public/registration-form/use-primary-purchaser-identity-gate.ts` — pola umum (salin reset partner + seat check dari `use-partner-gate.ts`, autofill nama dari `use-management-code-gate.ts`):

- Parameter: `(form, eventSlug, combinedTrim: string)` di mana `combinedTrim` dihitung di parent sebagai `(claimedMemberTrim || managementCodeTrim)` (saling eksklusif setelah hook stabil).
- Debounce 300 ms sama seperti hook lama.
- Panggil `resolvePrimaryPurchaserIdentity(combinedTrim, { lookupMember: lookupMemberPartnerEligibility, lookupManagement: lookupManagementCodeForRegistration })`.
- **`branch: "empty"`** — `setValue("claimedMemberNumber", undefined)`, `setValue("managementPublicCode", "")`, `clearErrors(["claimedMemberNumber","managementPublicCode"])`, reset state gate ke `empty`, mirror efek hapus `memberCardPhoto` seperti `usePartnerGate`.
- **`branch: "member"`** — tulis `claimedMemberNumber` kanonis, kosongkan `managementPublicCode`, lalu panggil `primaryMemberSeatTakenForActiveEventSlug(eventSlug, canonical)` seperti blok baris 94–118 `use-partner-gate.ts` (set error duplicate / reset partner jika taken).
- **`branch: "management"`** — `setValue("claimedMemberNumber", undefined)`, `setValue("managementPublicCode", normalizedCode)`, `clearErrors`, autofill `contactName` jika `purchaserIsMember` (sama baris 88–91 `use-management-code-gate.ts`).
- **`branch: "neither"`** — kosongkan kedua field identitas **atau** set `claimedMemberNumber` ke `inputTrim` tergantung UX yang dipilih; disarankan: **set** `claimedMemberNumber` ke `inputTrim` agar nilai tetap di form, `managementPublicCode` `""`, `setError("claimedMemberNumber", { message: PRIMARY_PURCHASER_IDENTITY_NOT_RECOGNIZED_MESSAGE })` agar satu field UI bisa menampilkan error (submit server tetap memvalidasi terpisah — pastikan server error mapping di Task 3).

Export:

```ts
export type PrimaryPurchaserIdentityGateState =
  | { status: 'empty' }
  | { status: 'checking'; forTrim: string }
  | PartnerGateCompatibleReadyState // reuse union dari types.ts jika memungkinkan, atau duplikasi minimal untuk member path + seat
```

Minimal: kembalikan `{ effectivePartnerGate, effectiveManagementCodeGate, directoryVerifiedByCode, showPartnerSection }` dengan bentuk yang **kompatibel** dengan pemakaian saat ini di `registration-form.tsx` agar diff `PurchaserInfoSection` lebih kecil — `effectiveManagementCodeGate` bisa disintesis dari state internal saat jalur management aktif.

- [ ] **Step 2: Wire di `registration-form.tsx`**

Replace:

```ts
const { effectivePartnerGate, showPartnerSection: showPartnerByNumber } = usePartnerGate(
  form,
  event.slug,
  claimedMemberTrim,
  managementCodeTrim,
)

const { directoryVerifiedByCode, effectiveManagementCodeGate } = useManagementCodeGate(
  form,
  managementCodeTrim,
  claimedMemberTrim,
)
```

dengan pemanggilan hook baru, misalnya:

```ts
const primaryIdentityTrim = claimedMemberTrim.length > 0 ? claimedMemberTrim : managementCodeTrim

const {
  effectivePartnerGate,
  effectiveManagementCodeGate,
  directoryVerifiedByCode,
  showPartnerSection: showPartnerByNumber,
} = usePrimaryPurchaserIdentityGate(form, event.slug, primaryIdentityTrim)
```

Pastikan `showPartnerSection = showPartnerByNumber || directoryVerifiedByCode` tetap.

- [ ] **Step 3: Jalankan tes unit yang ada (regresi)**

```bash
cd /Users/mac/Documents/CISC/match-screening && export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use && pnpm vitest run src/lib/forms/submit-registration-schema.test.ts src/components/public/registration-form/registration-steps.test.ts
```

Expected: **PASS**.

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/use-primary-purchaser-identity-gate.ts \
  src/components/public/registration-form/registration-form.tsx \
  src/components/public/registration-form/types.ts
git commit -m "feat(registration): unify primary identity lookups in one hook"
```

---

### Task 3: UI — satu input di `PurchaserInfoSection`

**Files:**

- Modify: `src/components/public/registration-form/purchaser-info-section.tsx`

- [ ] **Step 1: Ganti dua `Controller` dengan satu blok**

Untuk `purchaserIsMember === true`:

- Satu `Field` dengan `id="ms-registration-primary-identity"`.
- Label disarankan: `Nomor member` saja — **hapus** span `(atau kode pengurus di bawah)`.
- `value={claimedMemberTrim || managementCodeTrim}` — baca dari `useWatch` atau terus terima props dari parent: tambahkan prop opsional `primaryIdentityTrim` jika ingin hindari double watch; boleh gunakan `useWatch` untuk `claimedMemberNumber` dan `managementPublicCode` di dalam section.
- `onChange`:

```ts
const v = e.target.value
setValue('managementPublicCode', '', { shouldValidate: false })
setValue('claimedMemberNumber', v === '' ? undefined : v, {
  shouldValidate: true,
})
```

Hook Task 2 akan memigrasikan ke `managementPublicCode` setelah debounce bila direktori gagal dan kode valid — jangan panggil `setValue` management dari `onChange` manual.

- **Hapus** seluruh `Controller` kedua (`managementPublicCode`) dan teks `FieldDescription` tentang pengurus / backup.

- Gabungkan status "memeriksa":

```tsx
{
  ;(claimedMemberTrim.length > 0 || managementCodeTrim.length > 0) && effectivePartnerGate.status === 'checking' ? (
    <FieldDescription>Memeriksa data member di direktori…</FieldDescription>
  ) : null
}
{
  ;(claimedMemberTrim.length > 0 || managementCodeTrim.length > 0) &&
  managementCodeTrim.length > 0 &&
  effectiveManagementCodeGate.status === 'checking' ? (
    <FieldDescription>Memeriksa kode akses…</FieldDescription>
  ) : null
}
```

(Sesuaikan kondisi dengan implementasi hook agar tidak double teks — idealnya satu baris "Memeriksa identitas…".)

- Error: tampilkan `FieldError` jika `errors.claimedMemberNumber` **atau** `errors.managementPublicCode` (gunakan `useFormState` / `formState` dari parent — jika `PurchaserInfoSection` tidak punya akses `formState`, tambahkan prop `identityFieldErrors: { claimed?: FieldError; management?: FieldError }` dari `registration-form.tsx`).

- Pertahankan `Alert` duplicate seat untuk jalur member (`MEMBER_ALREADY_REGISTERED_FOR_EVENT_MESSAGE`).

- [ ] **Step 2: Sesuaikan props komponen**

Hapus props yang redundan jika gate digabung; minimal pastikan TypeScript `Props` di header file konsisten.

- [ ] **Step 3: `pnpm lint`**

```bash
cd /Users/mac/Documents/CISC/match-screening && export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use && pnpm lint
```

Expected: **exit code 0**.

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/purchaser-info-section.tsx \
  src/components/public/registration-form/registration-form.tsx
git commit -m "feat(registration): single primary identity field in purchaser UI"
```

---

### Task 4: `goNext`, submit, dan server error parity

**Files:**

- Modify: `src/components/public/registration-form/registration-form.tsx`
- Modify (opsional): `src/lib/actions/submit-registration.ts`

- [ ] **Step 1: Satukan pesan "tunggu validasi" di `goNext`**

Di callback `goNext`, ganti dua cabang terpisah (claimed vs management) menjadi satu:

- Jika `purchaserIsMember && primaryIdentityTrim.length > 0 && !directoryVerified`:
  - Jika gate status `checking` → return.
  - Jika ada error di `claimedMemberNumber` atau `managementPublicCode` → `setFocus("ms-registration-primary-identity")` memerlukan ref — **lebih sederhana**: `void form.setFocus("claimedMemberNumber")` (RHF tetap mendaftarkan nama field meskipun tidak ada Controller — pastikan `register` atau `Controller` untuk `claimedMemberNumber` masih ada; jika hanya native input, gunakan `register("claimedMemberNumber")` pada input tunggal).

- [ ] **Step 2: `submitForm` duplicate seat**

Tetap memeriksa `claimedMemberNumber` untuk seat taken; untuk jalur murni management, seat duplicate by member number tidak lewat field yang sama — biarkan seperti sekarang.

- [ ] **Step 3 (opsional): Samakan pesan server bila kode pengurus gagal**

Jika produk ingin pesan server sama dengan klien, di `submit-registration.ts` pada blok `managementPublicCodeTrim` gagal, pertimbangkan map pesan ke string yang sama dengan `PRIMARY_PURCHASER_IDENTITY_NOT_RECOGNIZED_MESSAGE` — **hanya** jika tidak mengorbankan pesan spesifik "tidak terdaftar dalam kepengurusan aktif" yang berguna untuk debugging internal. Default rencana: **biarkan** pesan server spesifik; UI utama sudah tidak menampilkan narasi pengurus.

- [ ] **Step 4: Hapus hook lama yang tidak terpakai**

```bash
cd /Users/mac/Documents/CISC/match-screening && rg "usePartnerGate|useManagementCodeGate" src
```

Jika hanya dipakai di `registration-form.tsx`, hapus file atau ekspor dead — prefer **hapus file** hanya setelah yakin tidak ada impor.

- [ ] **Step 5: `pnpm test`**

```bash
cd /Users/mac/Documents/CISC/match-screening && export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use && pnpm test
```

Expected: **semua tes hijau**.

- [ ] **Step 6: Commit**

```bash
git add src/components/public/registration-form/registration-form.tsx \
  src/lib/actions/submit-registration.ts
git commit -m "fix(registration): align goNext and cleanup legacy identity hooks"
```

---

## Self-review

**1. Spec coverage**

| Permintaan                                      | Task                                                          |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Satu input untuk nomor atau kode                | Task 3 + hook Task 2                                          |
| Tidak menampilkan keterangan pengurus di publik | Task 3 (hapus deskripsi field kedua & label bantu pengurus)   |
| Privilege pengurus non-member tetap ada         | Task 1–2 (fallback lookup management setelah direktori gagal) |

**2. Placeholder scan**

Tidak ada TBD/TODO generik; semua path file dan cuplikan kode konkret.

**3. Type consistency**

`ResolvePrimaryPurchaserIdentityResult.branch` konsisten di tes dan implementasi; hook mengembalikan struktur kompatibel dengan `registration-form` yang ada.

**Gap yang disadari:** Uji manual wajib — alur member valid, kode pengurus valid, input salah, dan duplicate seat — karena tidak ada tes browser di repo.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-13-unified-purchaser-identity-input.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch subagent segar per task, review antar task, iterasi cepat (**REQUIRED SUB-SKILL:** superpowers:subagent-driven-development)

**2. Inline Execution** — jalankan task di sesi ini dengan checkpoint (**REQUIRED SUB-SKILL:** superpowers:executing-plans)

**Which approach?**
