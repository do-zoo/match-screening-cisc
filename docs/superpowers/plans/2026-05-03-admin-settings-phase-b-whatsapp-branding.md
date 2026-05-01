# Admin Settings Phase B — WhatsApp templates + branding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mem‑persistensi isi pesan WhatsApp yang dipakai tautan **`wa.me`** di admin (**`RegistrationDetail`**), dengan **fallback** ke **`src/lib/wa-templates/messages.ts`** bila baris DB kosong atau invalid; serta **branding publik** minim (judul header, opsional logo Blob WebP tetap seperti cover acara, teks footer polos) dibaca dari **singleton Postgres** dan ditampilkan di **`(public)`** layout.

**Architecture:** Tambah dua model relational Prisma: **`ClubWaTemplate`** (satu baris per jenis templat pesan dengan `WaTemplateKey` enum) dan **`ClubBranding`** singleton. Sisip middleware murni `applyWaPlaceholders`/`validateWaTemplateBody` (**placeholder** `{nama_token_snake_case}` satu baris dokumentasi konsisten dengan contoh defaults). Rendering pesan gabungan: **tubuh dari DB → substitusi nilai konteks**, jika gagal atau null → pemanggilan fungsi bawaan `messages.ts` tanpa menghapus file itu (selaras [spek §6](../specs/2026-05-02-admin-settings-modules-design.md)). Branding dibaca sekali‑per‑request publik dengan **`React.cache`** di helper server agar beberapa komponen RSC tidak menduplikasi query.

**Tech Stack:** Prisma Postgres, Next.js 16 App Router, Server Actions + `guardOwner`, Zod `^4`, Vercel Blob + Sharp WebP seperti `upload-event-cover.ts`, Vitest.

**Prerequisite:** Phase A tertanam (sub‑nav Pengaturan, pola `guardOwner`, pola singleton `singletonKey`). Rute **`/admin/settings/whatsapp-templates`** dan **`/admin/settings/branding`** saat ini placeholder — diganti menjadi UI nyata dalam rencana ini.

---

## File map — penciptaan & tanggung jawab

| File | Tanggung jawab |
|------|----------------|
| `prisma/schema.prisma` | Enum `WaTemplateKey`; model `ClubWaTemplate`; model `ClubBranding` singleton. |
| `prisma/migrations/**` | Migrasi DDL dari `pnpm prisma migrate dev`. |
| `src/lib/wa-templates/wa-placeholder.ts` | Regex substitusi + error kelas konsisten untuk token tak terisi / tak dikenal. |
| `src/lib/wa-templates/wa-placeholder.test.ts` | Tes pemetaan `{token}` ↔ string. |
| `src/lib/wa-templates/wa-template-policy.ts` | Map `WaTemplateKey` → kumpulan token yang **wajib** hadir dalam string simpanan. |
| `src/lib/wa-templates/wa-template-policy.test.ts` | Snapshot kebijakan (daftar token wajib). |
| `src/lib/wa-templates/db-default-template-bodies.ts` | Konstanta tubuh **default bertoken** untuk reset UI (sama semantik dengan keluaran TS hari ini). |
| `src/lib/wa-templates/render-wa-from-db.ts` | Fungsi gabungan **sinkron** per key `(body \| null, ctx…) => string` memanggil fallback `messages.ts` jika perlu. |
| `src/lib/wa-templates/load-club-wa-templates.ts` | Promise `Promise<Partial<Record<WaTemplateKey, string \| null>>>` satu query Prisma; dipakai page inbox + pengaturan. |
| `src/lib/forms/club-wa-template-schema.ts` | Zod: key + body `.min(1).max(4000)`. |
| `src/lib/actions/admin-club-wa-templates.ts` | `saveClubWaTemplate`, `resetClubWaTemplateToDefault` (**`guardOwner`**). |
| `src/app/admin/settings/whatsapp-templates/page.tsx` | RSC: ambil seluruh baris + kirim ke klien. |
| `src/components/admin/club-wa-templates-form.tsx` | `"use client"`: satu `<form>` atau dua per kartu untuk tiap **key**. |
| `src/components/admin/registration-detail.tsx` | Terima **`waBodies`** dari server; hapus pemanggilan langsung `messages.ts` untuk isi tautan WhatsApp utama. |
| `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` | `await loadClubWaTemplateBodies()`, pass ke **`RegistrationDetail`**. |
| `src/lib/uploads/upload-club-logo.ts` | **WebP** path deterministik **`site/logo.webp`**, pola mirip **`upload-event-cover.ts`**. |
| `src/lib/public/load-club-branding.ts` | `React.cache(async () => ...)` membaca **`ClubBranding`** + fallback string bila null. |
| `src/lib/forms/club-branding-schema.ts` | Zod nama singkat (`max(120)`), footer (`max(500)` optional kosong→null). |
| `src/lib/actions/admin-club-branding.ts` | Simpan teks + unggah logo (hapus Blob lama). |
| `src/app/admin/settings/branding/page.tsx` | Form teks + file input logo. |
| `src/components/public/public-header.tsx` | Ubah menjadi **komponen klien** ringan **tidak**: tetap Server Component — ubah menjadi **async RSC tidak didukung** untuk komponen impor eksplisit tanpa `'use async'` — oleh karena itu: **buat** `PublicHeader.tsx` menjadi SC yang menerima props `clubNameNav: string`, `logoUrl?: string \| null` dari **`(public)/layout.tsx`**. |
| `src/app/(public)/layout.tsx` | `await getClubBranding()` (`cache`) → `<PublicHeader .../>` dan `<PublicFooter strip/>` baru. |
| `src/components/public/public-footer.tsx` | Server component: cetak **`footerPlainText`** jika non‑kosong. |
| `src/app/admin/settings/page.tsx` | Ganti teaser “Menyusul” kartu WhatsApp dan Branding menjadi tautan hidup satu kalimat bahwa konfig aktif di sub‑halaman (**teks boleh singkat**, tanpa bahasa marketing). |

