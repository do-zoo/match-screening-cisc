# Admin Settings Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi **hub** `/admin/settings` yang bertaut ke **sub-path** resmi, `**/admin/settings/pricing`** dengan persistensi Postgres untuk default tiket komite (Owner-only), refactor pembacaan `global_default` ke **DB → env → fallback numerik**, halaman `**/admin/settings/committee`** yang menjelaskan **anggota adalah sumber kebenaran** untuk PIC/`canBePIC`/rekening, ringkasan baca-only admin aplikasi — plus **landing placeholder** bergaya konsisten untuk rute masa depan (WA, branding, notifikasi, operasi, keamanan).

**Architecture:** Model singleton Prisma `**CommitteeTicketDefaults`** satu baris `@id` tetap membungkus harga integer IDR (selaras penyimpanan monetari di codebase). Helpers di `event-admin-defaults` mem-extract **pemilihan sumber nilai** (fungsi murni + `resolveCommitteeTicketDefaults(prisma)` async). Mutasi hanya `**guardOwner`** + `ActionResult`. Sub-nav bersama `**layout.tsx**` daftar tautan canonik sesuai [spec §4](../specs/2026-05-02-admin-settings-modules-design.md). Rute kosong sisanya kartu dashed Indonesia.

**Tech Stack:** Next.js App Router (`src/app/admin/settings/`*), React Server Components, Server Actions `"use server"`, Prisma + migrasi Postgres, Vitest (`pnpm vitest run`), pola `guard`/`ActionResult`/Zod sama seperti admin lain.

---

## Scope split (penting bagi implementor)

Ini melaksanakan **[spec Phase A §7](../specs/2026-05-02-admin-settings-modules-design.md)** saja persis secara fungsional. **Phase B (WA + branding), C (operations flags), D (notifikasi + security audit)** menghasilkan artefak bermigrasi/sendiri dan **belum** mempunyai task konkret di sini — setelah Phase A meng-merge, jalankan lagi skill writing-plans untuk file rencana berikutnya dengan tanggal baru.

---

## File map — penciptaan & tanggung jawab


| File                                                      | Tanggung jawab                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                                    | Model `CommitteeTicketDefaults` satu baris (singleton key).                                                                                       |
| `prisma/migrations/*/`                                    | Migrasi DDL (hasil `pnpm prisma migrate dev`).                                                                                                    |
| `src/lib/events/event-admin-defaults.ts`                  | Fallback env+konsisten (`getCommitteeTicketDefaultsFromEnvOnly`), pemilih murni `pickCommitteeTicketDefaults(row)`, resolver async dengan Prisma. |
| `src/lib/events/event-admin-defaults.test.ts`             | Tes perilaku fallback env + tes pemilih baris-vs-env.                                                                                             |
| `src/lib/actions/admin-events.ts`                         | Ganti pemanggilan agar pakai resolver async ketika tulis tiket untuk `pricingSource===global_default`.                                            |
| `src/app/admin/events/new/page.tsx`, `edit/page.tsx`      | `await` resolver untuk nilai seed form.                                                                                                           |
| `src/lib/forms/committee-default-pricing-schema.ts`       | Zod schema numerik dua field.                                                                                                                     |
| `src/lib/actions/admin-committee-pricing.ts`              | `saveCommitteeDefaultTicketPrices(prev, FormData)`.                                                                                               |
| `src/components/admin/committee-default-pricing-form.tsx` | Form klien sederhana (dua bilangan bulat).                                                                                                        |
| `src/app/admin/settings/layout.tsx`                       | Sub-nav tautan canonik (+ responsif horizontal kecil).                                                                                            |
| `src/app/admin/settings/page.tsx`                         | Hub: judul ringkas + daftar tautan/modul mengganti placeholder besar.                                                                             |
| `src/app/admin/settings/pricing/page.tsx`                 | RSC: prefetch nilai terselesaikan + `<CommitteeDefaultPricingForm initial=… />`.                                                                  |
| `src/app/admin/settings/committee/page.tsx`               | RSC: penyalinan kebijakan sumber-kebenaran + tabel ringkas admin dari `AdminProfile`+`User`.                                                      |
| `src/app/admin/settings/whatsapp-templates/page.tsx`      | Kartu dashed placeholder (roadmap Phase B).                                                                                                       |
| `src/app/admin/settings/branding/page.tsx`                | Idem placeholder.                                                                                                                                 |
| `src/app/admin/settings/notifications/page.tsx`           | Idem placeholder.                                                                                                                                 |
| `src/app/admin/settings/operations/page.tsx`              | Idem placeholder.                                                                                                                                 |
| `src/app/admin/settings/security/page.tsx`                | Idem placeholder.                                                                                                                                 |
| `src/components/admin/forms/event-admin-form.tsx`         | Revisi teks bantuan baris akhir blok harga untuk menyebut **Pengaturan › Harga** + env fallback.                                                  |


