# Ops & Reporting — Hardening + Breadth (Plan #3A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the admin operations loop — attendance marking, cancel/refund, member validation override with auto-invoice adjustments, invoice adjustment proof uploads, voucher redemption, and per-event reports with CSV export.

**Architecture:** All mutations are new Server Actions in `src/lib/actions/` following the existing guard pattern (session → admin context → `canVerifyEvent`). A shared `src/lib/actions/guard.ts` eliminates repeated boilerplate. New `"use client"` panel components extend the existing `RegistrationDetail` server component. Reports are read-only RSC pages consuming `src/lib/reports/queries.ts`. CSV export is a Next.js Route Handler (`route.ts`).

**Tech Stack:** Next.js 16 App Router, Prisma + Neon Postgres, Better Auth (existing), Vercel Blob (existing pipeline via `uploadImageForRegistration`), Zod, shadcn/ui, Vitest.

**Context:** This plan assumes Plans #1 and #2 are complete. The schema already has `InvoiceAdjustment`, `AttendanceStatus`, `MemberValidation`, `RegistrationStatus.cancelled/refunded`. The only missing schema piece is voucher redemption fields on `Ticket`. Run in the `dev` branch.

---

## ⚠️ Scope note — split recommendation

This plan covers **Ops hardening + Reports** (12 tasks). **Master Data & Event Management** (Members CRUD, Events CRUD, PIC bank accounts, Admin settings/global defaults) is large enough to warrant a separate **Plan #3B**. Nothing in Plan #3A depends on Plan #3B — both can be executed independently.

---

## File structure (locked)

**Create:**

| File | Responsibility |
|------|----------------|
| `prisma/migrations/<ts>_voucher_redemption/` | Adds `voucherRedeemedMenuItemId` + `voucherRedeemedAt` to `Ticket` |
| `src/lib/actions/guard.ts` | `guardEvent`, `guardOwner`, `isAuthError` shared helpers |
| `src/lib/actions/attendance.ts` | `setAttendance` server action |
| `src/lib/actions/cancel-refund.ts` | `cancelRegistration`, `refundRegistration` server actions |
| `src/lib/actions/member-validation.ts` | `overrideMemberValidation` server action (+ auto-creates InvoiceAdjustment on delta) |
| `src/lib/actions/invoice-adjustment.ts` | `createInvoiceAdjustment`, `markAdjustmentPaid`, `markAdjustmentUnpaid` |
| `src/lib/actions/upload-adjustment-proof.ts` | `uploadAdjustmentProof` server action (Blob + DB) |
| `src/lib/actions/voucher-redemption.ts` | `redeemVoucher` server action |
| `src/lib/reports/queries.ts` | `getEventReport(eventId)` — aggregated participant/finance/menu/attendance stats |
| `src/lib/reports/csv.ts` | `generateRegistrationsCsv(eventId)` — returns CSV string |
| `src/components/admin/attendance-panel.tsx` | "Hadir" / "Tidak Hadir" buttons (client) |
| `src/components/admin/cancel-refund-panel.tsx` | Cancel/refund with Dialog confirmation (client) |
| `src/components/admin/member-validation-panel.tsx` | Validation override form (client) |
| `src/components/admin/invoice-adjustment-panel.tsx` | Adjustment list + create + mark paid + proof upload (client) |
| `src/components/admin/voucher-redemption-panel.tsx` | Menu item selector for voucher tickets (client) |
| `src/app/admin/events/[eventId]/report/page.tsx` | Per-event report page (RSC) |
| `src/app/admin/events/[eventId]/report/export/route.ts` | CSV download Route Handler |

**Modify:**

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `voucherRedeemedMenuItemId`, `voucherRedeemedAt`, back-relation to `Ticket` and `EventMenuItem` |
| `src/lib/wa-templates/messages.ts` | Add `templateCancelled`, `templateRefunded`, `templateUnderpaymentInvoice` |
| `src/lib/wa-templates/messages.test.ts` | Add tests for new templates |
| `src/components/admin/registration-detail.tsx` | Extend `DetailRegistration` type; add new panels; extend WA links |
| `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` | Expand Prisma `select` for all new fields |

---

## Task 1: Schema — voucher redemption fields + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_voucher_redemption/migration.sql` (via CLI)

- [ ] **Step 1: Extend `Ticket` model in `prisma/schema.prisma`**

Add these two fields and a named relation to `model Ticket` (after existing fields, before `@@index` directives):

```prisma
  voucherRedeemedMenuItemId String?
  voucherRedeemedAt         DateTime?
  voucherRedeemedItem       EventMenuItem? @relation("VoucherRedemption", fields: [voucherRedeemedMenuItemId], references: [id], onDelete: SetNull)
```

Also add to `model EventMenuItem` (after existing `selections` relation):

```prisma
  voucherRedemptions Ticket[] @relation("VoucherRedemption")
```

Add index to `Ticket` model (inside `@@index` block area):

```prisma
  @@index([voucherRedeemedMenuItemId])
```

- [ ] **Step 2: Validate schema**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Generate and run migration**

```bash
npx prisma migrate dev --name voucher_redemption
```

Expected: migration file created, new columns added to DB.

- [ ] **Step 4: Regenerate client**

```bash
npx prisma generate
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add voucher redemption fields to Ticket"
```

---

## Task 2: Shared action guard helpers

**Files:**
- Create: `src/lib/actions/guard.ts`

This eliminates the repeated 15-line guard boilerplate in every server action file.

- [ ] **Step 1: Create `src/lib/actions/guard.ts`**

```ts
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent, type AdminContext } from "@/lib/permissions/guards";

export async function guardEvent(eventId: string): Promise<AdminContext> {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (!canVerifyEvent(ctx, eventId)) throw new Error("FORBIDDEN");
  return ctx;
}

export async function guardOwner(): Promise<AdminContext> {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (ctx.role !== "Owner") throw new Error("FORBIDDEN");
  return ctx;
}

/** Returns true if `e` is a known auth/permission error that should be surfaced as "Tidak diizinkan." */
export function isAuthError(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.message === "NO_PROFILE" ||
      e.message === "FORBIDDEN" ||
      e.message === "UNAUTHENTICATED")
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/guard.ts
git commit -m "feat(actions): shared guard helpers for server actions"
```

---

## Task 3: Extended WA templates (cancel, refund, underpayment invoice)

**Files:**
- Modify: `src/lib/wa-templates/messages.ts`
- Modify: `src/lib/wa-templates/messages.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/wa-templates/messages.test.ts`:

