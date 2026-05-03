# Resend Email Integration for Better Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Resend to actually send transactional emails for Better Auth — magic-link sign-in and 2FA email OTP — with React Email HTML templates in Indonesian.

**Architecture:** Install `@react-email/components` + `@react-email/render` for HTML templates rendered server-side; update `sendTransactionalEmail` to accept `html`; wire magic-link plugin in `auth.ts` to call it; add `magicLinkClient` to the admin auth client and a magic-link section to the sign-in UI.

**Tech Stack:** Next.js 16 App Router, Better Auth 1.6.9, Resend 6.x, `@react-email/components`, `@react-email/render`, Vitest (node env), TypeScript.

---

## File Map

| Action  | Path                                                                    | Purpose                                                  |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Rename  | `src/lib/auth/email-otp-config.ts` → `transactional-email-config.ts`   | Gate function now covers both OTP and magic link         |
| Rename  | `src/lib/auth/email-otp-config.test.ts` → `transactional-email-config.test.ts` | Follow the source rename                      |
| Modify  | `src/lib/auth/send-transactional-email.ts`                              | Add `html?: string` to input type                        |
| Create  | `src/lib/auth/emails/magic-link-email.tsx`                              | React Email component — magic link                       |
| Create  | `src/lib/auth/emails/otp-email.tsx`                                     | React Email component — 2FA OTP                          |
| Create  | `src/lib/auth/emails/render-emails.ts`                                  | Non-JSX render helpers used from `.ts` callers           |
| Create  | `src/lib/auth/emails/render-emails.test.ts`                             | Vitest tests for rendered HTML                           |
| Modify  | `src/lib/auth/build-two-factor-plugin-options.ts`                       | Use HTML OTP template + updated import path              |
| Modify  | `src/lib/auth/auth.ts`                                                  | Wire `sendMagicLink` to Resend with template             |
| Modify  | `src/lib/auth/admin-auth-client.ts`                                     | Add `magicLinkClient()` plugin                           |
| Modify  | `src/app/(auth)/admin/sign-in/page.tsx`                                 | Convert to server component, pass `magicLinkEnabled`     |
| Create  | `src/components/admin/admin-sign-in-client.tsx`                         | Client form — email+password + magic link sections       |
| Create  | `src/app/(auth)/admin/sign-in/magic-link-sent/page.tsx`                 | Confirmation page after sending magic link               |
| Modify  | `.env.example`                                                          | Promote email vars from "optional" to documented         |

---

## Task 1: Install React Email dependencies

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install packages**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm add @react-email/components @react-email/render
```

Expected: `@react-email/components` and `@react-email/render` appear in `package.json` dependencies.

- [ ] **Step 2: Verify TypeScript can find the types**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit --strict false src/lib/auth/send-transactional-email.ts 2>&1 | head -20
```

Expected: No errors about missing modules.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @react-email/components and @react-email/render"
```

---

## Task 2: Rename `isEmailOtpConfigured` → `isTransactionalEmailConfigured`

The gate function now controls both OTP and magic-link email. Rename the file and the function; update all three callers.

**Files:**
- Rename: `src/lib/auth/email-otp-config.ts` → `src/lib/auth/transactional-email-config.ts`
- Rename: `src/lib/auth/email-otp-config.test.ts` → `src/lib/auth/transactional-email-config.test.ts`
- Modify: `src/lib/auth/build-two-factor-plugin-options.ts`
- Modify: `src/app/(auth)/admin/sign-in/two-factor/page.tsx`

- [ ] **Step 1: Write new `transactional-email-config.ts`**

Create `src/lib/auth/transactional-email-config.ts`:

```ts
export function isTransactionalEmailConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.AUTH_TRANSACTIONAL_FROM?.trim() ?? "";
  return key.length > 0 && from.length > 0;
}
```

- [ ] **Step 2: Write updated test file**

Create `src/lib/auth/transactional-email-config.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";

