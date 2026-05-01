# Admin 2FA (TOTP, backup, config-gated email OTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan 2FA penuh untuk admin: enrol TOTP + kode cadangan di `/admin/account`, verifikasi pasca-kata sandi di `/admin/sign-in/two-factor`, dan OTP email hanya bila variabel lingkungan untuk Resend + alamat `from` terisi (server tidak memasang `otpOptions` jika tidak).

**Architecture:** Single **shared** `createAuthClient` React (`adminAuthClient`) memasang `twoFactorClient` dengan `onTwoFactorRedirect` menuju halaman verifikasi sambil mempertahankan `?next=`. Server `betterAuth` memakai hasil `buildTwoFactorPluginOptions()` — objek `twoFactor(...)` digabungkan dengan `otpOptions` hanya jika `isEmailOtpConfigured()`. Helper `sendTransactionalEmail` memakai SDK Resend; teks error ke pengguna akhir generik.

**Tech Stack:** Next.js 16 App Router, Better Auth 1.6.9, Prisma, Vitest, `better-auth/react` + `better-auth/client/plugins` (`twoFactorClient`), `resend`, `react-qr-code`.

---

## File map (create / modify)

| Path | Peran |
|------|--------|
| **Create** `src/lib/auth/email-otp-config.ts` | `isEmailOtpConfigured()` membaca env yang disepakati. |
| **Create** `src/lib/auth/email-otp-config.test.ts` | Unit test gate env (Vitest `vi.stubEnv`). |
| **Create** `src/lib/auth/send-transactional-email.ts` | Kirim email teks via Resend; dipakai `otpOptions.sendOTP`. |
| **Create** `src/lib/auth/build-two-factor-plugin-options.ts` | Membangun opsi plugin `twoFactor` (TOTP/backup + OTP bersyarat). |
| **Create** `src/lib/auth/build-two-factor-plugin-options.test.ts` | Memastikan `otpOptions` hanya ada jika gate true. |
| **Create** `src/lib/auth/admin-auth-client.ts` | Export `adminAuthClient` (satu klien untuk semua UI admin auth). |
| **Create** `src/components/admin/admin-two-factor-verify-client.tsx` | Form verifikasi setelah sign-in (TOTP / backup / kirim+isi OTP email). |
| **Create** `src/components/admin/admin-account-two-factor-section.tsx` | Panel enrol/matikan/regenerasi cadangan di halaman Akun. |
| **Create** `src/app/(auth)/admin/sign-in/two-factor/page.tsx` | RSC: pass `emailOtpAvailable` + render klien verifikasi. |
| **Modify** `src/lib/auth/auth.ts` | Ganti literal `twoFactor({ issuer })` → `twoFactor(buildTwoFactorPluginOptions())`. |
| **Modify** `src/app/(auth)/admin/sign-in/page.tsx` | Pakai `adminAuthClient`; jangan `router.push(next)` jika 2FA redirect. |
| **Modify** `src/app/admin/account/page.tsx` | Ambil `twoFactorEnabled` dari Prisma + `emailOtpAvailable`; oper ke klien. |
| **Modify** `src/components/admin/admin-account-page-client.tsx` | Sisipkan section 2FA + props baru. |
| **Modify** `src/components/admin/admin-account-menu.tsx` | Pakai `adminAuthClient` untuk sign-out. |
| **Modify** `src/app/admin/settings/security/page.tsx` | Copy sesuai spesifikasi (manajemen di Akun; OTP email = config). |
| **Modify** `.env.example` | Dokumentasi `RESEND_API_KEY`, `AUTH_TRANSACTIONAL_FROM`. |
| **Modify** `package.json` | Bergantung pada `pnpm add resend react-qr-code` (lockfile ikut). |

---

### Task 1: Gate env `isEmailOtpConfigured` + unit tests

**Files:**
- Create: `src/lib/auth/email-otp-config.ts`
- Create: `src/lib/auth/email-otp-config.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";

describe("isEmailOtpConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when RESEND_API_KEY is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isEmailOtpConfigured()).toBe(false);
  });

  it("returns false when AUTH_TRANSACTIONAL_FROM is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    expect(isEmailOtpConfigured()).toBe(false);
  });

  it("returns true when both are non-empty trimmed", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isEmailOtpConfigured()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run (from repo root, Node 24):

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/email-otp-config.test.ts
```

Expected: error import/module missing atau fungsi tidak terdefinisi.