```ts
import {
  templateCancelled,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";

describe("additional wa templates", () => {
  it("templateCancelled mentions event title and contact name", () => {
    const body = templateCancelled("Budi", "Demo Final");
    expect(body).toContain("Budi");
    expect(body).toContain("Demo Final");
    expect(body).toContain("dibatalkan");
  });

  it("templateRefunded mentions event title", () => {
    const body = templateRefunded("Sari", "Demo Final");
    expect(body).toContain("Demo Final");
    expect(body).toContain("dikembalikan");
  });

  it("templateUnderpaymentInvoice includes amount and bank details", () => {
    const body = templateUnderpaymentInvoice({
      contactName: "Andi",
      eventTitle: "Final UCL",
      adjustmentAmountIdr: 50_000,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountName: "Demo CISC",
    });
    expect(body).toContain("50.000");
    expect(body).toContain("BCA");
    expect(body).toContain("1234567890");
  });
});
```

Run: `pnpm vitest run src/lib/wa-templates/messages.test.ts`
Expected: FAIL — functions missing.

- [ ] **Step 2: Implement new template functions**

Append to `src/lib/wa-templates/messages.ts`:

```ts
export function templateCancelled(contactName: string, eventTitle: string): string {
  return [
    `Halo ${contactName},`,
    ``,
    `Kami informasikan bahwa pendaftaran Anda untuk *${eventTitle}* telah *dibatalkan*.`,
    ``,
    `Jika ada pertanyaan, silakan hubungi panitia.`,
  ].join("\n");
}

export function templateRefunded(contactName: string, eventTitle: string): string {
  return [
    `Halo ${contactName},`,
    ``,
    `Pembayaran Anda untuk *${eventTitle}* telah *dikembalikan (refunded)*.`,
    ``,
    `Mohon konfirmasi penerimaan. Terima kasih.`,
  ].join("\n");
}

export type UnderpaymentInvoiceCtx = {
  contactName: string;
  eventTitle: string;
  adjustmentAmountIdr: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export function templateUnderpaymentInvoice(c: UnderpaymentInvoiceCtx): string {
  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(c.adjustmentAmountIdr);

  return [
    `Halo ${c.contactName},`,
    ``,
    `Terdapat kekurangan pembayaran untuk *${c.eventTitle}* sebesar *${amount}*.`,
    ``,
    `Mohon transfer ke:`,
    `Bank: *${c.bankName}*`,
    `No. Rekening: *${c.accountNumber}*`,
    `Atas nama: *${c.accountName}*`,
    ``,
    `Setelah transfer, unggah bukti pembayaran melalui panitia atau balas pesan ini.`,
  ].join("\n");
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run src/lib/wa-templates/messages.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/wa-templates/messages.ts src/lib/wa-templates/messages.test.ts
git commit -m "feat(wa): add cancel, refund, and underpayment invoice templates"
```

---

## Task 4: Attendance server action

**Files:**
- Create: `src/lib/actions/attendance.ts`

- [ ] **Step 1: Create `src/lib/actions/attendance.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { AttendanceStatus, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function setAttendance(
  eventId: string,
  registrationId: string,
  attendanceStatus: AttendanceStatus,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  });

  if (!existing || existing.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }
  if (existing.status !== RegistrationStatus.approved) {
    return rootError("Kehadiran hanya dapat dicatat untuk pendaftaran yang sudah disetujui.");
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { attendanceStatus },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/attendance.ts
git commit -m "feat(actions): setAttendance server action"
```

---

## Task 5: Cancel + Refund server actions

**Files:**
- Create: `src/lib/actions/cancel-refund.ts`

Allowed transitions (per spec §8.1):
- `cancelRegistration`: any status except `cancelled`, `refunded`, `rejected` → `cancelled`
- `refundRegistration`: `approved` or `cancelled` → `refunded`

- [ ] **Step 1: Create `src/lib/actions/cancel-refund.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

const CANCEL_BLOCKED_FROM: RegistrationStatus[] = [
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
];

const REFUND_ALLOWED_FROM: RegistrationStatus[] = [
  RegistrationStatus.approved,
  RegistrationStatus.cancelled,
];

export async function cancelRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  });

  if (!existing || existing.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }
  if (CANCEL_BLOCKED_FROM.includes(existing.status)) {
    return rootError(`Tidak dapat membatalkan pendaftaran dengan status "${existing.status}".`);
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.cancelled },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function refundRegistration(
  eventId: string,
  registrationId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const existing = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: { status: true, eventId: true },
  });

  if (!existing || existing.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }
  if (!REFUND_ALLOWED_FROM.includes(existing.status)) {
    return rootError(`Refund hanya untuk pendaftaran dengan status "approved" atau "cancelled".`);
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.refunded },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/cancel-refund.ts
git commit -m "feat(actions): cancelRegistration and refundRegistration server actions"
```

---

## Task 6: Member validation override + auto-invoice adjustment

**Files:**
- Create: `src/lib/actions/member-validation.ts`

When an admin overrides a claim from `member` → `non_member`, the price difference becomes an underpayment and an `InvoiceAdjustment` is created automatically.

- [ ] **Step 1: Create `src/lib/actions/member-validation.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import {
  InvoiceAdjustmentType,
  MemberValidation,
  TicketPriceType,
  TicketRole,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function overrideMemberValidation(
  eventId: string,
  registrationId: string,
  {
    validation,
    newPrimaryPriceType,
  }: {
    validation: MemberValidation;
    /** Pass new price type only when overriding member→non_member or vice versa. */
    newPrimaryPriceType?: TicketPriceType;
  },
): Promise<ActionResult<{ adjustmentCreated: boolean }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      eventId: true,
      memberValidation: true,
      ticketMemberPriceApplied: true,
      ticketNonMemberPriceApplied: true,
      tickets: {
        where: { role: TicketRole.primary },
        select: { id: true, ticketPriceType: true },
      },
    },
  });

  if (!reg || reg.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }

  const primaryTicket = reg.tickets[0];
  if (!primaryTicket) {
    return rootError("Tiket utama tidak ditemukan.");
  }

  let adjustmentCreated = false;

  await prisma.$transaction(async (tx) => {
    // Update registration memberValidation
    await tx.registration.update({
      where: { id: registrationId },
      data: { memberValidation: validation },
    });

    // If price type is being changed, update ticket and create adjustment if underpayment
    if (
      newPrimaryPriceType &&
      newPrimaryPriceType !== primaryTicket.ticketPriceType
    ) {
      await tx.ticket.update({
        where: { id: primaryTicket.id },
        data: { ticketPriceType: newPrimaryPriceType },
      });

      // Compute delta: positive = underpayment
      const oldPrice =
        primaryTicket.ticketPriceType === "member"
          ? reg.ticketMemberPriceApplied
          : reg.ticketNonMemberPriceApplied;
      const newPrice =
        newPrimaryPriceType === "member"
          ? reg.ticketMemberPriceApplied
          : reg.ticketNonMemberPriceApplied;
      const delta = newPrice - oldPrice;

      if (delta > 0) {
        await tx.invoiceAdjustment.create({
          data: {
            registrationId,
            type: InvoiceAdjustmentType.underpayment,
            amount: delta,
            status: "unpaid",
          },
        });
        adjustmentCreated = true;
      }
    }
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ adjustmentCreated });
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/member-validation.ts
git commit -m "feat(actions): overrideMemberValidation with auto underpayment adjustment"
```