---

### Task 1: Skema Prisma + migrasi

**Files:**
- Modify: `prisma/schema.prisma`

Sisipkan **tepat setelah blok `CommitteeTicketDefaults` selesai** (atau sebelum `model AdminProfile` — gunakan blok berikut apa adanya sebagai satu‑set enum + model baru):

```prisma
enum WaTemplateKey {
  receipt
  payment_issue
  approved
  rejected
  cancelled
  refunded
  underpayment_invoice
}

model ClubWaTemplate {
  key     WaTemplateKey @id
  body    String        @db.Text
  updatedAt DateTime @updatedAt
}

/// Singleton branding publik. Logo opsional mengikuti URL Blob sama seperti sampul acara.
model ClubBranding {
  singletonKey    String @id @default("default")
  clubNameNav     String @default("CISC Nobar")
  footerPlainText String?
  logoBlobUrl     String?
  logoBlobPath    String?
  updatedAt       DateTime @updatedAt
}
```

- [ ] **Step 1: Tempel blok di atas.**

- [ ] **Step 2: Jalankan migrasi**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && pnpm prisma migrate dev --name club_wa_templates_and_branding
```

Expected: migrasi baru + client ter‑generate tanpa error.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): club WA templates + public branding singleton"
```

---

### Task 2: Util placeholder + tes (TDD)

**Files:**
- Create: `src/lib/wa-templates/wa-placeholder.ts`
- Create: `src/lib/wa-templates/wa-placeholder.test.ts`

