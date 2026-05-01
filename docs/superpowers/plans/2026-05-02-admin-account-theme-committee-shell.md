# Admin account (dropdown + `/admin/account`) + theme + committee settings shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the MVP from [`2026-05-02-admin-account-and-committee-settings-shell-design.md`](../specs/2026-05-02-admin-account-and-committee-settings-shell-design.md): global **light/dark/system** theme via **`next-themes`**, **account menu** in admin chrome (Popover, no new sidebar item), full **`/admin/account`** page (**display name** editable via **Better Auth** `auth.api.updateUser`, **email** read-only), and **`/admin/settings`** replaced with **four placeholder sections** (Owner-only, no mutations).

**Architecture:** **Client** controls for theme use **`useTheme`** from `next-themes` (persistence + `class` on `<html>`). **Display name** updates use a **`"use server"`** action calling **`auth.api.updateUser({ body: { name }, headers: await headers() })`** after **`requireAdminSession()`**, with validation from a **pure helper** covered by **Vitest**. **Admin shell** gains a single **`AdminAccountMenu`** (Base UI **Popover**) listing identity, **Kelola akun**, and **Keluar**; **desktop sidebar** and **mobile sheet** no longer duplicate a separate footer sign-out button (one consistent location). **Committee** page remains RSC-only placeholder **cards**.

**Tech Stack:** Next.js App Router 16, React 19, Better Auth 1.6.9 (`better-auth/react` + `auth.api` on server), **next-themes** (new dependency), Prisma (no new fields for MVP), Vitest, existing shadcn/Base UI primitives (**Popover**, **Button**, **RadioGroup**, **Input**, **Label**, **Field**).

---

## File map (create / modify)

| File | Responsibility |
|------|----------------|
| `package.json` | Add `next-themes` dependency (`pnpm add next-themes`). |
| `src/components/theme-provider.tsx` | **Create** — client `ThemeProvider` wrapper (`attribute="class"`, `enableSystem`, `defaultTheme="system"`). |
| `src/app/layout.tsx` | **`suppressHydrationWarning`** on `<html>`; wrap `{children}` with `ThemeProvider`; keep font variables on `<html>`. |
| `src/lib/admin/normalize-admin-display-name.ts` | **Create** — pure normalization + length validation; Indonesian error messages. |
| `src/lib/admin/normalize-admin-display-name.test.ts` | **Create** — Vitest for empty/whitespace-only/too long/valid trim. |
| `src/lib/actions/update-admin-display-name.ts` | **Create** — `updateAdminDisplayName` server action → `ActionResult<void>`, `normalize` + `auth.api.updateUser`. |
| `src/app/admin/account/page.tsx` | **Create** — RSC: `requireAdminSession()`, pass `user.name` / `user.email` to client form. |
| `src/components/admin/admin-account-page-client.tsx` | **Create** — client: `useTransition` + **`react-hook-form`** + **`zod`** (or minimal `useState` if you prefer YAGNI — plan uses **zod** to match repo forms pattern) calling server action; **`useRouter().refresh()`** on success; embed **theme** control. |
| `src/components/admin/theme-preference-field.tsx` | **Create** — client: `useTheme` from `next-themes`, **RadioGroup** `light` / `dark` / `system`. |
| `src/components/admin/admin-account-menu.tsx` | **Create** — client: **Popover** trigger (email or “Akun” button), summary, **`Link`** to `/admin/account`, **Keluar** via `authClient.signOut()`; controlled `open` state to close on navigation. |
| `src/components/admin/admin-app-shell.tsx` | **Modify** — integrate `AdminAccountMenu` under desktop sidebar email block **and** mobile header strip; remove standalone `AdminSignOutForm` from sidebar **and** mobile sheet footer (sign-out only inside menu unless you revise). |
| `src/app/admin/settings/page.tsx` | **Modify** — replace single dashed placeholder with **four** `Card`/section placeholders (Indonesian copy per spec §5); rename default export to **`AdminCommitteeSettingsPage`**. |