---

## Task 7: Invoice adjustment CRUD

**Files:**
- Create: `src/lib/actions/invoice-adjustment.ts`

Handles manual create and paid/unpaid toggling. Proof upload is a separate action (Task 8).

- [ ] **Step 1: Create `src/lib/actions/invoice-adjustment.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { InvoiceAdjustmentType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, fieldError, type ActionResult } from "@/lib/forms/action-result";

const createSchema = z.object({
  registrationId: z.string().min(1),
  type: z.nativeEnum(InvoiceAdjustmentType),
  amount: z.number().int().positive("Jumlah harus lebih dari 0"),
});

export async function createInvoiceAdjustment(
  eventId: string,
  input: z.infer<typeof createSchema>,
): Promise<ActionResult<{ adjustmentId: string }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string") fe[p] = issue.message;
    }
    return fieldError(fe);
  }

  const reg = await prisma.registration.findUnique({
    where: { id: parsed.data.registrationId },
    select: { eventId: true },
  });
  if (!reg || reg.eventId !== eventId) {
    return rootError("Pendaftaran tidak ditemukan.");
  }

  const adj = await prisma.invoiceAdjustment.create({
    data: {
      registrationId: parsed.data.registrationId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      status: "unpaid",
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${parsed.data.registrationId}`);
  return ok({ adjustmentId: adj.id });
}

export async function markAdjustmentPaid(
  eventId: string,
  adjustmentId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  await prisma.invoiceAdjustment.update({
    where: { id: adjustmentId },
    data: { status: "paid", paidAt: new Date() },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ ok: true });
}

export async function markAdjustmentUnpaid(
  eventId: string,
  adjustmentId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  await prisma.invoiceAdjustment.update({
    where: { id: adjustmentId },
    data: { status: "unpaid", paidAt: null },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/invoice-adjustment.ts
git commit -m "feat(actions): invoice adjustment create and paid/unpaid toggle"
```

---

## Task 8: Upload invoice adjustment proof

**Files:**
- Create: `src/lib/actions/upload-adjustment-proof.ts`

Follows the same Blob pipeline as `uploadImageForRegistration`. Blob path: `registrations/{registrationId}/adjustments/{adjustmentId}/proof.webp`.

- [ ] **Step 1: Create `src/lib/actions/upload-adjustment-proof.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, fieldError, type ActionResult } from "@/lib/forms/action-result";
import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { retry } from "@/lib/uploads/retry";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function uploadAdjustmentProof(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ uploadId: string }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const adjustmentId = String(formData.get("adjustmentId") ?? "").trim();
  const file = formData.get("file");

  if (!adjustmentId) return fieldError({ adjustmentId: "ID penyesuaian wajib." });
  if (!(file instanceof File) || file.size === 0) {
    return fieldError({ file: "Pilih file bukti pembayaran." });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return fieldError({ file: "Format file tidak didukung (JPEG/PNG/WebP/HEIC)." });
  }
  if (file.size > MAX_BYTES) {
    return fieldError({ file: "File terlalu besar (maksimal 8 MB)." });
  }

  const adj = await prisma.invoiceAdjustment.findUnique({
    where: { id: adjustmentId },
    select: { id: true, registration: { select: { eventId: true, id: true } } },
  });
  if (!adj || adj.registration.eventId !== eventId) {
    return rootError("Penyesuaian tidak ditemukan.");
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });
  const blobPath = `registrations/${adj.registration.id}/adjustments/${adjustmentId}/proof.webp`;

  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  let uploadRow;
  try {
    uploadRow = await prisma.upload.create({
      data: {
        purpose: "invoice_adjustment_proof",
        registrationId: adj.registration.id,
        invoiceAdjustmentId: adjustmentId,
        blobUrl: putRes.url,
        blobPath: putRes.pathname,
        contentType: "image/webp",
        bytes: webp.bytes.length,
        sha256: webp.sha256,
        width: webp.width,
        height: webp.height,
        originalFilename: file.name,
      },
    });
  } catch (err) {
    try { await del(putRes.url); } catch { /* best-effort */ }
    throw err;
  }

  revalidatePath(`/admin/events/${eventId}/inbox/${adj.registration.id}`);
  return ok({ uploadId: uploadRow.id });
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0. Fix any import path issues.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/upload-adjustment-proof.ts
git commit -m "feat(actions): upload invoice adjustment payment proof to Blob"
```

---

## Task 9: Voucher redemption action

**Files:**
- Create: `src/lib/actions/voucher-redemption.ts`

Allows an admin to record that a voucher ticket selected their menu item (event day operation). Only for VOUCHER-mode events.

- [ ] **Step 1: Write failing test**

Create `src/lib/actions/voucher-redemption.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
    eventMenuItem: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/actions/guard", () => ({
  guardEvent: vi.fn().mockResolvedValue({ role: "Verifier", helperEventIds: [] }),
  isAuthError: vi.fn().mockReturnValue(false),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";

describe("redeemVoucher", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findUnique).mockReset();
    vi.mocked(prisma.eventMenuItem.findUnique).mockReset();
  });

  it("returns error if ticket not in event", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce(null);
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
  });

  it("returns error if menu item not voucherEligible", async () => {
    vi.mocked(prisma.ticket.findUnique).mockResolvedValueOnce({
      id: "ticket1",
      eventId: "evt1",
      voucherRedeemedMenuItemId: null,
      registration: { event: { menuMode: "VOUCHER", id: "evt1" } },
    } as never);
    vi.mocked(prisma.eventMenuItem.findUnique).mockResolvedValueOnce({
      id: "menu1",
      eventId: "evt1",
      voucherEligible: false,
    } as never);
    const result = await redeemVoucher("evt1", "ticket1", "menu1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rootError).toContain("tidak eligible");
  });
});
```

Run: `pnpm vitest run src/lib/actions/voucher-redemption.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 2: Implement `src/lib/actions/voucher-redemption.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { guardEvent, isAuthError } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

export async function redeemVoucher(
  eventId: string,
  ticketId: string,
  menuItemId: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guardEvent(eventId);
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      eventId: true,
      voucherRedeemedMenuItemId: true,
      registration: {
        select: {
          id: true,
          event: { select: { id: true, menuMode: true } },
        },
      },
    },
  });

  if (!ticket || ticket.eventId !== eventId) {
    return rootError("Tiket tidak ditemukan.");
  }
  if (ticket.registration.event.menuMode !== "VOUCHER") {
    return rootError("Acara ini tidak menggunakan mode voucher.");
  }
  if (ticket.voucherRedeemedMenuItemId) {
    return rootError("Voucher tiket ini sudah digunakan.");
  }

  const menuItem = await prisma.eventMenuItem.findUnique({
    where: { id: menuItemId },
    select: { id: true, eventId: true, voucherEligible: true },
  });

  if (!menuItem || menuItem.eventId !== eventId) {
    return rootError("Menu item tidak ditemukan untuk acara ini.");
  }
  if (!menuItem.voucherEligible) {
    return rootError("Menu item ini tidak eligible untuk penukaran voucher.");
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      voucherRedeemedMenuItemId: menuItemId,
      voucherRedeemedAt: new Date(),
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox/${ticket.registration.id}`);
  return ok({ ok: true });
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run src/lib/actions/voucher-redemption.test.ts
```

Expected: PASS.

- [ ] **Step 4: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/voucher-redemption.ts src/lib/actions/voucher-redemption.test.ts
git commit -m "feat(actions): redeemVoucher server action with eligibility validation"
```