```typescript
// src/lib/wa-templates/wa-placeholder.ts
const TOKEN = /\{([a-z][a-z0-9_]*)\}/g;

/** Ganti `{token}` dengan nilai dari `vars`. Tidak boleh ada `{` tersisa. */
export function applyWaPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  const out = template.replace(TOKEN, (full, name: string) => {
    if (!(name in vars)) {
      throw new Error(`Missing value for WhatsApp placeholder {${name}}`);
    }
    return vars[name];
  });
  if (out.includes("{") || out.includes("}")) {
    throw new Error("Template mengandung placeholder tidak dikenal atau kurung tidak seimbang");
  }
  return out;
}
```

```typescript
// src/lib/wa-templates/wa-placeholder.test.ts
import { describe, expect, it } from "vitest";

import { applyWaPlaceholders } from "@/lib/wa-templates/wa-placeholder";

describe("applyWaPlaceholders", () => {
  it("substitutes tokens", () => {
    expect(
      applyWaPlaceholders("Halo {nama}, acara *{judul}*.", {
        nama: "Budi",
        judul: "Nobar Final",
      }),
    ).toBe("Halo Budi, acara *Nobar Final*.");
  });

  it("throws on unknown token lookup", () => {
    expect(() =>
      applyWaPlaceholders("Halo {nama}.", {}),
    ).toThrow(/Missing value.*nama/);
  });

  it("throws on stray braces after replace", () => {
    expect(() =>
      applyWaPlaceholders("Invalid {nama", { nama: "x" }),
    ).toThrow(/tidak dikenal|seimbang/);
  });
});
```

- [ ] **Step 1: Tulis tes + util; jalankan `pnpm vitest run src/lib/wa-templates/wa-placeholder.test.ts`** — harus PASS.

- [ ] **Step 2: Commit**

```bash
git add src/lib/wa-templates/wa-placeholder.ts src/lib/wa-templates/wa-placeholder.test.ts
git commit -m "feat(wa): apply named placeholders with tests"
```

---

### Task 3: Kebijakan token wajib per key + tes

**Files:**
- Create: `src/lib/wa-templates/wa-template-policy.ts`
- Create: `src/lib/wa-templates/wa-template-policy.test.ts`

```typescript
// src/lib/wa-templates/wa-template-policy.ts
import type { WaTemplateKey } from "@prisma/client";

const RECEIPT_REQUIRED = ["contact_name", "event_title", "registration_id", "computed_total_idr"] as const;
const SINGLE_REASON = ["reason"] as const;
const TWO_NAME_EVENT = ["contact_name", "event_title"] as const;
const APPROVED_FIELDS = ["event_title", "venue", "start_at_formatted"] as const;
const UNDERPAY_FIELDS = [
  "contact_name",
  "event_title",
  "adjustment_amount_idr",
  "bank_name",
  "account_number",
  "account_name",
] as const;

/** Token yang **harus** muncul paling tidak sekali dalam `body`. */
export const REQUIRED_TOKENS: Record<
  WaTemplateKey,
  readonly string[]
> = {
  receipt: RECEIPT_REQUIRED,
  payment_issue: SINGLE_REASON,
  approved: APPROVED_FIELDS,
  rejected: SINGLE_REASON,
  cancelled: TWO_NAME_EVENT,
  refunded: TWO_NAME_EVENT,
  underpayment_invoice: UNDERPAY_FIELDS,
};

/** Ambil kumpulan `{nama}` apa pun dalam string. */
export function collectPlaceholderNames(body: string): string[] {
  const TOKEN = /\{([a-z][a-z0-9_]*)\}/g;
  const out: string[] = [];
  for (const m of body.matchAll(TOKEN)) {
    out.push(m[1]);
  }
  return out;
}

export function validateWaTemplateBody(
  key: WaTemplateKey,
  body: string,
): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return "Isi templat tidak boleh kosong.";
  const names = new Set(collectPlaceholderNames(trimmed));
  const required = REQUIRED_TOKENS[key];
  for (const r of required) {
    if (!names.has(r)) {
      return `Templat wajib memuat placeholder {${r}}`;
    }
  }
  const allowed = new Set(required as readonly string[]);
  for (const n of collectPlaceholderNames(trimmed)) {
    if (!allowed.has(n)) return `Placeholder {${n}} tidak diperbolehkan untuk templat ini.`;
  }
  return null;
}
```

```typescript
// src/lib/wa-templates/wa-template-policy.test.ts
import { WaTemplateKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  REQUIRED_TOKENS,
  validateWaTemplateBody,
} from "@/lib/wa-templates/wa-template-policy";

describe("validateWaTemplateBody", () => {
  it("accepts balanced receipt minimal", () => {
    expect(
      validateWaTemplateBody(
        WaTemplateKey.receipt,
        "Halo {contact_name}! {event_title} #{registration_id} total {computed_total_idr}",
      ),
    ).toBeNull();
  });

  it("rejects missing required token", () => {
    const err = validateWaTemplateBody(WaTemplateKey.receipt, "Halo {contact_name}");
    expect(err).toMatch(/registration_id|wajib/);
  });
});
```

Catatan penting untuk implementor: sampai **`pnpm prisma migrate dev`** tidak dijalankan, impor **`@prisma/client`** enum bisa gagal build—jalankan **`pnpm prisma generate`** setelah migrate agar tes ini kompilasi.

- [ ] **Step 1: Tambah dua file.**

- [ ] **Step 2: `pnpm vitest run src/lib/wa-templates/wa-template-policy.test.ts`**.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wa-templates/wa-template-policy.ts src/lib/wa-templates/wa-template-policy.test.ts
git commit -m "feat(wa): template policy for required placeholders"
```

---

### Task 4: Tubuh default bertoken untuk reset UI + kontrol semantik

**Files:**
- Create: `src/lib/wa-templates/db-default-template-bodies.ts`

Setiap konstanta string di bawah memakai **token snake_case sesuai** `REQUIRED_TOKENS`; format whitespace dan tanda ***WhatsApp‑markdown*** meniru perilaku **`messages.ts`**.

```typescript
// src/lib/wa-templates/db-default-template-bodies.ts
import type { WaTemplateKey } from "@prisma/client";

export const CLUB_WA_DEFAULT_BODIES: Record<WaTemplateKey, string> = {
  receipt: [
    `Halo {contact_name},`,
    ``,
    `Terima kasih — pendaftaran untuk *{event_title}* sudah kami terima.`,
    `\`ID: {registration_id}\``,
    `Total (snapshot): *{computed_total_idr}*`,
    `Status: *menunggu verifikasi admin*.`,
  ].join("\n"),

  payment_issue: [
    `Halo,`,
    ``,
    `Kami perlu klarifikasi terkait bukti transfer:`,
    `{reason}`,
    ``,
    `Mohon balas pesan ini setelah menyesuaikan / mengunggah ulang bukti sesuai arahan.`,
  ].join("\n"),

  approved: [
    `Selamat — pendaftaran untuk *{event_title}* *disetujui*.`,
    ``,
    `Detail acara: {venue}`,
    `Waktu: {start_at_formatted}`,
  ].join("\n"),

  rejected: [
    `Mohon maaf, pendaftaran belum dapat kami proses.`,
    ``,
    `Alasan:`,
    `{reason}`,
  ].join("\n"),

  cancelled: [
    `Halo {contact_name},`,
    ``,
    `Kami informasikan bahwa pendaftaran Anda untuk *{event_title}* telah *dibatalkan*.`,
    ``,
    `Jika ada pertanyaan, silakan hubungi panitia.`,
  ].join("\n"),

  refunded: [
    `Halo {contact_name},`,
    ``,
    `Pembayaran Anda untuk *{event_title}* telah *dikembalikan (refunded)*.`,
    ``,
    `Mohon konfirmasi penerimaan. Terima kasih.`,
  ].join("\n"),

  underpayment_invoice: [
    `Halo {contact_name},`,
    ``,
    `Terdapat kekurangan pembayaran untuk *{event_title}* sebesar *{adjustment_amount_idr}*.`,
    ``,
    `Mohon transfer ke:`,
    `Bank: *{bank_name}*`,
    `No. Rekening: *{account_number}*`,
    `Atas nama: *{account_name}*`,
    ``,
    `Setelah transfer, unggah bukti pembayaran melalui panitia atau balas pesan ini.`,
  ].join("\n"),
};
```

Untuk menghindari penyimpanan invalid lewat penyalinan salah, jalankan cepat **`validateWaTemplateBody`** pada **baris pembuka modul tes** satu kali atau masukkan `describe.skip` generator—**wajib** implementor jalankan blok assert berikut secara manual di REPL pertama kali atau di vitest satu file **`db-default-template-bodies.test.ts`**:

```typescript
import { WaTemplateKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CLUB_WA_DEFAULT_BODIES } from "@/lib/wa-templates/db-default-template-bodies";
import { validateWaTemplateBody } from "@/lib/wa-templates/wa-template-policy";

describe("CLUB_WA_DEFAULT_BODIES validity", () => {
  const keys = Object.values(WaTemplateKey);
  for (const key of keys) {
    it(`defaults valid for ${key}`, () => {
      expect(
        validateWaTemplateBody(key, CLUB_WA_DEFAULT_BODIES[key]),
      ).toBeNull();
    });
  }
});
```

- [ ] **Step 1: Tambah dua file (**`db-default-template-bodies.ts` + tes**`).**