---

### Task 1: Model Prisma singleton + migrasi

**Files:**

- Modify: `prisma/schema.prisma`
- Create: migrasi DDL lewat CLI (nama folder otomatis)
- Modify: tidak ada sampai prisma generate otomatis

Sisipkan **tepat sebelum** `model AdminProfile` blok berikut:

```prisma
/// Singleton key "default". Urutan pembaca nilai aplikasi: baris ada → pakai kolom ini; lainnya → env/constants (lihat `event-admin-defaults`).
model CommitteeTicketDefaults {
  singletonKey           String @id
  ticketMemberPrice      Int
  ticketNonMemberPrice   Int
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

- **Step 1: Edit schema** — tempel model di atas; pastikan tidak menduplikasi nama model.
- **Step 2: Jalankan migrasi development**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name committee_ticket_defaults_singleton
```

Expected: migrasi sukses, client ter-generate.

- **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): CommitteeTicketDefaults singleton for global ticket pricing"
```

---

### Task 2: Helper murni + resolver async (TDD)

**Files:**

- Modify: `src/lib/events/event-admin-defaults.ts`
- Modify: `src/lib/events/event-admin-defaults.test.ts`

Rombak `event-admin-defaults.ts` menjadi isi penuh berikut (ganti file — **`import type` pertama baris**, lalu sisanya):

```typescript
import type { PrismaClient } from "@prisma/client";