---

## Task 10: Extend registration-detail with all new ops panels

**Files:**
- Modify: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` (expand query)
- Modify: `src/components/admin/registration-detail.tsx` (extend type + render panels + WA links)
- Create: `src/components/admin/attendance-panel.tsx`
- Create: `src/components/admin/cancel-refund-panel.tsx`
- Create: `src/components/admin/member-validation-panel.tsx`
- Create: `src/components/admin/invoice-adjustment-panel.tsx`
- Create: `src/components/admin/voucher-redemption-panel.tsx`

### Step 1: Expand the page query

- [ ] **Step 1a: Update `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx`**

Change the `select` to include all new fields needed by the new panels. Replace the existing `select` block:

```ts
select: {
  id: true,
  createdAt: true,
  contactName: true,
  contactWhatsapp: true,
  claimedMemberNumber: true,
  computedTotalAtSubmit: true,
  status: true,
  attendanceStatus: true,
  memberValidation: true,
  rejectionReason: true,
  paymentIssueReason: true,
  event: {
    select: {
      title: true,
      venueName: true,
      startAt: true,
      menuMode: true,
      menuItems: {
        orderBy: { sortOrder: "asc" as const },
        select: { id: true, name: true, price: true, voucherEligible: true },
      },
      bankAccount: {
        select: { bankName: true, accountNumber: true, accountName: true },
      },
    },
  },
  tickets: {
    orderBy: { createdAt: "asc" as const },
    include: {
      menuSelections: {
        include: { menuItem: { select: { name: true, price: true } } },
      },
    },
    // include voucher redemption fields (auto-included via `include` — no extra select needed)
  },
  uploads: { orderBy: { createdAt: "asc" as const } },
  adjustments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      uploads: {
        select: { id: true, blobUrl: true, bytes: true, createdAt: true },
      },
    },
  },
},
```

Also update `<RegistrationDetail>` JSX — pass the full `registration` object (type will be inferred from Prisma).

### Step 2: Update `DetailRegistration` type and component

- [ ] **Step 2a: Update `DetailRegistration` type in `src/components/admin/registration-detail.tsx`**

Replace the existing `type DetailRegistration` with:

```ts
import type {
  AttendanceStatus,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  MenuMode,
  MemberValidation,
  RegistrationStatus,
  TicketPriceType,
  TicketRole,
  UploadPurpose,
} from "@prisma/client";

type DetailRegistration = {
  id: string;
  createdAt: Date;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  status: RegistrationStatus;
  attendanceStatus: AttendanceStatus;
  memberValidation: MemberValidation;
  rejectionReason: string | null;
  paymentIssueReason: string | null;
  event: {
    title: string;
    venueName: string;
    startAt: Date;
    menuMode: MenuMode;
    menuItems: Array<{ id: string; name: string; price: number; voucherEligible: boolean }>;
    bankAccount: { bankName: string; accountNumber: string; accountName: string };
  };
  tickets: Array<{
    id: string;
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
    voucherRedeemedMenuItemId: string | null;
    voucherRedeemedAt: Date | null;
    menuSelections: Array<{ menuItem: { name: string; price: number } }>;
  }>;
  uploads: Array<{
    id: string;
    purpose: UploadPurpose;
    blobUrl: string;
    contentType: string;
    bytes: number;
    width: number | null;
    height: number | null;
    originalFilename: string | null;
    createdAt: Date;
  }>;
  adjustments: Array<{
    id: string;
    type: InvoiceAdjustmentType;
    amount: number;
    status: InvoiceAdjustmentStatus;
    paidAt: Date | null;
    createdAt: Date;
    uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>;
  }>;
};
```

- [ ] **Step 2b: Add new panels and WA links to `RegistrationDetail`**

In the `RegistrationDetail` JSX, add the new panel components and extend `waLinks`. Add these imports at the top:

```ts
import { AttendancePanel } from "@/components/admin/attendance-panel";
import { CancelRefundPanel } from "@/components/admin/cancel-refund-panel";
import { MemberValidationPanel } from "@/components/admin/member-validation-panel";
import { InvoiceAdjustmentPanel } from "@/components/admin/invoice-adjustment-panel";
import { VoucherRedemptionPanel } from "@/components/admin/voucher-redemption-panel";
import {
  templateCancelled,
  templateRefunded,
  templateUnderpaymentInvoice,
} from "@/lib/wa-templates/messages";
```

Extend `waLinks` with cancel/refund/underpayment entries (conditional on status and adjustment data):

```ts
// After existing waLinks array, add:
{
  label: "WhatsApp · dibatalkan",
  href: waMeLink(waPhone, templateCancelled(registration.contactName, registration.event.title)),
  show: registration.status === "cancelled",
},
{
  label: "WhatsApp · refunded",
  href: waMeLink(waPhone, templateRefunded(registration.contactName, registration.event.title)),
  show: registration.status === "refunded",
},
// For each unpaid adjustment, render an underpayment WA link (map over adjustments)
```

For underpayment WA links (one per unpaid adjustment), render them separately below the main WA card:

```tsx
{registration.adjustments.filter(a => a.status === "unpaid").map(adj => (
  <a
    key={adj.id}
    href={waMeLink(waPhone, templateUnderpaymentInvoice({
      contactName: registration.contactName,
      eventTitle: registration.event.title,
      adjustmentAmountIdr: adj.amount,
      bankName: registration.event.bankAccount.bankName,
      accountNumber: registration.event.bankAccount.accountNumber,
      accountName: registration.event.bankAccount.accountName,
    }))}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent/60 transition-colors"
  >
    WhatsApp · tagihan kekurangan ({formatCurrencyIdr(adj.amount)})
  </a>
))}
```

Render new panels in order after the existing panels (attendance before cancel/refund; adjustments near end):

```tsx
<AttendancePanel
  eventId={eventId}
  registrationId={registration.id}
  current={registration.attendanceStatus}
  registrationStatus={registration.status}