- [ ] **Step 2: `pnpm vitest run src/lib/wa-templates/db-default-template-bodies.test.ts`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/wa-templates/db-default-template-bodies.ts src/lib/wa-templates/db-default-template-bodies.test.ts
git commit -m "feat(wa): curated default templates with placeholder tokens"
```

---

### Task 5: Renderer DB → pesan lengkap (+ fallback sinkron)

**Files:**
- Create: `src/lib/wa-templates/format-wa-idr.ts` (pisahkan **`idr`** agar bisa dipanggil sama dari fallback & DB formatter)
- Modify: `src/lib/wa-templates/messages.ts` — impor **`formatWaIdr`** dari file baru (**refactor bersih**) agar **`messages.ts` tidak menduplikasi logika.**

**`src/lib/wa-templates/format-wa-idr.ts`:**

```typescript
export function formatWaIdr(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
```

**`messages.ts`** — hapus **`const idr`** lokal dan ganti pemanggilan ke **`formatWaIdr`** (implementor lakukan mechanically).

**Buat `src/lib/wa-templates/render-wa-from-db.ts`:**

```typescript
import type { WaTemplateKey } from "@prisma/client";

import type { RegistrationMessageCtx, UnderpaymentInvoiceCtx } from "@/lib/wa-templates/messages";
import {
  templateApproved,
  templateCancelled,
  templatePaymentIssue,
  templateReceipt,
  templateRejected,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";
import { formatWaIdr } from "@/lib/wa-templates/format-wa-idr";
import { applyWaPlaceholders } from "@/lib/wa-templates/wa-placeholder";

export function renderReceiptMessage(
  bodyFromDb: string | null | undefined,
  ctx: RegistrationMessageCtx,
): string {
  if (!bodyFromDb) return templateReceipt(ctx);
  return applyWaPlaceholders(bodyFromDb, {
    contact_name: ctx.contactName,
    event_title: ctx.eventTitle,
    registration_id: ctx.registrationId,
    computed_total_idr: formatWaIdr(ctx.computedTotalIdr),
  });
}

export function renderApprovedMessage(
  bodyFromDb: string | null | undefined,
  eventTitle: string,
  venue: string,
  startAtIso: string,
): string {
  if (!bodyFromDb)
    return templateApproved(eventTitle, venue, startAtIso);
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  });
  return applyWaPlaceholders(bodyFromDb, {
    event_title: eventTitle,
    venue,
    start_at_formatted: when,
  });
}