describe("isTransactionalEmailConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when RESEND_API_KEY is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns false when AUTH_TRANSACTIONAL_FROM is missing", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "");
    expect(isTransactionalEmailConfigured()).toBe(false);
  });

  it("returns true when both are non-empty trimmed", () => {
    vi.stubEnv("RESEND_API_KEY", "re_xxx");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "Match Screening <otp@example.com>");
    expect(isTransactionalEmailConfigured()).toBe(true);
  });
});
```

- [ ] **Step 3: Run new test to confirm it passes**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/transactional-email-config.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Update `build-two-factor-plugin-options.ts` — change import**

In `src/lib/auth/build-two-factor-plugin-options.ts`, replace:

```ts
import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";
```

with:

```ts
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
```

And replace `isEmailOtpConfigured()` call with `isTransactionalEmailConfigured()`.

- [ ] **Step 5: Update `two-factor/page.tsx` — change import**

In `src/app/(auth)/admin/sign-in/two-factor/page.tsx`, replace:

```ts
import { isEmailOtpConfigured } from "@/lib/auth/email-otp-config";
```

with:

```ts
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
```

And replace `isEmailOtpConfigured()` call with `isTransactionalEmailConfigured()`.

- [ ] **Step 6: Delete old files**

```bash
rm src/lib/auth/email-otp-config.ts src/lib/auth/email-otp-config.test.ts
```

- [ ] **Step 7: Run existing two-factor plugin tests to confirm nothing broke**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/build-two-factor-plugin-options.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth/ src/app/\(auth\)/admin/sign-in/two-factor/page.tsx
git commit -m "refactor(auth): rename isEmailOtpConfigured to isTransactionalEmailConfigured"
```

---

## Task 3: Add HTML support to `sendTransactionalEmail`

**Files:**
- Modify: `src/lib/auth/send-transactional-email.ts`
- Create: `src/lib/auth/send-transactional-email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/send-transactional-email.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("sendTransactionalEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mockSend.mockReset();
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <x@y.com>");
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await expect(
      sendTransactionalEmail({ to: "a@b.com", subject: "Hi", text: "Hello" })
    ).rejects.toThrow("Email pengiriman belum dikonfigurasi.");
  });

  it("calls resend.emails.send with text and html when both provided", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <noreply@app.com>");
    mockSend.mockResolvedValue({ data: { id: "abc" }, error: null });
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Plain text",
      html: "<p>HTML version</p>",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Test",
        text: "Plain text",
        html: "<p>HTML version</p>",
      })
    );
  });

  it("calls resend.emails.send without html when not provided", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("AUTH_TRANSACTIONAL_FROM", "App <noreply@app.com>");
    mockSend.mockResolvedValue({ data: { id: "xyz" }, error: null });
    const { sendTransactionalEmail } = await import(
      "@/lib/auth/send-transactional-email"
    );
    await sendTransactionalEmail({
      to: "user@example.com",
      subject: "OTP",
      text: "Your code: 123456",
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Your code: 123456" })
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.not.objectContaining({ html: expect.anything() })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/send-transactional-email.test.ts
```

Expected: Tests fail (html not implemented yet, and module reset issues expected).

- [ ] **Step 3: Update `send-transactional-email.ts` to support html**

Replace `src/lib/auth/send-transactional-email.ts` with:

```ts
import { Resend } from "resend";

export type SendTransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

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
    ...(input.html !== undefined ? { html: input.html } : {}),
  });

  if (error) {
    console.error("[sendTransactionalEmail]", error);
    throw new Error("Gagal mengirim email.");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/send-transactional-email.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/send-transactional-email.ts src/lib/auth/send-transactional-email.test.ts
git commit -m "feat(auth): add html support to sendTransactionalEmail"
```

---

## Task 4: Create React Email templates

**Files:**
- Create: `src/lib/auth/emails/magic-link-email.tsx`
- Create: `src/lib/auth/emails/otp-email.tsx`

- [ ] **Step 1: Create magic link email template**

Create `src/lib/auth/emails/magic-link-email.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Link masuk ke Match Screening admin</Preview>
      <Body
        style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif", margin: 0, padding: 0 }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Text
            style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px", color: "#18181b" }}
          >
            Match Screening
          </Text>
          <Text style={{ color: "#374151", lineHeight: "1.6", margin: "0 0 24px" }}>
            Klik tombol di bawah untuk masuk ke halaman admin. Link ini hanya berlaku sekali dan
            akan kedaluwarsa dalam 5 menit.
          </Text>
          <Section style={{ textAlign: "center", margin: "0 0 24px" }}>
            <Button
              href={url}
              style={{
                backgroundColor: "#18181b",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "500",
                display: "inline-block",
              }}
            >
              Masuk sekarang
            </Button>
          </Section>
          <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
            Jika Anda tidak meminta link ini, abaikan email ini.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 2: Create OTP email template**

Create `src/lib/auth/emails/otp-email.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function OtpEmail({ otp }: { otp: string }) {
  return (
    <Html lang="id">
      <Head />
      <Preview>Kode verifikasi Match Screening: {otp}</Preview>
      <Body
        style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif", margin: 0, padding: 0 }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            padding: "32px",
            borderRadius: "8px",
          }}
        >
          <Text
            style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px", color: "#18181b" }}
          >
            Kode verifikasi
          </Text>
          <Text style={{ color: "#374151", margin: "0 0 16px" }}>
            Kode 6 digit untuk masuk ke Match Screening:
          </Text>
          <Text
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              letterSpacing: "0.15em",
              textAlign: "center",
              margin: "24px 0",
              fontFamily: "monospace",
              color: "#18181b",
            }}
          >
            {otp}
          </Text>
          <Text style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>
            Kode berlaku selama 5 menit. Jika Anda tidak meminta kode ini, abaikan email ini.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Step 3: Commit templates**