/>

<MemberValidationPanel
  eventId={eventId}
  registrationId={registration.id}
  current={registration.memberValidation}
  primaryTicket={registration.tickets.find(t => t.role === "primary") ?? null}
  memberPriceApplied={registration.computedTotalAtSubmit /* pass ticketMemberPriceApplied and ticketNonMemberPriceApplied from type */}
/>

<InvoiceAdjustmentPanel
  eventId={eventId}
  registrationId={registration.id}
  adjustments={registration.adjustments}
/>

{registration.event.menuMode === "VOUCHER" && (
  <VoucherRedemptionPanel
    eventId={eventId}
    tickets={registration.tickets}
    menuItems={registration.event.menuItems.filter(m => m.voucherEligible)}
  />
)}

<CancelRefundPanel
  eventId={eventId}
  registrationId={registration.id}
  status={registration.status}
/>
```

Note: `MemberValidationPanel` needs `ticketMemberPriceApplied` and `ticketNonMemberPriceApplied` — add these to `DetailRegistration` type and the page select query:

```ts
// Add to DetailRegistration:
ticketMemberPriceApplied: number;
ticketNonMemberPriceApplied: number;
```

### Step 3: Create client panel components

- [ ] **Step 3a: Create `src/components/admin/attendance-panel.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { AttendanceStatus, RegistrationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setAttendance } from "@/lib/actions/attendance";
import { useState } from "react";

type Props = {
  eventId: string;
  registrationId: string;
  current: AttendanceStatus;
  registrationStatus: RegistrationStatus;
};