export function renderRejectedMessage(
  bodyFromDb: string | null | undefined,
  reason: string,
): string {
  if (!bodyFromDb) return templateRejected(reason);
  return applyWaPlaceholders(bodyFromDb, { reason });
}

export function renderPaymentIssueMessage(
  bodyFromDb: string | null | undefined,
  reason: string,
): string {
  if (!bodyFromDb) return templatePaymentIssue(reason);
  return applyWaPlaceholders(bodyFromDb, { reason });
}

export function renderCancelledMessage(
  bodyFromDb: string | null | undefined,
  contactName: string,
  eventTitle: string,
): string {
  if (!bodyFromDb) return templateCancelled(contactName, eventTitle);
  return applyWaPlaceholders(bodyFromDb, {
    contact_name: contactName,
    event_title: eventTitle,
  });
}

export function renderRefundedMessage(
  bodyFromDb: string | null | undefined,
  contactName: string,
  eventTitle: string,
): string {
  if (!bodyFromDb) return templateRefunded(contactName, eventTitle);
  return applyWaPlaceholders(bodyFromDb, {
    contact_name: contactName,
    event_title: eventTitle,
  });
}

export function renderUnderpaymentInvoiceMessage(
  bodyFromDb: string | null | undefined,
  c: UnderpaymentInvoiceCtx,
): string {
  if (!bodyFromDb) return templateUnderpaymentInvoice(c);
  return applyWaPlaceholders(bodyFromDb, {
    contact_name: c.contactName,
    event_title: c.eventTitle,
    adjustment_amount_idr: formatWaIdr(c.adjustmentAmountIdr),
    bank_name: c.bankName,
    account_number: c.accountNumber,
    account_name: c.accountName,
  });
}

export type ClubWaBodies = Partial<Record<WaTemplateKey, string | null>>;
```

- [ ] **Step 1:** Refactor **`messages.ts`** agar menggunakan **`formatWaIdr`**; pastikan tes **`messages.test.ts`** masih PASS (update impor ekspektasi jumlah baris sama).

- [ ] **Step 2:** Tambah **`render-wa-from-db.ts`**.

- [ ] **Step 3: `pnpm vitest run src/lib/wa-templates`**

- [ ] **Step 4: Commit**

```bash
git add src/lib/wa-templates/format-wa-idr.ts src/lib/wa-templates/messages.ts src/lib/wa-templates/render-wa-from-db.ts
git commit -m "feat(wa): render WhatsApp templates from DB bodies with fallback"
```

---

### Task 6: Loader satu query + wiring inbox

**Files:**
- Create: `src/lib/wa-templates/load-club-wa-templates.ts`
- Modify: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx`
- Modify: `src/components/admin/registration-detail.tsx`

```typescript
// src/lib/wa-templates/load-club-wa-templates.ts
import type { WaTemplateKey } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ClubWaBodies } from "@/lib/wa-templates/render-wa-from-db";

export async function loadClubWaTemplateBodies(): Promise<ClubWaBodies> {
  const rows = await prisma.clubWaTemplate.findMany({
    select: { key: true, body: true },
  });
  const out: ClubWaBodies = {};
  for (const row of rows) {
    out[row.key as WaTemplateKey] = row.body;
  }
  return out;
}
```

**registration-detail.tsx** — ubah blok impor atas:

```typescript
import { waMeLink } from "@/lib/wa-templates/encode";
import type { ClubWaBodies } from "@/lib/wa-templates/render-wa-from-db";
import {
  renderApprovedMessage,
  renderCancelledMessage,
  renderPaymentIssueMessage,
  renderReceiptMessage,
  renderRefundedMessage,
  renderRejectedMessage,
  renderUnderpaymentInvoiceMessage,
} from "@/lib/wa-templates/render-wa-from-db";
```

Perluas **`Props`** utama:

```tsx
type Props = {
  eventId: string;
  registration: DetailRegistration;
  ticketContext: TicketContextVm;
  waBodies: ClubWaBodies;
};
```

Di tubuh komponen **`const wb = waBodies;`**.

Ganti **`templateReceipt({...})`** menjadi:

```tsx
renderReceiptMessage(wb.receipt ?? null, {
  contactName: registration.contactName,
  eventTitle: registration.event.title,
  registrationId: registration.id,
  computedTotalIdr: registration.computedTotalAtSubmit,
})
```

Lakukan analog untuk tautan lain; untuk underpayment:

```tsx
renderUnderpaymentInvoiceMessage(wb.underpayment_invoice ?? null, {
  contactName: registration.contactName,
  eventTitle: registration.event.title,
  adjustmentAmountIdr: adj.amount,
  bankName: registration.event.bankAccount?.bankName ?? "",
  accountNumber: registration.event.bankAccount?.accountNumber ?? "",
  accountName: registration.event.bankAccount?.accountName ?? "",
})
```

**Halaman inbox** setelah data `registration` ada:

```typescript
const waBodies = await loadClubWaTemplateBodies();

<RegistrationDetail
  eventId={eventId}
  registration={registration}
  ticketContext={ticketContext}
  waBodies={waBodies}
/>
```

- [ ] **Step 1: Implementasi wiring.**

- [ ] **Step 2:** `pnpm vitest run ...` **`registration-detail`** file vitest ada? Jika ada, jalankan lengkap **`pnpm test`**.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wa-templates/load-club-wa-templates.ts src/components/admin/registration-detail.tsx 'src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx'
git commit -m "feat(wa): load DB templates into registration detail"
```

---

### Task 7: Form Zod + server actions pengaturan (FormData tunggal)

**Files:**
- Create: `src/lib/forms/club-wa-template-schema.ts`
- Create: `src/lib/actions/admin-club-wa-templates.ts`

```typescript
// src/lib/forms/club-wa-template-schema.ts
import { WaTemplateKey } from "@prisma/client";
import { z } from "zod";

export const saveClubWaTemplateSchema = z.object({
  key: z.nativeEnum(WaTemplateKey),
  body: z.string().trim().min(1).max(4000),
});
```

```typescript
// src/lib/actions/admin-club-wa-templates.ts
"use server";