function parseIdr(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export const COMMITTEE_TICKET_FALLBACK_MEMBER_IDR = 125_000;
export const COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR = 175_000;

export type CommitteeTicketDefaultPrices = {
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
};

/** Nilai dari env `MATCH_DEFAULT_TICKET_`* lalu fallback numerik seed. */
export function getCommitteeTicketDefaultsFromEnvOnly(): CommitteeTicketDefaultPrices {
  return {
    ticketMemberPrice: parseIdr(
      process.env.MATCH_DEFAULT_TICKET_MEMBER_IDR,
      COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
    ),
    ticketNonMemberPrice: parseIdr(
      process.env.MATCH_DEFAULT_TICKET_NON_MEMBER_IDR,
      COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    ),
  };
}

/**
 * Spesifikasi produk: baris DB menang penuh bila tidak null; jika belum ada baris, gunakan env+fallback.
 */
export function pickCommitteeTicketDefaults(
  row: CommitteeTicketDefaultPrices | null,
): CommitteeTicketDefaultPrices {
  if (row != null) return row;
  return getCommitteeTicketDefaultsFromEnvOnly();
}

const COMMITTEE_TICKET_DEFAULTS_KEY = "default" as const;

export async function resolveCommitteeTicketDefaults(
  db: Pick<PrismaClient, "committeeTicketDefaults">,
): Promise<CommitteeTicketDefaultPrices> {
  const row = await db.committeeTicketDefaults.findUnique({
    where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
    select: { ticketMemberPrice: true, ticketNonMemberPrice: true },
  });
  return pickCommitteeTicketDefaults(row);
}

export { COMMITTEE_TICKET_DEFAULTS_KEY };
```

- **Step 1: Tulis pengujian untuk `pickCommitteeTicketDefaults` + env-only** — ganti `event-admin-defaults.test.ts` dengan:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
  COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
  getCommitteeTicketDefaultsFromEnvOnly,
  pickCommitteeTicketDefaults,
} from "@/lib/events/event-admin-defaults";

describe("getCommitteeTicketDefaultsFromEnvOnly", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses numeric fallbacks when env missing", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(getCommitteeTicketDefaultsFromEnvOnly()).toEqual({
      ticketMemberPrice: COMMITTEE_TICKET_FALLBACK_MEMBER_IDR,
      ticketNonMemberPrice: COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    });
  });

  it("parses env overrides", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "90000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "99000");
    expect(getCommitteeTicketDefaultsFromEnvOnly()).toEqual({
      ticketMemberPrice: 90_000,
      ticketNonMemberPrice: 99_000,
    });
  });
});

describe("pickCommitteeTicketDefaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers DB row when present", () => {
    expect(
      pickCommitteeTicketDefaults({
        ticketMemberPrice: 1,
        ticketNonMemberPrice: 2,
      }),
    ).toEqual({ ticketMemberPrice: 1, ticketNonMemberPrice: 2 });
  });

  it("falls back to env ladder when row null", () => {
    vi.stubEnv("MATCH_DEFAULT_TICKET_MEMBER_IDR", "80000");
    vi.stubEnv("MATCH_DEFAULT_TICKET_NON_MEMBER_IDR", "");
    expect(pickCommitteeTicketDefaults(null)).toEqual({
      ticketMemberPrice: 80_000,
      ticketNonMemberPrice: COMMITTEE_TICKET_FALLBACK_NON_MEMBER_IDR,
    });
  });
});
```

- **Step 2: Jalankan tes — harus gagal** (resolver belum di-impor di situs lain; hanya file ini)

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm vitest run src/lib/events/event-admin-defaults.test.ts
```

Expected: failures jika file produksi belum di-update; setelah update produksi, expected: **PASS**.

- **Step 3: Tempel `event-admin-defaults.ts` dari Step definisi** lalu ulangi vitest — **PASS**.
- **Step 4: Commit**

```bash
git add src/lib/events/event-admin-defaults.ts src/lib/events/event-admin-defaults.test.ts
git commit -m "refactor(pricing): resolve committee defaults with DB/env priority"
```

---

### Task 3: Sambungkan resolver ke alur acara

**Files:**

- Modify: `src/lib/actions/admin-events.ts`
- Modify: `src/app/admin/events/new/page.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`
- **Step 1: `admin-events.ts`** — ganti impor `getCommitteeTicketDefaults` dengan `resolveCommitteeTicketDefaults`. Di dalam `ticketPricesForWrite`, fungsi harus `async` atau panggil resolver sebelum `ticketPricesForWrite`. Cara paling kecil: jadikan `ticketPricesForWrite` async:

```typescript
async function ticketPricesForWrite(opts: {
  pricingSource: AdminEventUpsertInput["pricingSource"];
  parsedMember: number;
  parsedNonMember: number;
}): Promise<{ ticketMemberPrice: number; ticketNonMemberPrice: number }> {
  if (opts.pricingSource === "global_default") {
    const d = await resolveCommitteeTicketDefaults(prisma);
    return {
      ticketMemberPrice: d.ticketMemberPrice,
      ticketNonMemberPrice: d.ticketNonMemberPrice,
    };
  }
  return {
    ticketMemberPrice: opts.parsedMember,
    ticketNonMemberPrice: opts.parsedNonMember,
  };
}
```

Lalu di `createAdminEvent` / `updateAdminEvent` di titik yang memanggil `ticketPricesForWrite`, **await** hasilnya (ganti variabel `prices` assignment).

- **Step 2: `new/page.tsx`** — ganti:

```typescript
const committeeDefaults = getCommitteeTicketDefaults();
```

menjadi:

```typescript
const committeeDefaults = await resolveCommitteeTicketDefaults(prisma);
```

tambahkan `import { prisma } from "@/lib/db/prisma";` jika belum ada; impor `resolveCommitteeTicketDefaults`.

- **Step 3: `edit/page.tsx`** — identik await + impor.
- **Step 4: Jalankan tes unit yang relevan**

```bash
pnpm vitest run src/lib/events/event-admin-defaults.test.ts
pnpm vitest run src/lib/events/event-edit-guards.test.ts
```

Expected: semua PASS (jika `event-edit-guards` tidak memanggil async path, tetap OK).

- **Step 5: `pnpm lint`**

```bash
pnpm lint
```

- **Step 6: Commit**

```bash
git add src/lib/actions/admin-events.ts src/app/admin/events/new/page.tsx src/app/admin/events/[eventId]/edit/page.tsx
git commit -m "feat(events): read global_default prices via DB-aware resolver"
```

---

### Task 4: Zod + Server Action simpan harga default

**Files:**

- Create: `src/lib/forms/committee-default-pricing-schema.ts`
- Create: `src/lib/actions/admin-committee-pricing.ts`

**Isi `committee-default-pricing-schema.ts`:**

```typescript
import { z } from "zod";

export const committeeDefaultPricingFormSchema = z.object({
  ticketMemberPrice: z.coerce.number().int().min(0),
  ticketNonMemberPrice: z.coerce.number().int().min(0),
});

export type CommitteeDefaultPricingFormInput = z.infer<
  typeof committeeDefaultPricingFormSchema
>;
```

**Isi `admin-committee-pricing.ts`:**

```typescript
"use server";

import { revalidatePath } from "next/cache";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { committeeDefaultPricingFormSchema } from "@/lib/forms/committee-default-pricing-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { zodToFieldErrors } from "@/lib/forms/zod";
import { prisma } from "@/lib/db/prisma";
import { COMMITTEE_TICKET_DEFAULTS_KEY } from "@/lib/events/event-admin-defaults";

export async function saveCommitteeDefaultTicketPrices(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const raw = {
    ticketMemberPrice: formData.get("ticketMemberPrice"),
    ticketNonMemberPrice: formData.get("ticketNonMemberPrice"),
  };

  const parsed = committeeDefaultPricingFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error) };
  }

  const { ticketMemberPrice, ticketNonMemberPrice } = parsed.data;

  try {
    await prisma.committeeTicketDefaults.upsert({
      where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
      create: {
        singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY,
        ticketMemberPrice,
        ticketNonMemberPrice,
      },
      update: { ticketMemberPrice, ticketNonMemberPrice },
    });
  } catch {
    return rootError("Tidak dapat menyimpan pengaturan. Coba lagi.");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/settings/pricing");
  return ok({ saved: true });
}
```

**Tes pola guard** — tidak ada unit test yang mem mocking guard untuk action ini dalam Phase A (YAGNI). Verifikasi manual.

- **Step 1: Buat dua file tersebut**
- **Step 2: `pnpm lint`**
- **Step 3: Commit**

```bash
git add src/lib/forms/committee-default-pricing-schema.ts src/lib/actions/admin-committee-pricing.ts
git commit -m "feat(settings): Owner server action persist committee ticket defaults"
```

---

### Task 5: Form klien + halaman `pricing`

**Files:**

- Create: `src/components/admin/committee-default-pricing-form.tsx`
- Create: `src/app/admin/settings/pricing/page.tsx`
- Modify: `src/components/admin/forms/event-admin-form.tsx`

**Isi `committee-default-pricing-form.tsx`:**

```tsx
"use client";