---

### Task 1: Add `next-themes` and ThemeProvider scaffolding

**Files:**
- Modify: `package.json` (via lockfile after install)
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install dependency**

Run:

```bash
cd /path/to/match-screening
nvm use   # from repo root per AGENTS.md
pnpm add next-themes
```

Expected: `package.json` lists `"next-themes"` in `dependencies`.

- [ ] **Step 2: Create `ThemeProvider` client wrapper**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Wire root layout**

Edit `src/app/layout.tsx` — import `ThemeProvider`, add **`suppressHydrationWarning`** to `<html>`, wrap `{children}`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CISC Match Screening",
  description: "Public registration and admin verification for CISC events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Smoke**

Run: `pnpm dev`, open `http://localhost:3000` — page loads; no hydration error storm in console for theme.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/theme-provider.tsx src/app/layout.tsx
git commit -m "feat(theme): add next-themes provider at root layout"
```

---

### Task 2: Pure display-name validation (TDD)

**Files:**
- Create: `src/lib/admin/normalize-admin-display-name.ts`
- Create: `src/lib/admin/normalize-admin-display-name.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/admin/normalize-admin-display-name.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { normalizeAdminDisplayName } from "./normalize-admin-display-name";

describe("normalizeAdminDisplayName", () => {
  it("rejects empty after trim", () => {
    expect(normalizeAdminDisplayName("   ")).toEqual({
      ok: false,
      message: "Nama wajib diisi.",
    });
  });

  it("rejects longer than 120", () => {
    const s = "a".repeat(121);
    const r = normalizeAdminDisplayName(s);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/120/);
  });

  it("accepts trim and max length", () => {
    expect(normalizeAdminDisplayName("  Ada Nama  ")).toEqual({
      ok: true,
      value: "Ada Nama",
    });
    const max = "x".repeat(120);
    expect(normalizeAdminDisplayName(max)).toEqual({ ok: true, value: max });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run:

```bash
pnpm vitest run src/lib/admin/normalize-admin-display-name.test.ts
```

Expected: failure (cannot import module or function undefined).

- [ ] **Step 3: Implement helper**

Create `src/lib/admin/normalize-admin-display-name.ts`:

```ts
const MIN_LEN = 1;
const MAX_LEN = 120;

export type NormalizeDisplayNameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function normalizeAdminDisplayName(raw: string): NormalizeDisplayNameResult {
  const value = raw.trim();
  if (value.length < MIN_LEN) {
    return { ok: false, message: "Nama wajib diisi." };
  }
  if (value.length > MAX_LEN) {
    return {
      ok: false,
      message: `Nama paling banyak ${MAX_LEN} karakter.`,
    };
  }
  return { ok: true, value };
}
```

- [ ] **Step 4: Run tests — PASS**

Run:

```bash
pnpm vitest run src/lib/admin/normalize-admin-display-name.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/normalize-admin-display-name.ts src/lib/admin/normalize-admin-display-name.test.ts
git commit -m "feat(admin): validate display name for account settings"
```

---

### Task 3: Server action `updateAdminDisplayName`

**Files:**
- Create: `src/lib/actions/update-admin-display-name.ts`

- [ ] **Step 1: Implement action**

Create `src/lib/actions/update-admin-display-name.ts`:

```ts
"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { requireAdminSession } from "@/lib/auth/session";
import { fieldError, ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { normalizeAdminDisplayName } from "@/lib/admin/normalize-admin-display-name";

export async function updateAdminDisplayName(
  formData: FormData,
): Promise<ActionResult<void>> {
  await requireAdminSession();

  const raw = formData.get("name");
  const nameStr = typeof raw === "string" ? raw : "";

  const normalized = normalizeAdminDisplayName(nameStr);
  if (!normalized.ok) {
    return fieldError({ name: normalized.message });
  }

  try {
    await auth.api.updateUser({
      body: { name: normalized.value },
      headers: await headers(),
    });
  } catch (e) {
    console.error("[updateAdminDisplayName]", e);
    return rootError("Gagal memperbarui nama. Coba lagi atau hubungi operator.");
  }

  return ok(undefined);
}
```

- [ ] **Step 2: Typecheck / lint**

Run:

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Fix any type error on `auth.api.updateUser` (if the inferred `body` shape differs, adjust to match the installed `better-auth` types — `name` is the field on `User` in `prisma/schema.prisma`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/update-admin-display-name.ts
git commit -m "feat(admin): server action to update Better Auth display name"
```

---

### Task 4: Theme preference field + account page

**Files:**
- Create: `src/components/admin/theme-preference-field.tsx`
- Create: `src/components/admin/admin-account-page-client.tsx`
- Create: `src/app/admin/account/page.tsx`

- [ ] **Step 1: Theme field component**

Create `src/components/admin/theme-preference-field.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Ikuti sistem" },
] as const;

export function ThemePreferenceField() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  return (
    <div className="flex flex-col gap-2">
      <Label>Tampilan</Label>
      {!mounted ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : (
        <>
          <RadioGroup
            className="flex flex-col gap-2"
            value={current}
            onValueChange={(v) => {
              if (v === "light" || v === "dark" || v === "system") {
                setTheme(v);
              }
            }}
          >
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <RadioGroupItem value={o.value} id={`theme-${o.value}`} />
                <span>{o.label}</span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Aktif: {resolvedTheme === "dark" ? "gelap" : "terang"}
            {current === "system" ? " (mengikuti sistem)" : ""}
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Account page client (form + action)**

Create `src/components/admin/admin-account-page-client.tsx` (minimal pattern; adjust imports to match your `Button` / `Field` / `FormMessage` conventions if the project uses `Form` wrappers elsewhere):

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { updateAdminDisplayName } from "@/lib/actions/update-admin-display-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemePreferenceField } from "@/components/admin/theme-preference-field";

const schema = z.object({
  name: z.string().min(1, "Nama wajib diisi.").max(120, "Nama paling banyak 120 karakter."),
});

type FormValues = z.infer<typeof schema>;

export function AdminAccountPageClient({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initialName },
  });

  const rootErr = form.formState.errors.root?.message;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Akun</h1>
        <p className="text-sm text-muted-foreground">
          Nama tampilan dan tampilan antarmuka. Email diatur lewat autentikasi.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} readOnly className="bg-muted/50" />
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              form.clearErrors("root");
              const fd = new FormData();
              fd.set("name", values.name);
              const res = await updateAdminDisplayName(fd);
              if (!res.ok) {
                if (res.fieldErrors?.name) {
                  form.setError("name", { message: res.fieldErrors.name });
                }
                if (res.rootError) {
                  form.setError("root", { message: res.rootError });
                }
                return;
              }
              router.refresh();
            });
          })}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nama tampilan</Label>
            <Input id="name" {...form.register("name")} disabled={pending} aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name?.message ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          {rootErr ? <p className="text-sm text-destructive">{rootErr}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan nama"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <ThemePreferenceField />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: RSC page**

Create `src/app/admin/account/page.tsx`:

```tsx
import { requireAdminSession } from "@/lib/auth/session";
import { AdminAccountPageClient } from "@/components/admin/admin-account-page-client";

export default async function AdminAccountPage() {
  const session = await requireAdminSession();

  return (
    <main className="flex flex-1 flex-col">
      <AdminAccountPageClient
        initialName={session.user.name ?? ""}
        email={session.user.email ?? ""}
      />
    </main>
  );
}
```

- [ ] **Step 4: Manual check**

Run `pnpm dev`, sign in as admin, open `http://localhost:3000/admin/account` — form shows email read-only; changing **Tampilan** toggles `dark` class on `<html>`; saving name refreshes and persists after hard reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/theme-preference-field.tsx src/components/admin/admin-account-page-client.tsx src/app/admin/account/page.tsx
git commit -m "feat(admin): account page with display name + theme preference"
```

---

### Task 5: `AdminAccountMenu` + shell consolidation

**Files:**
- Create: `src/components/admin/admin-account-menu.tsx`
- Modify: `src/components/admin/admin-app-shell.tsx`

- [ ] **Step 1: Build menu**

Create `src/components/admin/admin-account-menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";

import { createAuthClient } from "better-auth/react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "lucide-react";

const authClient = createAuthClient();

type AdminAccountMenuProps = {
  userEmail: string | null;
  displayName?: string | null;
  triggerClassName?: string;
};

export function AdminAccountMenu({
  userEmail,
  displayName,
  triggerClassName,
}: AdminAccountMenuProps) {
  const [open, setOpen] = useState(false);

  const email = userEmail ?? "";
  const label = displayName?.trim() || email || "Akun";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Menu akun"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-sidebar-border px-2 py-1.5 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:border-transparent lg:px-0 lg:py-1",
          triggerClassName,
        )}
        render={
          <Button
            variant="outline"
            className="min-h-0 w-full shrink justify-between border-transparent bg-transparent px-1 py-2 text-left shadow-none lg:px-0"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="block truncate text-sm font-medium leading-tight">{label}</span>
          {email ? (
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          ) : null}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-70" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start" side="bottom">
        <PopoverHeader>
          <PopoverTitle className="truncate">{label}</PopoverTitle>
          {email ? (
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          ) : null}
        </PopoverHeader>
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <Link
            href="/admin/account"
            className="flex h-9 items-center rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            onClick={() => setOpen(false)}
          >
            Kelola akun…
          </Link>
          <Button
            variant="ghost"
            className="justify-start text-destructive hover:text-destructive"
            type="button"
            onClick={async () => {
              setOpen(false);
              await authClient.signOut();
              window.location.href = "/admin/sign-in";
            }}
          >
            Keluar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Note:** If `Button` + `render={<Link />}` chaining fails TypeScript or runtime in your wrapper, flatten to **`Link`** styled as ghost button (`className` + **`onClick={() => setOpen(false)}`**) instead of `render` prop.

- [ ] **Step 2: Integrate shell**

Edit `src/components/admin/admin-app-shell.tsx`:

1. Replace the **`userEmail`** plain `<p>...</p>` block in the sidebar (and analogous block in mobile sheet header if present) with **`<AdminAccountMenu userEmail={userEmail} displayName={/* pass from props */} />`**.
2. Extend **`AdminAppShell` props** to accept optional **`displayName: string | null`** from **`layout.tsx`** (see Step 3).
3. Remove **`AdminSignOutForm`** from sidebar bottom **and** from mobile sheet footer (avoid two Keluar). Ensure mobile users can still Keluar via **popover** opened from header: if popover trigger currently only appears in sidebar, **also render** **`AdminAccountMenu`** in **`lg:hidden`** **header strip** beside the email line (reuse same `userEmail` / `displayName` props).

Prop plumbing in `src/app/admin/layout.tsx` — after `const navFlags = ...`:

```tsx
  return (
    <AdminAppShell
      navFlags={navFlags}
      userEmail={session.user.email ?? null}
      displayName={session.user.name ?? null}
    >
      {children}
    </AdminAppShell>
  );
```

- [ ] **Step 3: Manual responsive check**

Desktop: Popover Keluar works. Mobile: open header menu strip popover (?), confirm Keluar and Kelola akun. No orphaned sign-out.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/admin-account-menu.tsx src/components/admin/admin-app-shell.tsx src/app/admin/layout.tsx
git commit -m "feat(admin): account popover menu and centralized sign-out"
```

---

### Task 6: Committee settings placeholder shell

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Replace page body**

Rewrite `src/app/admin/settings/page.tsx` to **keep Owner guard unchanged**, rename component to **`AdminCommitteeSettingsPage`**, replace inner content with four sections (titles + explanatory paragraph + dashed inner box each). Example structure:

```tsx
import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="border-t px-6 py-8">
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Modul ini menyusul — belum ada penyimpanan data.
        </div>
      </div>
    </Card>
  );
}

export default async function AdminCommitteeSettingsPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);

  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-sm text-muted-foreground">
          Konfigurasi lanjutan klub — PIC, rekening bank, default harga, dan template WhatsApp.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <PlaceholderPanel
          title="PIC & admin aplikasi"
          description="Mengatur siapa menjadi PIC utama, pembantu, serta hak akses admin terkait acara dan verifikasi."
        />
        <PlaceholderPanel
          title="Rekening bank & PIC"
          description="Rekening transfer yang digunakan per PIC untuk bukti pembayaran dan penugasan kartu pembayaran."
        />
        <PlaceholderPanel
          title="Harga default global"
          description="Tarif acara baru yang diusulkan sebagai nilai awal sebelum dikustom per acara."
        />
        <PlaceholderPanel
          title="Template WhatsApp"
          description="Template pesan sistem untuk menyetujui, menolak, masalah pembayaran, dan notifikasi terkait."
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "feat(admin): committee settings section placeholders"
```

---

### Task 7: Verification gate (automated + manual)

**Files:** (none unless fixing lint)

- [ ] **Step 1: Tests**

Run:

```bash
pnpm test
pnpm vitest run src/lib/admin/normalize-admin-display-name.test.ts
```

Expected: all pass.

- [ ] **Step 2: Lint + typecheck**

Run:

```bash
pnpm lint
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Production build smoke**