```bash
git add src/lib/auth/emails/
git commit -m "feat(auth): add React Email templates for magic link and OTP"
```

---

## Task 5: Create render helpers and test them

**Files:**
- Create: `src/lib/auth/emails/render-emails.ts`
- Create: `src/lib/auth/emails/render-emails.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/emails/render-emails.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { renderMagicLinkEmail, renderOtpEmail } from "@/lib/auth/emails/render-emails";

describe("renderMagicLinkEmail", () => {
  it("includes the URL as an href", async () => {
    const url = "https://example.com/api/auth/magic-link/verify?token=abc123";
    const html = await renderMagicLinkEmail(url);
    expect(html).toContain(url);
  });

  it("includes Indonesian action text", async () => {
    const html = await renderMagicLinkEmail("https://example.com");
    expect(html).toContain("Masuk sekarang");
  });

  it("includes expiry warning in Indonesian", async () => {
    const html = await renderMagicLinkEmail("https://example.com");
    expect(html).toContain("kedaluwarsa");
  });
});

describe("renderOtpEmail", () => {
  it("includes the OTP code", async () => {
    const html = await renderOtpEmail("847291");
    expect(html).toContain("847291");
  });

  it("includes Indonesian label", async () => {
    const html = await renderOtpEmail("000000");
    expect(html).toContain("Kode verifikasi");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/emails/render-emails.test.ts
```

Expected: FAIL — render-emails module not found.

- [ ] **Step 3: Create render helpers**

Create `src/lib/auth/emails/render-emails.ts`:

```ts
import { createElement } from "react";
import { render } from "@react-email/render";

import { MagicLinkEmail } from "./magic-link-email";
import { OtpEmail } from "./otp-email";

export const renderMagicLinkEmail = (url: string): Promise<string> =>
  render(createElement(MagicLinkEmail, { url }));

export const renderOtpEmail = (otp: string): Promise<string> =>
  render(createElement(OtpEmail, { otp }));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/emails/render-emails.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/emails/render-emails.ts src/lib/auth/emails/render-emails.test.ts
git commit -m "feat(auth): add render helpers for React Email templates"
```

---

## Task 6: Wire magic link sending in `auth.ts`

**Files:**
- Modify: `src/lib/auth/auth.ts`

- [ ] **Step 1: Update `auth.ts` to send magic link via Resend**

Replace the entire content of `src/lib/auth/auth.ts` with:

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { buildTwoFactorPlugin } from "@/lib/auth/build-two-factor-plugin-options";
import { renderMagicLinkEmail } from "@/lib/auth/emails/render-emails";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { prisma } from "../db/prisma";

export const auth = betterAuth({
  appName: "match-screening",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    nextCookies(),
    buildTwoFactorPlugin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!isTransactionalEmailConfigured()) {
          console.log("[magicLink] Email belum dikonfigurasi.", { email, url });
          return;
        }
        const html = await renderMagicLinkEmail(url);
        await sendTransactionalEmail({
          to: email,
          subject: "Link masuk Match Screening",
          text: `Klik link berikut untuk masuk ke Match Screening:\n\n${url}\n\nLink berlaku 5 menit.`,
          html,
        });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: No new errors from auth.ts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/auth.ts
git commit -m "feat(auth): wire magic link sending via Resend with HTML template"
```

---

## Task 7: Update OTP to send HTML email

**Files:**
- Modify: `src/lib/auth/build-two-factor-plugin-options.ts`

- [ ] **Step 1: Update `build-two-factor-plugin-options.ts`**

Replace the entire content of `src/lib/auth/build-two-factor-plugin-options.ts` with:

```ts
import { twoFactor } from "better-auth/plugins";

import { renderOtpEmail } from "@/lib/auth/emails/render-emails";
import { sendTransactionalEmail } from "@/lib/auth/send-transactional-email";
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";

export function buildTwoFactorPlugin() {
  return twoFactor(buildTwoFactorPluginOptions());
}

export function buildTwoFactorPluginOptions() {
  const base = {
    backupCodeOptions: {
      amount: 10,
      length: 10,
      storeBackupCodes: "encrypted" as const,
    },
    totpOptions: {
      digits: 6 as const,
      period: 30,
      issuer: "match-screening",
    },
  };

  if (!isTransactionalEmailConfigured()) {
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
        const html = await renderOtpEmail(otp);
        await sendTransactionalEmail({
          to: user.email,
          subject: "Kode verifikasi Match Screening",
          text: `Kode verifikasi Anda: ${otp}\n\nKode berlaku singkat. Jika Anda tidak meminta kode ini, abaikan email ini.`,
          html,
        });
      },
    },
  };
}
```

- [ ] **Step 2: Run two-factor plugin tests to confirm nothing broke**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/auth/build-two-factor-plugin-options.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/build-two-factor-plugin-options.ts
git commit -m "feat(auth): OTP email now sends HTML template via Resend"
```

