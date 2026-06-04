# Member Lookup PII Redaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WhatsApp dan email dari lookup member Tangsel tidak lagi dikirim plaintext ke browser; nilai penuh di-merge dari DB saat submit.

**Architecture:** Shared mask helpers di `lib/members/`; `lookupMemberForRegistration` mask sebelum return; klien hanya auto-fill `holderName`; `submitRegistration` re-lookup dan merge WA/email dari direktori bila form kosong.

**Tech Stack:** Next.js server actions, Prisma, Vitest, existing `mask-contact-display` rules.

**Spec:** [2026-06-05-member-lookup-pii-redaction-design.md](../specs/2026-06-05-member-lookup-pii-redaction-design.md)

---

### Task 1: Shared mask module

**Files:**
- Create: `src/lib/members/mask-member-contact-display.ts`
- Create: `src/lib/members/mask-member-contact-display.test.ts`
- Modify: `src/components/public/registration-form/mask-contact-display.ts`

- [ ] **Step 1: Write failing tests for mask helpers**

Pindahkan implementasi `maskDisplayWhatsapp` dan `maskDisplayEmail` (plus test cases) ke `src/lib/members/mask-member-contact-display.test.ts`.

- [ ] **Step 2: Implement lib module**

Export `maskDisplayWhatsapp`, `maskDisplayEmail` dari `src/lib/members/mask-member-contact-display.ts`. Pertahankan juga `maskDisplayName` dan `contactInitials` di `mask-contact-display.ts` (UI-only) atau pindahkan semua ke lib — minimal WA/email harus di lib.

- [ ] **Step 3: Re-export from client module**

Update `mask-contact-display.ts` agar import WA/email mask dari lib (backward compat untuk `holder-card.tsx`).

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/lib/members/mask-member-contact-display.test.ts src/components/public/registration-form/mask-contact-display.test.ts
```

---

### Task 2: Mask lookup response

**Files:**
- Modify: `src/lib/actions/lookup-member-for-registration.ts`
- Create: `src/lib/actions/lookup-member-for-registration.test.ts`

- [ ] **Step 1: Write failing test**

Mock Prisma; assert response `valid` contains masked WA/email, **not** raw values:

```ts
// member.whatsapp = '+628119821309'
expect(result.whatsapp).not.toContain('9821309')
expect(result.whatsapp).toMatch(/•/)
```

- [ ] **Step 2: Apply mask in action**

Import mask helpers; on `valid` return:

```ts
whatsapp: member.whatsapp ? maskDisplayWhatsapp(member.whatsapp) : null,
email: member.email ? maskDisplayEmail(member.email) : null,
```

- [ ] **Step 3: Run test**

```bash
pnpm vitest run src/lib/actions/lookup-member-for-registration.test.ts
```

---

### Task 3: Client — stop autofill plaintext

**Files:**
- Modify: `src/components/public/registration-form/holder-card.tsx`

- [ ] **Step 1: Update autofill effect**

Hanya set `holderName` dari `validationResult.fullName`. Hapus `setValue` untuk `holderWhatsapp` dan `holderEmail` dari lookup effect.

- [ ] **Step 2: Profile card display**

Logic tampilan kartu:
- WA/email dari form user (jika diisi) → mask client-side untuk kartu.
- Else → pakai `validationResult.whatsapp` / `validationResult.email` (sudah masked server-side).

- [ ] **Step 3: Fix `memberVerifiedNoWa` / `memberVerifiedNoEmail`**

Deteksi “kosong di direktori” via `validationResult` null masked fields + form kosong (bukan cek digit plaintext).

- [ ] **Step 4: Manual smoke**

Lookup member valid → DevTools tidak menampilkan email/WA plaintext; kartu profil tetap masked; Ubah kontak tetap berfungsi.

---

### Task 4: Submit merge from directory

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/actions/__tests__/submit-registration.integration.test.ts`

- [ ] **Step 1: Write failing integration test**

Tangsel holder dengan `holderWhatsapp: ''`, `holderEmail: ''`, valid `claimedMemberNumber`. Mock lookup returns `valid` with DB fields. Assert `registration.create` receives WA/email from directory (bukan empty).

- [ ] **Step 2: Implement merge helper**

Extract kecil (inline OK) di `submit-registration.ts`:

```ts
function resolveTangselContact(
  form: HolderInput,
  member: { whatsapp: string | null; email: string | null },
): { whatsapp: string; email: string } {
  const whatsapp = form.holderWhatsapp?.trim() || member.whatsapp?.trim() || ''
  const email = form.holderEmail?.trim() || member.email?.trim() || ''
  return { whatsapp, email }
}
```

Panggil setelah re-lookup valid, sebelum `registration.create`. Override form jika user mengisi manual.

- [ ] **Step 3: Primary email validation**

Jika merge email masih kosong untuk holder 0 → `rootError('Email kontak wajib diisi')` (Indonesian).

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/lib/actions/__tests__/submit-registration.integration.test.ts
```

---

### Task 5: Docs & CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (Key library modules — tambah `lib/members/mask-member-contact-display.ts` jika modul baru)

- [ ] **Step 1: Update CLAUDE.md** — satu baris di Key library modules untuk shared mask + invariant lookup PII.

---

### Task 6: Final verification

- [ ] `pnpm vitest run` (affected tests)
- [ ] `pnpm lint`
- [ ] Confirm DevTools lookup response: no plaintext WA/email