import { revalidatePath } from "next/cache";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { saveClubWaTemplateSchema } from "@/lib/forms/club-wa-template-schema";
import {
  fieldError,
  ok,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { CLUB_WA_DEFAULT_BODIES } from "@/lib/wa-templates/db-default-template-bodies";
import { validateWaTemplateBody } from "@/lib/wa-templates/wa-template-policy";

export async function saveClubWaTemplateBody(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = saveClubWaTemplateSchema.safeParse({
    key: formData.get("key"),
    body:
      typeof formData.get("body") === "string"
        ? (formData.get("body") as string)
        : "",
  });
  if (!parsed.success) {
    const first =
      parsed.error.issues[0]?.message ??
      "Data tidak valid.";
    return fieldError({ body: first });
  }

  const { key, body } = parsed.data;
  const policyErr = validateWaTemplateBody(key, body);
  if (policyErr) return fieldError({ body: policyErr });

  try {
    await prisma.clubWaTemplate.upsert({
      where: { key },
      create: { key, body },
      update: { body },
    });
  } catch {
    return rootError("Gagal menyimpan templat.");
  }

  revalidatePath("/admin/settings/whatsapp-templates");
  return ok({ saved: true });
}

export async function resetClubWaTemplateBody(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ saved: true }>> {
  try {
    await guardOwner();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsedKey = saveClubWaTemplateSchema.shape.key.safeParse(
    formData.get("key"),
  );
  if (!parsedKey.success)
    return fieldError({ body: "Jenis templat tidak valid." });

  const body = CLUB_WA_DEFAULT_BODIES[parsedKey.data];

  try {
    await prisma.clubWaTemplate.upsert({
      where: { key: parsedKey.data },
      create: { key: parsedKey.data, body },
      update: { body },
    });
  } catch {
    return rootError("Gagal mengatur ulang templat.");
  }

  revalidatePath("/admin/settings/whatsapp-templates");
  return ok({ saved: true });
}
```

- [ ] **Step 1: Tambah dua file.**

- [ ] **Step 2: `pnpm lint`**

- [ ] **Step 3: Commit**

```bash
git add src/lib/forms/club-wa-template-schema.ts src/lib/actions/admin-club-wa-templates.ts
git commit -m "feat(settings): Owner actions for WhatsApp templates"
```

---

### Task 8: UI Pengaturan → WhatsApp

**Files:**
- Modify: `src/app/admin/settings/whatsapp-templates/page.tsx`
- Create: `src/components/admin/club-wa-templates-panel.tsx`

Pola: **kartu satu per `WaTemplateKey`**, **`Textarea`**, tombol **`Simpan`** (`action={saveClubWaTemplateBody}`), tombol kedua **`form`** terpisah kecil **`action={resetClubWaTemplateBody}`** dengan **`<input type="hidden" name="key" />`**.

```tsx
<form action={saveClubWaTemplateBody}>
  <input type="hidden" name="key" value={keyEnumString} />
  <Textarea name="body" required defaultValue={display} rows={14} />
  <Button type="submit">Simpan</Button>
</form>
<form action={resetClubWaTemplateBody}>
  <input type="hidden" name="key" value={keyEnumString} />
  <Button type="submit" variant="outline">
    Reset ke bawaan
  </Button>
</form>
```

`display`:

```typescript
initialFromDb ?? CLUB_WA_DEFAULT_BODIES[key];
```

Komponen klien menerima **`initialBodies: Partial<Record<WaTemplateKey, string>>`** dari **`page.tsx`** (**`await prisma.clubWaTemplate.findMany`**).

Paragraf bantuan bahasa Indonesia mencantumkan token wajib **(map `REQUIRED_TOKENS[e.key]`)** agar pemilik menyalin orthography dengan benar.

- [ ] **Step 1: Implement UI.**

- [ ] **Step 2:** `pnpm lint && pnpm test`

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/whatsapp-templates/page.tsx src/components/admin/club-wa-templates-panel.tsx
git commit -m "feat(settings): WhatsApp templates admin UI"
```

---

### Task 9: Unggah logo klub helper

**Files:**
- Create: `src/lib/uploads/upload-club-logo.ts`

Gunakan struktur paralel **`upload-event-cover.ts`** tetapi:

- **`blobPath`**: tetap **`site/logo.webp`** (tidak bergantung id acara—**overwrite** konsisten seperti cover).
- **`maxDim`** gambar boleh **384** atau **480** (**lebih ringan daripada cover** untuk header).
- `MAX_UPLOAD_BYTES` sama **8 MiB** tetap boleh.

Skeleton:

```typescript
export async function uploadClubLogo(opts: {
  file: File;
  previousBlobUrl?: string | null;
}): Promise<{ url: string; pathname: string }> {
  ...
  const webp = await toWebp(raw, { maxDim: 480, quality: 85 });
  const blobPath = `site/logo.webp`;
  ...
}
```

- [ ] **Step 1: Tambahkan file.**

- [ ] **Step 2:** `pnpm lint`

- [ ] **Step 3: Commit**

```bash
git add src/lib/uploads/upload-club-logo.ts && git commit -m "feat(uploads): deterministic club logo to Blob WebP"
```

---

### Task 10: Loader branding + formatter Zod + actions

**Files:**
- Create: `src/lib/public/load-club-branding.ts`
- Create: `src/lib/forms/club-branding-schema.ts`
- Create: `src/lib/actions/admin-club-branding.ts`

```typescript
// src/lib/forms/club-branding-schema.ts
import { z } from "zod";

export const clubBrandingTextsSchema = z.object({
  clubNameNav: z.string().trim().min(1).max(120),
  footerPlainText: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .transform((v) => (v === "" ? null : v.slice(0, 500))),
});
```

```typescript
// src/lib/public/load-club-branding.ts
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const CLUB_BRANDING_SINGLETON_KEY = "default" as const;

export type PublicClubBranding = {
  clubNameNav: string;
  footerPlainText: string | null;
  logoBlobUrl: string | null;
};

export const loadPublicClubBranding = cache(async (): Promise<PublicClubBranding> => {
  const row = await prisma.clubBranding.findUnique({
    where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
  });

  const defaults = {
    clubNameNav: "CISC Nobar",
    footerPlainText: null as string | null,
    logoBlobUrl: null as string | null,
  };

  if (!row)
    return defaults;

  return {
    clubNameNav: row.clubNameNav || defaults.clubNameNav,
    footerPlainText: row.footerPlainText,
    logoBlobUrl: row.logoBlobUrl,
  };
});
```

**Server action penyimpanan teks + logo**:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";

import { guardOwner, isAuthError } from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { clubBrandingTextsSchema } from "@/lib/forms/club-branding-schema";
import { uploadClubLogo } from "@/lib/uploads/upload-club-logo";
import { isUploadError } from "@/lib/uploads/errors";
import { CLUB_BRANDING_SINGLETON_KEY } from "@/lib/public/load-club-branding";
```

Isi utama:

1. `guardOwner()`
2. FormData `clubNameNav`, optional `footerPlainText`, optional `logo` file
3. Validasi **`clubBrandingTextsSchema.safeParse`** → rootError(field)
4. Jika ada file logo → **`uploadClubLogo`** then delete previous URL best‑effort
5. Upsert **`clubBranding`**

Selalu **`revalidatePath("/")`** + **`"/events`** + **`".../branding`** setelah mutate.

```typescript
await prisma.clubBranding.upsert({
     where:{ singletonKey: CLUB_BRANDING_SINGLETON_KEY },
     create:{
        singletonKey: CLUB_BRANDING_SINGLETON_KEY,
        clubNameNav: ...,
        footerPlainText: ...,
        logoBlobUrl: nextLogoUrl ?? null,
        logoBlobPath: nextLogoPath ?? null,
     },
     update:{ ... fields ... }
});
```

- [ ] **Step 1:** Implement **`admin-club-branding.ts`** penuh (sesuaikan struktur sama **`ActionResult`**).

- [ ] **Step 2: Commit**

```bash
git add src/lib/public/load-club-branding.ts src/lib/forms/club-branding-schema.ts src/lib/actions/admin-club-branding.ts
git commit -m "feat(settings): club branding loaders and Owner actions"
```

---

### Task 11: UI `/admin/settings/branding`

**Files:**
- Modify: `src/app/admin/settings/branding/page.tsx`
- Create: `src/components/admin/club-branding-settings-form.tsx` (`useActionState`)

Form:

- dua Input teks (**nama navigasi**, **footer** textarea)
- `input type=file` accept image/*
- tombol **`Simpan`**

Pasang **`next/image`** thumbnail pratinjau hanya untuk URL https valid.

- [ ] **Step 1**

- [ ] **Step 2**

```bash
git add src/app/admin/settings/branding/page.tsx src/components/admin/club-branding-settings-form.tsx
git commit -m "feat(settings): branding admin UI"
```

---

### Task 12: **`PublicHeader` + Footer** konsumsi branding

**Files:**
- Modify: `src/components/public/public-header.tsx`
- Create: `src/components/public/public-footer.tsx`
- Modify: `src/app/(public)/layout.tsx`

**`layout.tsx`**:

```tsx
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { loadPublicClubBranding } from "@/lib/public/load-club-branding";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const branding = await loadPublicClubBranding();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PublicHeader
        clubNameNav={branding.clubNameNav}
        logoUrl={branding.logoBlobUrl}
      />
      {children}
      <PublicFooter footerPlainText={branding.footerPlainText} />
    </div>
  );
}
```

**`public-header.tsx`**: sekarang bersifat **sinkron**. Ubah menjadi menerima props:

```tsx
import Link from "next/link";
import Image from "next/image";