---

## Task 8: Add `magicLinkClient` to admin auth client

**Files:**
- Modify: `src/lib/auth/admin-auth-client.ts`

- [ ] **Step 1: Update `admin-auth-client.ts`**

Replace the entire content of `src/lib/auth/admin-auth-client.ts` with:

```ts
"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
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
    magicLinkClient(),
  ],
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/admin-auth-client.ts
git commit -m "feat(auth): add magicLinkClient plugin to admin auth client"
```

---

## Task 9: Refactor sign-in page and add magic link UI

The current `page.tsx` is a single client component file. Split it: make `page.tsx` a server component (so it can call `isTransactionalEmailConfigured()`) and move the form to `AdminSignInClient`.

**Files:**
- Modify: `src/app/(auth)/admin/sign-in/page.tsx`
- Create: `src/components/admin/admin-sign-in-client.tsx`

- [ ] **Step 1: Create `admin-sign-in-client.tsx` with magic link section**

Create `src/components/admin/admin-sign-in-client.tsx`:

```tsx
"use client";

import { Suspense, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminAuthClient } from "@/lib/auth/admin-auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const AdminSignInSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

type AdminSignInInput = z.infer<typeof AdminSignInSchema>;

type AdminSignInFormValues = AdminSignInInput & {
  root?: { server?: { message?: string } };
};

const adminSignInResolver = zodResolver(
  AdminSignInSchema as never,
) as Resolver<AdminSignInFormValues>;

const MagicLinkEmailSchema = z.object({
  email: z.string().email("Email tidak valid."),
});

type MagicLinkInput = z.infer<typeof MagicLinkEmailSchema>;
type MagicLinkFormValues = MagicLinkInput & {
  root?: { server?: { message?: string } };
};

function AdminSignInFormInner({ magicLinkEnabled }: { magicLinkEnabled: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") ?? "/admin", [search]);

  const [isPending, startTransition] = useTransition();
  const [isMagicPending, startMagicTransition] = useTransition();

  const form = useForm<AdminSignInFormValues>({
    resolver: adminSignInResolver,
    defaultValues: { email: "", password: "" },
    shouldFocusError: true,
  });

  const magicForm = useForm<MagicLinkFormValues>({
    resolver: zodResolver(MagicLinkEmailSchema as never) as Resolver<MagicLinkFormValues>,
    defaultValues: { email: "" },
    shouldFocusError: true,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">Masuk menggunakan email dan password.</p>

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors("root.server");
          startTransition(async () => {
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
            if (data?.twoFactorRedirect) return;
            router.push(next);
          });
        })}
      >
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ms-admin-signin-email">Email</FieldLabel>
              <Input
                {...field}
                id="ms-admin-signin-email"
                type="email"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
                placeholder="you@example.com"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ms-admin-signin-password">Password</FieldLabel>
              <Input
                {...field}
                id="ms-admin-signin-password"
                type="password"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {form.formState.errors.root?.server ? (
          <FieldError errors={[form.formState.errors.root.server]} />
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {magicLinkEnabled ? (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={magicForm.handleSubmit((values) => {
              magicForm.clearErrors("root.server");
              startMagicTransition(async () => {
                const res = await adminAuthClient.signIn.magicLink({
                  email: values.email,
                  callbackURL: next,
                });
                if (res.error) {
                  magicForm.setError("root.server", {
                    message: res.error.message ?? "Gagal mengirim magic link.",
                  });
                  return;
                }
                router.push(
                  `/admin/sign-in/magic-link-sent?email=${encodeURIComponent(values.email)}`
                );
              });
            })}
          >
            <p className="text-sm font-medium">Masuk dengan magic link</p>
            <Controller
              control={magicForm.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="ms-admin-magic-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="ms-admin-magic-email"
                    type="email"
                    aria-invalid={fieldState.invalid}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {magicForm.formState.errors.root?.server ? (
              <FieldError errors={[magicForm.formState.errors.root.server]} />
            ) : null}

            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={isMagicPending}
            >
              {isMagicPending ? "Mengirim…" : "Kirim magic link"}
            </Button>
          </form>
        </>
      ) : null}
    </main>
  );
}

export function AdminSignInClient({ magicLinkEnabled }: { magicLinkEnabled: boolean }) {
  return (
    <Suspense>
      <AdminSignInFormInner magicLinkEnabled={magicLinkEnabled} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Update `page.tsx` to server component**

Replace the entire content of `src/app/(auth)/admin/sign-in/page.tsx` with:

```tsx
import { isTransactionalEmailConfigured } from "@/lib/auth/transactional-email-config";
import { AdminSignInClient } from "@/components/admin/admin-sign-in-client";