import { useActionState } from "react";

import {
  committeeDefaultPricingFormSchema,
  type CommitteeDefaultPricingFormInput,
} from "@/lib/forms/committee-default-pricing-schema";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { CommitteeTicketDefaultPrices } from "@/lib/events/event-admin-defaults";
import { saveCommitteeDefaultTicketPrices } from "@/lib/actions/admin-committee-pricing";
import type { ActionResult } from "@/lib/forms/action-result";

export function CommitteeDefaultPricingForm(props: {
  initial: CommitteeTicketDefaultPrices & { persisted: boolean };
}) {
  type State =
    | null
    | ActionResult<{ saved: true }>
    | { ok?: false };

  const [state, dispatch, pending] = useActionState(saveCommitteeDefaultTicketPrices, null);

  const fv = committeeDefaultPricingFormSchema.safeParse({
    ticketMemberPrice: props.initial.ticketMemberPrice,
    ticketNonMemberPrice: props.initial.ticketNonMemberPrice,
  });

  const defaultValues = (fv.success
    ? fv.data
    : {
        ticketMemberPrice: props.initial.ticketMemberPrice,
        ticketNonMemberPrice: props.initial.ticketNonMemberPrice,
      }) satisfies CommitteeDefaultPricingFormInput;

  return (
    <form action={dispatch} className="max-w-md space-y-4">
      {state?.ok === false && state.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok === false && state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertTitle>Periksa isian</AlertTitle>
          <AlertDescription>
            {JSON.stringify(state.fieldErrors, null, 2)}
          </AlertDescription>
        </Alert>
      ) : null}
      <Field label="Tiket member (IDR)">
        <Input
          name="ticketMemberPrice"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaultValues.ticketMemberPrice}
          disabled={pending}
        />
      </Field>
      <Field label="Tiket non-member (IDR)">
        <Input
          name="ticketNonMemberPrice"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={defaultValues.ticketNonMemberPrice}
          disabled={pending}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Menyimpan…
          </>
        ) : (
          "Simpan"
        )}
      </Button>
      {props.initial.persisted ? (
        <p className="text-muted-foreground text-xs">
          Nilai tersimpan di basis data. Jika dihapus manual lewat SQL, nilai akan jatuh ke env
          lalu ke fallback bawaan aplikasi (lihat `MATCH_DEFAULT_TICKET_*_IDR`).
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Belum ada baris penyimpanan: tampilan saat ini memakai env / fallback sampai Anda
          menyimpan sekali di sini.
        </p>
      )}
      {state?.ok === true ? (
        <p className="text-sm text-emerald-600">Tersimpan.</p>
      ) : null}
    </form>
  );
}
```

**Catatan kemungkinan mismatch:** Sesuaikan impor `**Field`** jika codebase memakai `FormField`/label lain — penyamakan dengan formulir admin terdekat (misal `registration` admin). Selaraskan dengan pola import yang ada; jika `**Field**` tidak ada, gunakan blok:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium" htmlFor="ticketMemberPrice">…</label>
  <Input id="ticketMemberPrice" … />
</div>
```