- [ ] **Step 3: Implement**

```typescript
/**
 * Email OTP for Better Auth twoFactor plugin is only enabled when outbound
 * transactional email is configured (Resend + RFC From).
 */
export function isEmailOtpConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim() ?? "";
  return key.length > 0 && from.length > 0;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Same command as Step 2. Expected: 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/email-otp-config.ts src/lib/auth/email-otp-config.test.ts
git commit -m "feat(auth): add isEmailOtpConfigured gate for Resend OTP"
```

---

### Task 2: Resend helper `sendTransactionalEmail`

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml` (via install)
- Create: `src/lib/auth/send-transactional-email.ts`

- [ ] **Step 1: Add dependency**

```bash
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm add resend
```

- [ ] **Step 2: Implement helper (throws if send fails; caller handles user message)**

```typescript
import { Resend } from "resend";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Sends a plain-text transactional email. Requires RESEND_API_KEY and uses
 * AUTH_TRANSACTIONAL_FROM as the sender (same gate as OTP plugin).
 */
export async function sendTransactionalEmail(input: SendTransactionalEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Email pengiriman belum dikonfigurasi.");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (error) {
    console.error("[sendTransactionalEmail]", error);
    throw new Error("Gagal mengirim email.");
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/auth/send-transactional-email.ts
git commit -m "feat(auth): add Resend transactional email helper"
```

---

### Task 3: `buildTwoFactorPluginOptions` + conditional `otpOptions` test

**Files:**
- Create: `src/lib/auth/build-two-factor-plugin-options.ts`
- Create: `src/lib/auth/build-two-factor-plugin-options.test.ts`

- [ ] **Step 1: Write failing test that stubs module**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

describe("buildTwoFactorPluginOptions", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("omits otpOptions when email OTP is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    const { buildTwoFactorPluginOptions } = await import(
      "@/lib/auth/build-two-factor-plugin-options"
    );
    const opts = buildTwoFactorPluginOptions();
    expect(opts).not.toHaveProperty("otpOptions");
  });

  it("includes otpOptions when email OTP is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <x@y.com>");
    const { buildTwoFactorPluginOptions } = await import(
      "@/lib/auth/build-two-factor-plugin-options"
    );
    const opts = buildTwoFactorPluginOptions();
    expect(opts.otpOptions).toBeDefined();
    expect(typeof opts.otpOptions?.sendOTP).toBe("function");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm vitest run src/lib/auth/build-two-factor-plugin-options.test.ts
```

- [ ] **Step 3: Implement builder**

```typescript
import { twoFactor } from "better-auth/plugins";

import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";

export function buildTwoFactorPlugin() {
  return twoFactor(buildTwoFactorPluginOptions());
}

export function buildTwoFactorPluginOptions() {
  const base = {
    issuer: "match-screening",
    backupCodeOptions: {
      amount: 10,
      length: 10,
      storeBackupCodes: "encrypted" as const,
    },
    totpOptions: {
      digits: 6 as const,
      period: 30,
    },
  };

  if (!isEmailOtpConfigured()) {
    return base;
  }

  return {
    ...base,
    otpOptions: {
      period: 5,
      digits: 6,
      allowedAttempts: 5,
      storeOTP: "encrypted" as const,
      sendOTP: async ({ user, otp }: { user: { email: string }; otp: string }) => {
        await sendTransactionalEmail({
          to: user.email,
          subject: "Kode verifikasi Match Screening",
          text: `Kode verifikasi Anda: ${otp}\n\nKode berlaku singkat. Jika Anda tidak meminta kode ini, abaikan email ini.`,
        });
      },
    },
  };
}
```

- [ ] **Step 4: Wire `auth.ts`**

Replace plugin entry:

```typescript
import { buildTwoFactorPlugin } from "@/lib/auth/build-two-factor-plugin-options";

// inside plugins: [
//   nextCookies(),
//   buildTwoFactorPlugin(),
```

Remove direct `import { twoFactor } from "better-auth/plugins"` if unused.

- [ ] **Step 5: Run all new tests**

```bash
pnpm vitest run src/lib/auth/email-otp-config.test.ts src/lib/auth/build-two-factor-plugin-options.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/build-two-factor-plugin-options.ts src/lib/auth/build-two-factor-plugin-options.test.ts src/lib/auth/auth.ts
git commit -m "feat(auth): conditional twoFactor otpOptions from Resend config"
```

---

### Task 4: Shared `adminAuthClient` + `twoFactorClient`

**Files:**
- Create: `src/lib/auth/admin-auth-client.ts`

- [ ] **Step 1: Implement**

```typescript
"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

function redirectToTwoFactorStep(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") ?? "/admin";
  window.location.href = `/admin/sign-in/two-factor?next=${encodeURIComponent(next)}`;
}

export const adminAuthClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: redirectToTwoFactorStep,
    }),
  ],
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/admin-auth-client.ts
git commit -m "feat(auth): admin auth client with twoFactorClient redirect"
```

---

### Task 5: Sign-in — pakai `adminAuthClient` + jangan push jika 2FA

**Files:**
- Modify: `src/app/(auth)/admin/sign-in/page.tsx`

- [ ] **Step 1: Replace client**

```typescript
import { adminAuthClient } from "@/lib/auth/admin-auth-client";
```

Remove `const authClient = createAuthClient()`. Use `adminAuthClient.signIn.email` everywhere `authClient` was used.

- [ ] **Step 2: Guard navigation after success**

Di dalam `handleSubmit`, setelah `await adminAuthClient.signIn.email({ email, password })`, cast aman ke cek redirect:

```typescript
const res = await adminAuthClient.signIn.email({
  email: values.email,
  password: values.password,
});
if (res.error) {
  form.setError("root.server", {
    message: res.error.message ?? "Sign in failed.",
  });
  return;
}
const data = res.data as { twoFactorRedirect?: boolean } | undefined;
if (data?.twoFactorRedirect) {
  return;
}
router.push(next);
```

Jika TypeScript mengeluh, gunakan `if (res.data && "twoFactorRedirect" in res.data && res.data.twoFactorRedirect) return;`.

- [ ] **Step 3: Manual smoke**

Jalankan `pnpm dev`, buka `/admin/sign-in`, akun tanpa 2FA harus masuk; dengan 2FA aktif harus redirect ke `/admin/sign-in/two-factor` (halaman bisa 404 sampai Task 6 — terima sementara).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/admin/sign-in/page.tsx
git commit -m "fix(auth): sign-in uses adminAuthClient and respects 2FA redirect"
```

---

### Task 6: Halaman `/admin/sign-in/two-factor` + komponen verifikasi

**Files:**
- Create: `src/app/(auth)/admin/sign-in/two-factor/page.tsx`
- Create: `src/components/admin/admin-two-factor-verify-client.tsx`
- Modify: `package.json` — `pnpm add react-qr-code` hanya jika diperlukan di halaman ini (**tidak** — QR di Akun; halaman ini tidak perlu QR).

- [ ] **Step 1: Server page**

```typescript
import { AdminTwoFactorVerifyClient } from "@/components/admin/admin-two-factor-verify-client";
import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";

export default async function AdminTwoFactorVerifyPage() {
  const emailOtpAvailable = isEmailOtpConfigured();
  return (
    <AdminTwoFactorVerifyClient emailOtpAvailable={emailOtpAvailable} />
  );
}
```

- [ ] **Step 2: Client verify component** (satu form dengan tab ringkas atau urutan: input kode TOTP utama, link cadangan, blok email opsional)

Minimal behavioral requirements:

- Field angka 6 digit → `adminAuthClient.twoFactor.verifyTotp({ code, trustDevice: true })` on submit.
- Secondary: backup code → `verifyBackupCode({ code, trustDevice: true })`.
- Jika `emailOtpAvailable`: tombol **Kirim kode ke email** memanggil metode pada `adminAuthClient.twoFactor` untuk mengirim OTP (nama pasti mengikuti tipe yang diinfer — cek autocomplete, mis. `sendOtp` / `sendOTP`), lalu field untuk verifikasi OTP (mis. `verifyOtp`) dengan `trustDevice: true` bila didukung.
- Setelah sukses: `useRouter().push(searchParams.get("next") ?? "/admin")`.
- Pesan error dari `error.message` ditampilkan; untuk gagal kirim email gunakan pesan generik Indonesia: `Terjadi kesalahan. Coba lagi atau gunakan kode aplikasi autentikator.`

Implementasi UI mengikuti pola `Field` / `Button` seperti `sign-in` page.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/admin/sign-in/two-factor/page.tsx src/components/admin/admin-two-factor-verify-client.tsx
git commit -m "feat(auth): admin 2FA verification step after sign-in"
```

---

### Task 7: Akun — section TOTP + cadangan

**Files:**
- Create: `src/components/admin/admin-account-two-factor-section.tsx`
- Modify: `src/app/admin/account/page.tsx`
- Modify: `src/components/admin/admin-account-page-client.tsx`
- Modify: `package.json` — add `react-qr-code`

- [ ] **Step 1: Add QR dependency**

```bash
pnpm add react-qr-code
```

- [ ] **Step 2: Server page loader**

Di `account/page.tsx`, import `prisma` dari `@/lib/db/prisma` dan:

```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: session.user.id },
  select: { twoFactorEnabled: true },
});
```

Pass ke klien: `twoFactorEnabled={Boolean(dbUser?.twoFactorEnabled)}` dan `emailOtpAvailable={isEmailOtpConfigured()}`.

- [ ] **Step 3: Section klien** (`admin-account-two-factor-section.tsx`)

Alur:

1. Jika belum aktif: tombol **Aktifkan 2FA** → dialog minta password → `adminAuthClient.twoFactor.enable({ password })` → dapat `totpURI` + `backupCodes` → tampilkan `QRCode` dari `react-qr-code` dan daftar cadangan (peringatan simpan sekali).
2. Field verifikasi kode pertama → `verifyTotp` untuk menyelesaikan aktivasi (sesuai dokumentasi plugin).
3. Jika sudah aktif: tombol **Nonaktifkan** dengan password (`twoFactor.disable`).
4. **Regenerasi cadangan** dengan password (`generateBackupCodes`).

Gunakan teks UI bahasa Indonesia konsisten dengan modul admin.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/account/page.tsx src/components/admin/admin-account-page-client.tsx src/components/admin/admin-account-two-factor-section.tsx package.json pnpm-lock.yaml
git commit -m "feat(admin): account page TOTP enrollment and backup codes"
```

---

### Task 8: Menu akun — `adminAuthClient` untuk sign-out

**Files:**
- Modify: `src/components/admin/admin-account-menu.tsx`

- [ ] **Step 1:** Ganti `createAuthClient()` dengan import `adminAuthClient` dari `@/lib/auth/admin-auth-client` dan pakai `adminAuthClient.signOut()`.

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/admin-account-menu.tsx
git commit -m "refactor(admin): use adminAuthClient for sign out"
```

---

### Task 9: Copy `security/page.tsx`

**Files:**
- Modify: `src/app/admin/settings/security/page.tsx`

- [ ] **Step 1:** Ganti paragraf “Autentikasi & 2FA” agar menyatakan: manajemen 2FA di **Akun**; OTP email hanya jika pengurus menyetel pengiriman email (tanpa nama env); tautan dokumentasi tetap.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/settings/security/page.tsx
git commit -m "docs(admin): clarify 2FA management and email OTP config"
```

---

### Task 10: `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1:** Tambahkan baris:

```
# Optional: enables Better Auth two-factor email OTP (requires both)
# RESEND_API_KEY=
# AUTH_TRANSACTIONAL_FROM="Match Screening <noreply@yourdomain.com>"
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(env): document Resend vars for 2FA email OTP"
```

---

### Task 11: Lint + test + build

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

- [ ] **Step 2: Tests**

```bash
pnpm test
```

- [ ] **Step 3: Build**

```bash
pnpm build
```

- [ ] **Step 4: Commit** hanya jika ada perbaikan otomatis yang tersisa; jika tidak, tidak perlu commit kosong.

---

## Plan validation (self-review)

**Spec coverage**

| Spesifikasi | Task |
|-------------|------|
| TOTP + backup + verify sign-in | 3, 4, 5, 6, 7 |
| OTP email hanya jika config | 1, 2, 3, 6, 7 |
| Akun sebagai pusat pengelolaan | 7 |
| Security copy | 9 |
| Helper email terpusat | 2 |
| Pesan error generik OTP | dimasukkan di Step Task 6 |
| Pengujian unit gate | 1, 3 |

**Placeholder scan:** Tidak ada TBD — nama env dan path file konkret.

**Type consistency:** `buildTwoFactorPlugin()` mengembalikan nilai dari `twoFactor(...)` tanpa anotasi eksplisit agar mengikuti upgrade Better Auth.

**Gap yang disengaja:** Tidak ada tes E2E browser; manual smoke di Task 5 dan 11 memenuhi spesifikasi “smoke manual”.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-admin-2fa-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