export default function AdminSignInPage() {
  const magicLinkEnabled = isTransactionalEmailConfigured();
  return <AdminSignInClient magicLinkEnabled={magicLinkEnabled} />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/admin/sign-in/page.tsx src/components/admin/admin-sign-in-client.tsx
git commit -m "feat(auth): add magic link sign-in option to admin sign-in page"
```

---

## Task 10: Create magic-link-sent confirmation page

**Files:**
- Create: `src/app/(auth)/admin/sign-in/magic-link-sent/page.tsx`

- [ ] **Step 1: Create the confirmation page**

Create `src/app/(auth)/admin/sign-in/magic-link-sent/page.tsx`:

```tsx
import Link from "next/link";

export default function MagicLinkSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Cek email Anda</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kami sudah mengirim link masuk ke email Anda. Link berlaku selama 5 menit.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Tidak menerima email? Periksa folder spam atau{" "}
        <Link href="/admin/sign-in" className="underline underline-offset-4 hover:text-foreground">
          kembali dan coba lagi
        </Link>
        .
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/admin/sign-in/magic-link-sent/
git commit -m "feat(auth): add magic-link-sent confirmation page"
```

---

## Task 11: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Promote email env vars from comment to documented required section**

Replace `.env.example` with:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"

BETTER_AUTH_SECRET="change-me-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token_here"

# Transactional email — enables magic-link sign-in and 2FA email OTP.
# Get a key at https://resend.com/api-keys and add your verified sending domain.
# AUTH_TRANSACTIONAL_FROM format: "Display Name <noreply@yourdomain.com>"
RESEND_API_KEY=re_your_api_key_here
AUTH_TRANSACTIONAL_FROM="Match Screening <noreply@yourdomain.com>"
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document Resend env vars in .env.example"
```

---

## Task 12: Full test suite + build check

- [ ] **Step 1: Run full test suite**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm test
```

Expected: All tests pass (no regressions).

- [ ] **Step 2: Run build**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm build
```

Expected: Build completes without errors.

- [ ] **Step 3: Commit if any lint/type fixes were needed**

```bash
git add -p
git commit -m "fix: address build/lint issues from email integration"
```

---

## Self-review

### Spec coverage

| Requirement | Task |
| ----------- | ---- |
| Resend wired to send transactional emails | Tasks 3, 6, 7 |
| Magic link email sends real email | Task 6 |
| 2FA OTP email sends HTML | Task 7 |
| HTML email templates in Indonesian | Tasks 4, 5 |
| Magic link sign-in UI | Tasks 8, 9, 10 |
| Magic link confirmation page | Task 10 |
| Env vars documented | Task 11 |
| Gate: graceful degradation when email not configured | Tasks 2, 6, 9 |

### Placeholder scan

No placeholder phrases ("TBD", "TODO", "implement later") present. All code blocks are complete.

### Type consistency

- `renderMagicLinkEmail(url: string)` defined in Task 5, imported in Task 6.
- `renderOtpEmail(otp: string)` defined in Task 5, imported in Task 7.
- `isTransactionalEmailConfigured()` defined in Task 2, used in Tasks 6, 7, 9.
- `AdminSignInClient` defined in Task 9 step 1, imported in Task 9 step 2.
- `SendTransactionalEmailInput.html?: string` defined in Task 3, used in Tasks 6 and 7.

All consistent.