Gunakan apa yang ada di repo setelah Anda baca salah satu formulir aktif — **jangan** meninggalkan impor salah (`Field` ada di `@/components/ui/field`; jika struktur komponen beda, selaraskan seperti form admin lain).

**Isi `src/app/admin/settings/pricing/page.tsx`:**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommitteeDefaultPricingForm } from "@/components/admin/committee-default-pricing-form";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";
import {
  COMMITTEE_TICKET_DEFAULTS_KEY,
  pickCommitteeTicketDefaults,
} from "@/lib/events/event-admin-defaults";

export default async function CommitteePricingSettingsPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) notFound();

  const row = await prisma.committeeTicketDefaults.findUnique({
    where: { singletonKey: COMMITTEE_TICKET_DEFAULTS_KEY },
    select: { ticketMemberPrice: true, ticketNonMemberPrice: true },
  });
  const display = pickCommitteeTicketDefaults(row);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Harga default</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Harga default global</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Dipakai saat acara baru memilih sumber harga "Default komite" (
          <code>global_default</code>).
        </p>
      </div>
      <CommitteeDefaultPricingForm
        initial={{ ...display, persisted: row != null }}
      />
    </div>
  );
}
```

- **Step 1: Implementasikan form + page; perbaiki impor `Field`/`Alert` agar sesuai repo**
- **Step 2: Sunting `event-admin-form.tsx`** paragraf bantuan (sekitar baris 399–402) menjadi:

```tsx
          <p className="text-muted-foreground text-xs">
            Jika memilih default komite, nilai disimpan dari{" "}
            <strong>Pengaturan → Harga default</strong> (basis data bila sudah pernah disimpan),
            lalu env <code>MATCH_DEFAULT_TICKET_*_IDR</code>, lalu fallback bawaan aplikasi.
          </p>