Run:

```bash
pnpm build
```

Expected: succeeds (DB migrations script may run — needs env consistent with CI).

- [ ] **Step 4: Manual QA checklist**

1. Visitor `/` → toggle theme on `/admin/account` → revisit `/` — **theme persists**.  
2. Admin **Kelola akun** from popover → edit name → refresh → Better Auth **`User.name`** updated (check prisma studio or reload session).  
3. **Owner** `/admin/settings` shows **four** cards; **Admin** `/admin/settings` → **404**.

- [ ] **Step 5: Final commit only if fixes needed**

```bash
git add -u
git commit -m "chore(admin): tighten account/theme/settings QA fixes"
```

---

## Plan self-review (spec coverage)

| Spec section | Tasks |
|----------------|-------|
| §2.1 Dropdown + Kelola akun + Keluar | Task 5 |
| §2.1 `/admin/account` form + email read-only + theme tri-state | Tasks 4, 1 |
| §2.1 Root theme covers whole app | Task 1 |
| §2.1 `/admin/settings` Owner + four placeholders, no mutations | Task 6 |
| §4.2 `User.name` + server action | Tasks 2–3 |
| §6 ActionResult + Indonesian errors | Tasks 3–4 |
| §7 Vitest for normalized name | Task 2 |

**Placeholder scan:** No `TBD` / vague “handle errors” steps — failures map to **`rootError`** / **`fieldError`**.

**Type consistency:** `normalizeAdminDisplayName` result shape reused in Task 3; form default `initialName` matches `session.user.name ?? ""`.

**Gap:** Better Auth **`updateUser`** — if **`body: { name }`** rejected by types/runtime, align with inferred types (`pnpm exec tsc`); Plan B (**`AdminProfile.displayName`**) stays **explicitly out** unless unblock needed (per spec §4.3).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-02-admin-account-theme-committee-shell.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task; review between tasks; fast iteration. **REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`.

2. **Inline execution** — run tasks sequentially in this session with checkpoints. **REQUIRED SUB-SKILL:** `superpowers:executing-plans`.

Which approach?