export function AttendancePanel({ eventId, registrationId, current, registrationStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSetAttendance = registrationStatus === RegistrationStatus.approved;

  function handleSet(status: AttendanceStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setAttendance(eventId, registrationId, status);
      if (!result.ok) setError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kehadiran</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          Status saat ini:{" "}
          <span className="font-medium capitalize">{current.replace("_", " ")}</span>
        </div>
        {!canSetAttendance && (
          <p className="text-sm text-muted-foreground">
            Kehadiran hanya dapat dicatat untuk pendaftaran yang sudah disetujui.
          </p>
        )}
        {canSetAttendance && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={isPending || current === "attended"}
              onClick={() => handleSet(AttendanceStatus.attended)}
            >
              Hadir
            </Button>
            <Button
              variant="outline"
              disabled={isPending || current === "no_show"}
              onClick={() => handleSet(AttendanceStatus.no_show)}
            >
              Tidak hadir
            </Button>
            <Button
              variant="ghost"
              disabled={isPending || current === "unknown"}
              onClick={() => handleSet(AttendanceStatus.unknown)}
            >
              Reset
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3b: Create `src/components/admin/cancel-refund-panel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { RegistrationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelRegistration, refundRegistration } from "@/lib/actions/cancel-refund";

type Props = {
  eventId: string;
  registrationId: string;
  status: RegistrationStatus;
};

const CANCEL_BLOCKED_FROM = new Set<RegistrationStatus>([
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
  RegistrationStatus.rejected,
]);

const REFUND_ALLOWED_FROM = new Set<RegistrationStatus>([
  RegistrationStatus.approved,
  RegistrationStatus.cancelled,
]);

export function CancelRefundPanel({ eventId, registrationId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = !CANCEL_BLOCKED_FROM.has(status);
  const canRefund = REFUND_ALLOWED_FROM.has(status);

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration(eventId, registrationId);
      if (!result.ok) {
        setError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        setCancelOpen(false);
      }
    });
  }

  function handleRefund() {
    setError(null);
    startTransition(async () => {
      const result = await refundRegistration(eventId, registrationId);
      if (!result.ok) {
        setError(result.rootError ?? "Terjadi kesalahan.");
      } else {
        setRefundOpen(false);
      }
    });
  }

  if (!canCancel && !canRefund) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batalkan / Refund</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={isPending}>
                  Batalkan pendaftaran
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Konfirmasi pembatalan</DialogTitle>
                  <DialogDescription>
                    Pendaftaran ini akan diubah ke status <strong>cancelled</strong>. Aksi ini tidak dapat dibatalkan secara otomatis.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
                    Kembali
                  </Button>
                  <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                    Ya, batalkan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canRefund && (
            <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={isPending}>
                  Proses refund
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Konfirmasi refund</DialogTitle>
                  <DialogDescription>
                    Pendaftaran ini akan diubah ke status <strong>refunded</strong>. Pastikan pembayaran sudah dikembalikan sebelum mengkonfirmasi.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={isPending}>
                    Kembali
                  </Button>
                  <Button variant="destructive" onClick={handleRefund} disabled={isPending}>
                    Ya, proses refund
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3c: Create `src/components/admin/member-validation-panel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { MemberValidation, TicketPriceType, TicketRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { overrideMemberValidation } from "@/lib/actions/member-validation";

type Ticket = {
  id: string;
  role: TicketRole;
  ticketPriceType: TicketPriceType;
};

type Props = {
  eventId: string;
  registrationId: string;
  current: MemberValidation;
  primaryTicket: Ticket | null;
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
};

const VALIDATION_LABELS: Record<MemberValidation, string> = {
  unknown: "Belum diverifikasi",
  valid: "Valid (member terkonfirmasi)",
  invalid: "Tidak valid (bukan member)",
  overridden: "Override manual",
};

export function MemberValidationPanel({
  eventId,
  registrationId,
  current,
  primaryTicket,
  ticketMemberPriceApplied,
  ticketNonMemberPriceApplied,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [validation, setValidation] = useState<MemberValidation>(current);
  const [newPriceType, setNewPriceType] = useState<TicketPriceType | "">(
    primaryTicket?.ticketPriceType ?? "",
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await overrideMemberValidation(eventId, registrationId, {
        validation,
        newPrimaryPriceType: newPriceType || undefined,
      });
      if (!res.ok) {
        setError(res.rootError ?? "Terjadi kesalahan.");
      } else {
        const msg = res.data.adjustmentCreated
          ? "Validasi diperbarui. Penyesuaian invoice kekurangan dibuat otomatis."
          : "Validasi diperbarui.";
        setResult(msg);
      }
    });
  }

  const delta =
    newPriceType === "non_member" && primaryTicket?.ticketPriceType === "member"
      ? ticketNonMemberPriceApplied - ticketMemberPriceApplied
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validasi member</CardTitle>
        <CardDescription>
          Status saat ini: <strong>{VALIDATION_LABELS[current]}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Status validasi</label>
            <Select
              value={validation}
              onValueChange={(v) => setValidation(v as MemberValidation)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VALIDATION_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {primaryTicket && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Tipe harga tiket utama</label>
              <Select
                value={newPriceType}
                onValueChange={(v) => setNewPriceType(v as TicketPriceType)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="non_member">Non-member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {delta > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Perubahan ini akan membuat invoice kekurangan sebesar{" "}
            <strong>
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(delta)}
            </strong>{" "}
            secara otomatis.
          </p>
        )}

        {result && <p className="text-sm text-emerald-700">{result}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          Simpan perubahan validasi
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3d: Create `src/components/admin/invoice-adjustment-panel.tsx`**

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import {
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createInvoiceAdjustment,
  markAdjustmentPaid,
  markAdjustmentUnpaid,
} from "@/lib/actions/invoice-adjustment";
import { uploadAdjustmentProof } from "@/lib/actions/upload-adjustment-proof";

type Adjustment = {
  id: string;
  type: InvoiceAdjustmentType;
  amount: number;
  status: InvoiceAdjustmentStatus;
  paidAt: Date | null;
  createdAt: Date;
  uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>;
};

type Props = {
  eventId: string;
  registrationId: string;
  adjustments: Adjustment[];
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function InvoiceAdjustmentPanel({ eventId, registrationId, adjustments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleCreate() {
    setCreateError(null);
    const parsed = parseInt(amount.replace(/\D/g, ""), 10);
    if (!parsed || parsed <= 0) {
      setCreateError("Masukkan jumlah yang valid.");
      return;
    }
    startTransition(async () => {
      const result = await createInvoiceAdjustment(eventId, {
        registrationId,
        type: InvoiceAdjustmentType.underpayment,
        amount: parsed,
      });
      if (!result.ok) {
        setCreateError(result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "));
      } else {
        setCreateOpen(false);
        setAmount("");
      }
    });
  }

  function handleMarkPaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentPaid(eventId, adjustmentId);
      if (!result.ok) setActionError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  function handleMarkUnpaid(adjustmentId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await markAdjustmentUnpaid(eventId, adjustmentId);
      if (!result.ok) setActionError(result.rootError ?? "Terjadi kesalahan.");
    });
  }

  function handleUploadProof(adjustmentId: string) {
    const input = fileRefs.current[adjustmentId];
    if (!input?.files?.[0]) return;
    const formData = new FormData();
    formData.set("adjustmentId", adjustmentId);
    formData.set("file", input.files[0]);
    setActionError(null);
    startTransition(async () => {
      const result = await uploadAdjustmentProof(eventId, formData);
      if (!result.ok) {
        setActionError(
          result.rootError ?? Object.values(result.fieldErrors ?? {}).join(", "),
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penyesuaian invoice</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {adjustments.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada penyesuaian.</p>
        )}

        {adjustments.map((adj) => (
          <div key={adj.id} className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{idr(adj.amount)}</span>
              <span
                className={
                  adj.status === "paid"
                    ? "text-emerald-700 font-medium"
                    : "text-amber-700 font-medium"
                }
              >
                {adj.status === "paid" ? "Lunas" : "Belum lunas"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {adj.type} · {new Date(adj.createdAt).toLocaleDateString("id-ID")}
            </div>

            {adj.uploads.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {adj.uploads.map((u) => (
                  <a
                    key={u.id}
                    href={u.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-muted-foreground hover:text-foreground"
                  >
                    Bukti ({Math.round(u.bytes / 1024)} KB)
                  </a>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center mt-1">
              {adj.status === "unpaid" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleMarkPaid(adj.id)}
                >
                  Tandai lunas
                </Button>
              )}
              {adj.status === "paid" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => handleMarkUnpaid(adj.id)}
                >
                  Batalkan lunas
                </Button>
              )}

              <div className="flex items-center gap-1">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={(el) => { fileRefs.current[adj.id] = el; }}
                  onChange={() => handleUploadProof(adj.id)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => fileRefs.current[adj.id]?.click()}
                >
                  Unggah bukti
                </Button>
              </div>
            </div>
          </div>
        ))}

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <Separator />

        {!createOpen ? (
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
            disabled={isPending}
          >
            + Tambah penyesuaian manual
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Tambah kekurangan pembayaran</p>
            <input
              type="number"
              min="1"
              placeholder="Jumlah (IDR)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm"
              disabled={isPending}
            />
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={isPending}>
                Buat penyesuaian
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setCreateOpen(false); setAmount(""); setCreateError(null); }}
                disabled={isPending}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3e: Create `src/components/admin/voucher-redemption-panel.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { TicketRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { redeemVoucher } from "@/lib/actions/voucher-redemption";

type Ticket = {
  id: string;
  role: TicketRole;
  fullName: string;
  voucherRedeemedMenuItemId: string | null;
  voucherRedeemedAt: Date | null;
};

type MenuItem = { id: string; name: string; price: number; voucherEligible: boolean };

type Props = {
  eventId: string;
  tickets: Ticket[];
  menuItems: MenuItem[]; // pre-filtered to voucherEligible only
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function VoucherRedemptionPanel({ eventId, tickets, menuItems }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleRedeem(ticketId: string) {
    const menuItemId = selections[ticketId];
    if (!menuItemId) {
      setErrors((prev) => ({ ...prev, [ticketId]: "Pilih menu item terlebih dahulu." }));
      return;
    }
    setErrors((prev) => ({ ...prev, [ticketId]: "" }));
    startTransition(async () => {
      const result = await redeemVoucher(eventId, ticketId, menuItemId);
      if (!result.ok) {
        setErrors((prev) => ({
          ...prev,
          [ticketId]: result.rootError ?? "Terjadi kesalahan.",
        }));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Penukaran voucher menu</CardTitle>
        <CardDescription>Pilih menu untuk setiap tiket voucher yang belum ditukarkan.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="text-sm font-medium">
              {ticket.fullName} ({ticket.role})
            </div>

            {ticket.voucherRedeemedMenuItemId ? (
              <p className="text-sm text-emerald-700">
                ✓ Sudah ditukar ·{" "}
                {ticket.voucherRedeemedAt
                  ? new Date(ticket.voucherRedeemedAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : ""}
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selections[ticket.id] ?? ""}
                  onValueChange={(v) =>
                    setSelections((prev) => ({ ...prev, [ticket.id]: v }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Pilih menu…" />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {idr(m.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => handleRedeem(ticket.id)}
                  disabled={isPending}
                >
                  Tukarkan
                </Button>
              </div>
            )}
            {errors[ticket.id] && (
              <p className="text-sm text-destructive">{errors[ticket.id]}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0. Fix any type mismatches between the page select and the component type.

- [ ] **Step 5: Commit**

```bash
git add \
  src/components/admin/attendance-panel.tsx \
  src/components/admin/cancel-refund-panel.tsx \
  src/components/admin/member-validation-panel.tsx \
  src/components/admin/invoice-adjustment-panel.tsx \
  src/components/admin/voucher-redemption-panel.tsx \
  src/components/admin/registration-detail.tsx \
  src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx
git commit -m "feat(admin): attendance, cancel/refund, member validation, adjustments, voucher panels"
```

---

## Task 11: Report queries module

**Files:**
- Create: `src/lib/reports/queries.ts`

- [ ] **Step 1: Create `src/lib/reports/queries.ts`**

```ts
import { RegistrationStatus, AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ParticipantStats = {
  total: number;
  byStatus: Partial<Record<RegistrationStatus, number>>;
  memberCount: number;
  nonMemberCount: number;
  partnerCount: number;
};

export type FinanceStats = {
  baselineTotal: number; // sum of computedTotalAtSubmit for approved registrations
  adjustmentsPaidTotal: number;
  adjustmentsUnpaidTotal: number;
  refundCount: number;
};

export type MenuStats =
  | { mode: "PRESELECT"; byItem: { name: string; count: number }[] }
  | { mode: "VOUCHER"; redeemed: number; notRedeemed: number };

export type AttendanceStats = {
  attended: number;
  noShow: number;
  unknown: number;
};

export type EventReport = {
  eventId: string;
  participant: ParticipantStats;
  finance: FinanceStats;
  menu: MenuStats;
  attendance: AttendanceStats;
};

export async function getEventReport(eventId: string): Promise<EventReport> {
  const [
    statusGroups,
    memberCount,
    partnerCount,
    financeAgg,
    adjustmentGroups,
    refundCount,
    attendanceGroups,
    event,
    menuSelections,
    ticketVoucherCounts,
  ] = await Promise.all([
    prisma.registration.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.registration.count({
      where: { eventId, claimedMemberNumber: { not: null } },
    }),
    prisma.ticket.count({
      where: { eventId, role: "partner" },
    }),
    prisma.registration.aggregate({
      where: { eventId, status: { in: ["approved", "attended"] } },
      _sum: { computedTotalAtSubmit: true },
    }),
    prisma.invoiceAdjustment.groupBy({
      by: ["status"],
      where: { registration: { eventId } },
      _sum: { amount: true },
    }),
    prisma.registration.count({
      where: { eventId, status: "refunded" },
    }),
    prisma.registration.groupBy({
      by: ["attendanceStatus"],
      where: { eventId },
      _count: { id: true },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { menuMode: true },
    }),
    prisma.ticketMenuSelection.groupBy({
      by: ["menuItemId"],
      where: { ticket: { eventId } },
      _count: { ticketId: true },
    }),
    prisma.ticket.count({ where: { eventId, voucherRedeemedMenuItemId: { not: null } } }),
  ]);

  const total = statusGroups.reduce((s, g) => s + g._count.id, 0);
  const byStatus: Partial<Record<RegistrationStatus, number>> = {};
  for (const g of statusGroups) {
    byStatus[g.status] = g._count.id;
  }

  const nonMemberCount = total - memberCount;

  const adjustmentPaidRow = adjustmentGroups.find((g) => g.status === "paid");
  const adjustmentUnpaidRow = adjustmentGroups.find((g) => g.status === "unpaid");

  const attendanceMap: Partial<Record<AttendanceStatus, number>> = {};
  for (const g of attendanceGroups) {
    attendanceMap[g.attendanceStatus] = g._count.id;
  }

  // Build menu stats
  let menu: MenuStats;
  if (event?.menuMode === "VOUCHER") {
    const totalTickets = await prisma.ticket.count({ where: { eventId } });
    menu = {
      mode: "VOUCHER",
      redeemed: ticketVoucherCounts,
      notRedeemed: totalTickets - ticketVoucherCounts,
    };
  } else {
    // Fetch menu item names for PRESELECT
    const itemIds = menuSelections.map((s) => s.menuItemId);
    const items = itemIds.length
      ? await prisma.eventMenuItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = Object.fromEntries(items.map((i) => [i.id, i.name]));
    menu = {
      mode: "PRESELECT",
      byItem: menuSelections.map((s) => ({
        name: nameById[s.menuItemId] ?? s.menuItemId,
        count: s._count.ticketId,
      })),
    };
  }

  return {
    eventId,
    participant: {
      total,
      byStatus,
      memberCount,
      nonMemberCount,
      partnerCount,
    },
    finance: {
      baselineTotal: financeAgg._sum.computedTotalAtSubmit ?? 0,
      adjustmentsPaidTotal: adjustmentPaidRow?._sum.amount ?? 0,
      adjustmentsUnpaidTotal: adjustmentUnpaidRow?._sum.amount ?? 0,
      refundCount,
    },
    menu,
    attendance: {
      attended: attendanceMap.attended ?? 0,
      noShow: attendanceMap.no_show ?? 0,
      unknown: attendanceMap.unknown ?? 0,
    },
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/queries.ts
git commit -m "feat(reports): per-event report aggregation queries"
```

---

## Task 12: Reports page + CSV export

**Files:**
- Create: `src/lib/reports/csv.ts`
- Create: `src/app/admin/events/[eventId]/report/page.tsx`
- Create: `src/app/admin/events/[eventId]/report/export/route.ts`

- [ ] **Step 1: Create `src/lib/reports/csv.ts`**

```ts
import { prisma } from "@/lib/db/prisma";

/** Returns a UTF-8 CSV string of all registrations for an event. */
export async function generateRegistrationsCsv(eventId: string): Promise<string> {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      claimedMemberNumber: true,
      memberValidation: true,
      status: true,
      attendanceStatus: true,
      computedTotalAtSubmit: true,
      tickets: {
        select: {
          role: true,
          fullName: true,
          whatsapp: true,
          memberNumber: true,
          ticketPriceType: true,
          voucherRedeemedMenuItemId: true,
          menuSelections: {
            select: { menuItem: { select: { name: true } } },
          },
        },
      },
      adjustments: {
        select: { type: true, amount: true, status: true },
      },
    },
  });

  const idr = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "decimal", maximumFractionDigits: 0 }).format(n);

  const headers = [
    "ID",
    "Tanggal daftar",
    "Nama kontak",
    "WhatsApp",
    "No. member",
    "Validasi member",
    "Status",
    "Kehadiran",
    "Total (IDR)",
    "Tiket utama",
    "Menu tiket utama",
    "Tiket partner",
    "Menu tiket partner",
    "Penyesuaian (IDR)",
  ];

  function escapeCsv(v: string): string {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  }

  const rows = registrations.map((r) => {
    const primary = r.tickets.find((t) => t.role === "primary");
    const partner = r.tickets.find((t) => t.role === "partner");
    const primaryMenu = primary?.menuSelections.map((s) => s.menuItem.name).join("; ") ?? "";
    const partnerMenu = partner?.menuSelections.map((s) => s.menuItem.name).join("; ") ?? "";
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0);

    return [
      r.id,
      new Date(r.createdAt).toLocaleDateString("id-ID"),
      r.contactName,
      r.contactWhatsapp,
      r.claimedMemberNumber ?? "",
      r.memberValidation,
      r.status,
      r.attendanceStatus,
      idr(r.computedTotalAtSubmit),
      primary?.fullName ?? "",
      primaryMenu,
      partner?.fullName ?? "",
      partnerMenu,
      adjustmentTotal > 0 ? idr(adjustmentTotal) : "",
    ]
      .map(String)
      .map(escapeCsv)
      .join(",");
  });

  return [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
}
```

- [ ] **Step 2: Create the reports page `src/app/admin/events/[eventId]/report/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { getEventReport } from "@/lib/reports/queries";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function EventReportPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) notFound();
  if (!canVerifyEvent(ctx, eventId)) notFound();

  const [event, report] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true, status: true },
    }),
    getEventReport(eventId),
  ]);

  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Laporan acara</h1>
          <p className="text-sm text-muted-foreground">{event.title}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/events/${eventId}/report/export`}
            className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent/60 transition-colors"
          >
            Unduh CSV
          </Link>
          <Link
            href={`/admin/events/${eventId}/inbox`}
            className="text-sm font-medium underline-offset-4 hover:underline self-center"
          >
            Kembali ke inbox
          </Link>
        </div>
      </header>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Peserta</CardTitle>
          <CardDescription>Total: {report.participant.total} pendaftaran</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Member" value={report.participant.memberCount} />
          <Stat label="Non-member" value={report.participant.nonMemberCount} />
          <Stat label="Partner" value={report.participant.partnerCount} />
          {Object.entries(report.participant.byStatus).map(([status, count]) => (
            <Stat key={status} label={status.replace(/_/g, " ")} value={count} />
          ))}
        </CardContent>
      </Card>

      {/* Finance */}
      <Card>
        <CardHeader>
          <CardTitle>Keuangan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total baseline (approved)" value={idr(report.finance.baselineTotal)} />
          <Stat label="Penyesuaian lunas" value={idr(report.finance.adjustmentsPaidTotal)} />
          <Stat label="Penyesuaian belum lunas" value={idr(report.finance.adjustmentsUnpaidTotal)} />
          <Stat label="Refund" value={`${report.finance.refundCount} pendaftaran`} />
        </CardContent>
      </Card>

      {/* Menu/Voucher */}
      <Card>
        <CardHeader>
          <CardTitle>Menu / Voucher</CardTitle>
        </CardHeader>
        <CardContent>
          {report.menu.mode === "PRESELECT" ? (
            <div className="flex flex-wrap gap-2">
              {report.menu.byItem.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada pemilihan menu.</p>
              )}
              {report.menu.byItem.map((item) => (
                <Badge key={item.name} variant="secondary">
                  {item.name}: {item.count}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Stat label="Voucher sudah ditukar" value={report.menu.redeemed} />
              <Stat label="Voucher belum ditukar" value={report.menu.notRedeemed} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Kehadiran</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stat label="Hadir" value={report.attendance.attended} />
          <Stat label="Tidak hadir" value={report.attendance.noShow} />
          <Stat label="Belum dicatat" value={report.attendance.unknown} />
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground capitalize">{label}</div>
      <div className="text-xl font-semibold font-mono tabular-nums">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create CSV export route `src/app/admin/events/[eventId]/report/export/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { generateRegistrationsCsv } from "@/lib/reports/csv";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const ctx = await getAdminContext(session.user.id);
  if (!ctx || !canVerifyEvent(ctx, eventId)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { slug: true },
  });
  if (!event) return new NextResponse("Not found", { status: 404 });

  const csv = await generateRegistrationsCsv(eventId);
  const filename = `registrations-${event.slug}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: TypeScript check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use && npx tsc --noEmit 2>&1
```

Expected: exits 0. Fix any Prisma groupBy type issues — `prisma.ticket.count` on `attendanceStatus` groupBy returns `AttendanceStatus`, not `string`.

- [ ] **Step 5: Add "Laporan" link from inbox page**

In `src/app/admin/events/[eventId]/inbox/page.tsx`, add a link to the report next to the page header:

```tsx
<Link
  href={`/admin/events/${eventId}/report`}
  className="text-sm font-medium underline-offset-4 hover:underline"
>
  Lihat laporan
</Link>
```

- [ ] **Step 6: Commit**

```bash
git add \
  src/lib/reports/csv.ts \
  src/app/admin/events/[eventId]/report/page.tsx \
  src/app/admin/events/[eventId]/report/export/route.ts \
  src/app/admin/events/[eventId]/inbox/page.tsx
git commit -m "feat(reports): per-event report page and CSV export"
```

---

## Self-review (plan author checklist)

**Spec coverage**

| Requirement | Tasks |
|-------------|-------|
| Attendance: attended / no_show | Tasks 4, 10 |
| Cancel / Refund transitions | Tasks 5, 10 |
| Member validation override + auto-adjustment | Tasks 6, 10 |
| Invoice adjustment: create, mark paid, upload proof | Tasks 7, 8, 10 |
| Payment-issue resolution loop | Covered via existing approve/reject + adjustment panel (Task 10) |
| Voucher redemption | Tasks 1, 9, 10 |
| Reports: participant, finance, menu, attendance | Tasks 11, 12 |
| CSV export | Task 12 |
| Extended WA templates (cancel/refund/underpayment) | Tasks 3, 10 |

**Explicitly out of scope for Plan #3A (Plan #3B):**
- Master Members CRUD
- PIC Bank Accounts CRUD
- Events create/edit (full form)
- Admin management (invite/role assignment)
- Global defaults (default ticket prices)

**Placeholder scan:** No TBD/TODO/FIXME in code blocks above.

**Type consistency:**
- `guardEvent` / `guardOwner` / `isAuthError` defined in Task 2, used identically in Tasks 4–9.
- `DetailRegistration.adjustments[].uploads` shape matches `uploadAdjustmentProof` DB write (Task 8).
- `InvoiceAdjustmentPanel` `Adjustment` type matches `DetailRegistration.adjustments` shape.
- `VoucherRedemptionPanel` receives `tickets` with `voucherRedeemedMenuItemId: string | null` (added to schema in Task 1, added to type in Task 10).
- `templateUnderpaymentInvoice` ctx type (`UnderpaymentInvoiceCtx`) matches usage in Task 10 JSX.
- Report page calls `getEventReport(eventId)` which returns `EventReport` — all fields used in the JSX are present on the type.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-ops-reporting-hardening.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`.

**2. Inline Execution** — Execute tasks in this session with checkpoints for review. **REQUIRED SUB-SKILL:** `superpowers:executing-plans`.

Which approach?