```

- **Step 3: `pnpm lint`**
- **Step 4: Commit**

```bash
git add src/components/admin/committee-default-pricing-form.tsx src/app/admin/settings/pricing/page.tsx src/components/admin/forms/event-admin-form.tsx
git commit -m "feat(settings): pricing sub-path with Owner form"
```

---

### Task 6: Layout sub-nav + hub

**Files:**

- Create: `src/components/admin/committee-settings-subnav.tsx` (komponen klien aktif-nonaktif)
- Create: `src/app/admin/settings/layout.tsx`
- Modify: `src/app/admin/settings/page.tsx`

**Buat dahulu `committee-settings-subnav.tsx`:**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const COMMITTEE_SETTINGS_NAV = [
  { href: "/admin/settings", label: "Ringkasan" },
  { href: "/admin/settings/committee", label: "Komite & admin" },
  { href: "/admin/settings/pricing", label: "Harga default" },
  { href: "/admin/settings/whatsapp-templates", label: "Template WhatsApp" },
  { href: "/admin/settings/branding", label: "Branding" },
  { href: "/admin/settings/notifications", label: "Notifikasi" },
  { href: "/admin/settings/operations", label: "Operasional" },
  { href: "/admin/settings/security", label: "Keamanan" },
] as const;

export function CommitteeSettingsSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Submenu pengaturan" className="flex flex-col gap-1">
      {COMMITTEE_SETTINGS_NAV.map((item) => {
        const active =
          item.href === "/admin/settings"
            ? pathname === "/admin/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "" : undefined}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**Isi `layout.tsx`:**

```tsx
import { notFound } from "next/navigation";

import { CommitteeSettingsSubnav } from "@/components/admin/committee-settings-subnav";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8 lg:flex-row lg:py-10">
      <aside className="lg:w-56 lg:shrink-0">
        <CommitteeSettingsSubnav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </main>
  );
}
```

**Ganti `page.tsx` hub** — singkat, tanpa duplikasi guard (layout sudah). Contoh:

```tsx
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminSettingsHubPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan komite</h1>
        <p className="text-muted-foreground text-sm">
          Konfigurasi lanjutan klub — hanya Owner. Pilih modul di sidebar atau kartu di bawah.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsCard
          href="/admin/settings/committee"
          title="Komite & admin"
          description="PIC, peran admin aplikasi, tautan ke master anggota untuk rekening bank."
        />
        <SettingsCard
          href="/admin/settings/pricing"
          title="Harga default"
          description="Nilai awal tiket saat acara memakai default komite."
        />
        <SettingsCard
          href="/admin/settings/whatsapp-templates"
          title="Template WhatsApp"
          description="Menyusul — placeholder konten Phase B."
        />
        <SettingsCard
          href="/admin/settings/branding"
          title="Branding"
          description="Menyusul — logo & teks publik Phase B."
        />
        <SettingsCard
          href="/admin/settings/notifications"
          title="Notifikasi"
          description="Menyusul — saluran & preferensi Phase D."
        />
        <SettingsCard
          href="/admin/settings/operations"
          title="Operasional"
          description="Menyusul — feature flags Phase C."
        />
        <SettingsCard
          href="/admin/settings/security"
          title="Keamanan"
          description="Menyusul — kebijakan auth & audit Phase D."
        />
      </div>
    </div>
  );
}