export function PublicHeader(props: {
  clubNameNav: string;
  logoUrl: string | null;
}) {
  return (
    <header ...>
      <Link href="/" className="flex items-center gap-2 font-semibold ...">
        {props.logoUrl ? (
          <Image
            src={props.logoUrl}
            alt={`Logo ${props.clubNameNav}`}
            width={32}
            height={32}
            className="rounded-sm object-contain"
          />
        ) : null}
        <span>{props.clubNameNav}</span>
      </Link>
...
```

Pada repo ini **`next.config.ts`** sudah memuat **`*.public.blob.vercel-storage.com`** dalam **`images.remotePatterns`** — jika Anda men-deploy ke host Blob lain, perluasan pola **wajib** ditambahkan di sana (**Task 12 build** akan mem-fail-fast bila tidak cocok).

```typescript
/** public-footer.tsx */
export function PublicFooter(props:{ footerPlainText: string|null}) {
 if (!props.footerPlainText) return null;
 return (<footer ...><p>...</p></footer>);
}
```

- [ ] **Step 1: Implementasi.**

- [ ] **Step 2: `pnpm build`** — gagal cepat kalau pola `remotePatterns` tidak mencakup hostname Blob Anda.

- [ ] **Step 3: Commit**

```bash
git add src/app/(public)/layout.tsx src/components/public/public-header.tsx src/components/public/public-footer.tsx next.config.ts
git commit -m "feat(public): configurable header logo/title + optional footer text"
```

---

### Task 13: Salin tautan kartu Pengaturan (hub ringkas)

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

Ganti dua deskripsi placeholder menjadi kalimat fakta seperti “Kelola templat tautan **`wa.me`** di inbox” dan “Judul/header publik dilengkapi logo footer” (**bahasa tetap konsisten Indo singkat**, tanpa marketing).

---

### Task 14: Verifikasi

- [ ] `pnpm lint`

- [ ] `pnpm test`

- [ ] `pnpm build`

- [ ] Commit hub teks kalau ada perbedaan incremental setelah tes.

---

## Self‑review checklist (penulis rencana)

1. **Cakupan spek §7 Phase B §5.2** — ✅ DB templat tulisan + ✅ fallback TS; ✅ Branding Blob + ✅ footer + ✅ judul. **Tidak** menyentuh Phase C/D.
2. **Placeholder scan** — tidak ada `TODO` bertuliskan tugas hilang dalam task konkret.
3. **Konsistensi tipe `WaTemplateKey`** — digunakan linter Prisma sama di schema, validator, renderer.
4. **Risiko** — `next/image` butuh pola domain whitelist; dokumentasikan di Task 12 (**wajib** diperbaiki sebelum klaim PASS build).

---

## Execution handoff

**Rencana lengkap ada di:** `docs/superpowers/plans/2026-05-03-admin-settings-phase-b-whatsapp-branding.md`.

**Opsi:**

1. **Subagent‑Driven (disarankan)** — subagent baru per blok task besar + review antara task.
2. **Inline Execution** — eksekusi berurutan di sesi sama dengan checkpoints.

 **Mau yang mana?**