function SettingsCard(props: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={props.href}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="text-base">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
```

Hapus `requireAdminSession` dari `page.tsx` lama karena layout menangani.

- **Step 1: Tambah `committee-settings-subnav.tsx` + `layout.tsx` + ganti `page.tsx`**
- **Step 2: `pnpm lint`**
- **Step 3: Commit**

```bash
git add src/app/admin/settings/layout.tsx src/app/admin/settings/page.tsx src/components/admin/committee-settings-subnav.tsx
git commit -m "feat(settings): hub layout with sub-navigation"
```

---

### Task 7: Halaman `committee` + ringkasan admin

**Files:**

- Create: `src/app/admin/settings/committee/page.tsx`

```tsx
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageCommitteeAdvancedSettings } from "@/lib/permissions/roles";
import { notFound } from "next/navigation";

const roleLabels: Record<string, string> = {
  Owner: "Owner",
  Admin: "Admin",
  Verifier: "Verifier",
  Viewer: "Viewer",
};

export default async function CommitteeSettingsPage() {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canManageCommitteeAdvancedSettings(ctx.role)) notFound();

  const profiles = await prisma.adminProfile.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authUserId: true,
      role: true,
      member: {
        select: { memberNumber: true, fullName: true },
      },
    },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.authUserId) } },
    select: { id: true, email: true, name: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-muted-foreground text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Pengaturan
          </Link>
          {" / "}
          <span>Komite & admin</span>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Komite & admin aplikasi</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          <strong>Sumber kebenaran tunggal</strong> untuk mengatur siapa boleh menjadi PIC (
          <code>canBePIC</code>), rekening bank PIC, dan data master anggota lainnya adalah halaman{" "}
          <Link href="/admin/members" className="font-medium text-foreground underline">
            Anggota
          </Link>
          . Halaman ini memberi konteks dan ringkasan admin tanpa menduplikasi formulir rekening.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Admin terdaftar</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Member terkait</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Belum ada AdminProfile.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((p) => {
                  const u = userById.get(p.authUserId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">
                        {u?.email ?? p.authUserId}
                      </TableCell>
                      <TableCell>{u?.name ?? "—"}</TableCell>
                      <TableCell>{roleLabels[p.role] ?? p.role}</TableCell>
                      <TableCell>
                        {p.member
                          ? `${p.member.memberNumber} — ${p.member.fullName}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground text-xs">
          Menambah atau mengubah peran admin tetap memakai skrip / alur yang sudah dipakai tim (
          <code>pnpm bootstrap:admin</code>
          ) hingga modul pengelolaan admin interaktif hadir.
        </p>
      </section>
    </div>
  );
}
```

- **Step 1: Tambah file; pastikan komponen `Table` ada di `src/components/ui/table.tsx` (shadcn)**
- **Step 2: `pnpm lint`**
- **Step 3: Commit**

```bash
git add src/app/admin/settings/committee/page.tsx
git commit -m "feat(settings): committee sub-path with admin summary"
```

---

### Task 8: Placeholder sub-path Phase B+

**Files:**

- Create: `src/app/admin/settings/whatsapp-templates/page.tsx`
- Create: `src/app/admin/settings/branding/page.tsx`
- Create: `src/app/admin/settings/notifications/page.tsx`
- Create: `src/app/admin/settings/operations/page.tsx`
- Create: `src/app/admin/settings/security/page.tsx`
- Create: `src/components/admin/committee-settings-placeholder.tsx` (DRY)

**Isi `committee-settings-placeholder.tsx`:**

```tsx
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CommitteeSettingsPlaceholder(props: {
  title: string;
  description: string;
  phaseNote: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        <Link href="/admin/settings" className="underline underline-offset-4">
          Pengaturan
        </Link>
        {" / "}
        <span>{props.title}</span>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
      <p className="text-muted-foreground text-sm">{props.description}</p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Menyusul</CardTitle>
          <CardDescription>{props.phaseNote}</CardDescription>
        </CardHeader>
        <div className="border-t px-6 py-8">
          <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Modul ini menyusul — belum ada penyimpanan data pada fase ini.
          </div>
        </div>
      </Card>
    </div>
  );
}
```

Setiap `page.tsx` contoh `whatsapp-templates/page.tsx`:

```tsx
import { CommitteeSettingsPlaceholder } from "@/components/admin/committee-settings-placeholder";

export default function WhatsappTemplatesSettingsPage() {
  return (
    <CommitteeSettingsPlaceholder
      title="Template WhatsApp"
      description="Edit template pesan persetujuan, penolakan, dan alur registrasi."
      phaseNote="Direncanakan pada Phase B (lihat spec §7)."
    />
  );
}
```

Ulangi teks yang sesuai untuk branding, notifications, operations, security menurut spec §5.2–§5.5.

- **Step 1: Tambah komponen + lima halaman**
- **Step 2: `pnpm lint`**
- **Step 3: Commit**

```bash
git add src/components/admin/committee-settings-placeholder.tsx src/app/admin/settings/whatsapp-templates/page.tsx src/app/admin/settings/branding/page.tsx src/app/admin/settings/notifications/page.tsx src/app/admin/settings/operations/page.tsx src/app/admin/settings/security/page.tsx
git commit -m "chore(settings): Phase B+ placeholder sub-paths"
```

---

### Task 9: Verifikasi akhir

- **Step 1: Jalankan seluruh Vitest**

```bash
pnpm test
```

Expected: exit 0.

- **Step 2: `pnpm build`** (wajib sebelum klaim merge karena mencakup `prisma generate`)

```bash
pnpm build
```

Expected: sukses.

- **Step 3: Commit** hanya jika ada perbaikan otomatis — jika tidak ada diff, lewati.

---

## Self-review (checklist penulis rencana)

1. **Spec coverage:** Hub + sub-path §4 ✓ · DB→env ladder §6 ✓ · committee sumber tunggal anggota §5.1 ✓ · Owner-only ✓ melalui `canManageCommitteeAdvancedSettings` + `guardOwner` pada mutasi ✓ · placeholder Phase B–D ✓. **Audit / notifikasi / flags / WA isi sesungguhnya / branding upload** → tugas masa depan (Phase B–D, dokumen terpisah).
2. **Placeholder scan:** tidak ada `TODO` kosong atau frasa "implement later" di task. Catatan eksplisit diserahkan kepada rencana berikutnya dalam bagian Scope split.
3. **Consistency:** `singletonKey "default"` di Prisma sama dengan konstant `COMMITTEE_TICKET_DEFAULTS_KEY`; `pick` vs `resolve` dipakai konsisten (form tampil `pick` pada baris DB bila ada). **Perbaikan:** Di Task 5 page pricing, `resolved` unused — hapus variabel `resolved` atau gunakan; implementor harus **hapus** assignment `const resolved = await …` jika tidak terpakai agar lint bersih.

---

## Execution handoff

**Rencana tersimpan di `docs/superpowers/plans/2026-05-02-admin-settings-phase-a.md`. Dua opsi eksekusi:**

**1. Subagent-Driven (disarankan)** — agen baru per task, review antar task, iterasi cepat.

**2. Inline Execution** — jalankan task dalam sesi yang sama memakai executing-plans dengan checkpoint review.

**Mau yang mana?**

Setelah Phase A selesai di git, buat rencana baru (tanggal baru) untuk **Phase B** menurut spec §7 dengan skill writing-plans yang sama.