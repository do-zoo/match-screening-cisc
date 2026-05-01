# Vertical Slice MVP (Public registration + Admin inbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first end-to-end flow: public users browse active events, register on `/events/[slug]` with transfer proof (and member card when claiming membership), land on a receipt in `pending_review`; admins open per-event inbox, open a registration, run approve / reject (reason) / payment_issue (reason), and fire WhatsApp click-to-chat templates.

**Architecture:** Public routes under `src/app/(public)/` use RSC for reads and Server Actions for `submitRegistration` (Zod validation → Prisma transaction for `Registration` + `Ticket`(s) + menu rows → `uploadImageForRegistration` for Blob → set `pending_review`). Admin routes under `src/app/admin/events/[eventId]/inbox` use RSC lists + guarded Server Actions that call `canVerifyEvent` from `src/lib/permissions/guards.ts` after loading `AdminProfile` + PIC helper assignments. WhatsApp uses `lib/wa-templates/*` (pure string builders + `wa.me` URL encoding). Menu PRESELECT and VOUCHER are both supported at submit time using new `EventMenuItem` + `TicketMenuSelection` tables (current Prisma schema has events/tickets but no menu entities).

**Tech Stack:** Next.js 16 App Router, Prisma + Neon Postgres, Better Auth (existing), Vercel Blob + existing `uploadImageForRegistration`, Zod, React Hook Form, shadcn/ui (extend under `src/components/ui`), Vitest.

**Context:** Run in a dedicated git worktree if your team uses the brainstorming worktree workflow; not required for execution.

---

## File structure (locked)

**Create:**

| File                                                                                                                                             | Responsibility                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `prisma/schema.prisma`                                                                                                                           | Add `EventMenuItem`, `TicketMenuSelection`; relation fields on `Event`, `Ticket`     |
| `prisma/migrations/<timestamp>_menu_items/migration.sql`                                                                                         | Generated after schema change (`prisma migrate dev`)                                 |
| `src/lib/pricing/compute-submit-total.ts`                                                                                                        | Locked IDR totals for primary (+ optional partner) + menu voucher or PRESELECT lines |
| `src/lib/pricing/compute-submit-total.test.ts`                                                                                                   | Vitest coverage for voucher / preselect / partner privilege                          |
| `src/lib/wa-templates/encode.ts`                                                                                                                 | `normalizeIdPhone`, `waMeLink`                                                       |
| `src/lib/wa-templates/messages.ts`                                                                                                               | Template bodies (receipt, payment issue, approve, reject) — parameterized            |
| `src/lib/wa-templates/messages.test.ts`                                                                                                          | Stable encoding / line breaks                                                        |
| `src/lib/auth/admin-context.ts`                                                                                                                  | `getAdminContext(authUserId)` → `{ role, helperEventIds, memberId }`                 |
| `src/lib/registrations/duplicate-members.ts`                                                                                                     | `assertNoDuplicateMemberNumbersForEvent` query helper                                |
| `src/lib/actions/submit-registration.ts`                                                                                                         | `submitRegistration` Server Action + Zod schema                                      |
| `src/lib/actions/verify-registration.ts`                                                                                                         | `approveRegistration`, `rejectRegistration`, `markPaymentIssue` Server Actions       |
| `src/app/(public)/page.tsx`                                                                                                                      | Move/replace root: list `Event` where `status === active`                            |
| `src/app/(public)/layout.tsx`                                                                                                                    | Optional: public chrome (can be minimal)                                             |
| `src/app/(public)/events/[slug]/page.tsx`                                                                                                        | Registration form (client section for uploads)                                       |
| `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx`                                                                              | Receipt + bank instructions + status badge                                           |
| `src/components/public/event-card.tsx`                                                                                                           | Link to `/events/[slug]`                                                             |
| `src/components/public/registration-form.tsx`                                                                                                    | RHF + Zod + file inputs + submit                                                     |
| `src/components/public/price-breakdown.tsx`                                                                                                      | Display computed IDR lines                                                           |
| `src/components/admin/registration-status-badge.tsx`                                                                                             | Maps `RegistrationStatus` → design-system colors                                     |
| `src/components/admin/inbox-table.tsx`                                                                                                           | Table + filters                                                                      |
| `src/components/admin/registration-detail.tsx`                                                                                                   | Detail + action buttons + WA links                                                   |
| `src/app/admin/events/[eventId]/inbox/page.tsx`                                                                                                  | Inbox list                                                                           |
| `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx`                                                                                 | Detail page                                                                          |
| `prisma/seed.ts`                                                                                                                                 | Demo event + PIC + menu + helpers (optional admin id via env)                        |
| `src/components/ui/badge.tsx`, `card.tsx`, `table.tsx`, `textarea.tsx`, `select.tsx`, `alert.tsx`, `separator.tsx`, `skeleton.tsx`, `dialog.tsx` | shadcn primitives as needed                                                          |

**Modify:**

| File                      | Change                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`        | Remove or re-export redirect to `(public)` — **prefer** deleting root `page.tsx` and using `src/app/(public)/page.tsx` as `/` only (Next route groups do not affect URL). Ensure exactly one `page.tsx` serves `/`. |
| `package.json`            | Add `"prisma": { "seed": "tsx prisma/seed.ts" }"` and devDependency `tsx` if missing                                                                                                                                |
| `src/lib/auth/session.ts` | Optionally export `requireAdminSession` throw mapping to `never` for actions (already throws)                                                                                                                       |

**Do not move** `src/proxy.ts` — it already gates `/admin/**` per Next 16 proxy convention.

## Bootstrap AdminProfile (manual, before QA)

Better Auth persists users outside Prisma `AdminProfile`; the admin home screen shows `UNKNOWN (no AdminProfile)` until linked.

- Sign up/in at `/admin/sign-in`, copy `session.user.id` from the existing `/admin` page or add a temporary `console.log` in session code.
- Create `AdminProfile` with Prisma Studio (`npx prisma studio`): new row with `authUserId` set to that id, `role` = **Owner**.
- Alternative one-off script:

```ts
import { prisma } from "./src/lib/db/prisma";
await prisma.adminProfile.create({
  data: { authUserId: "<paste-auth-user-id-here>", role: "Owner" },
});
```

If you need PIC-helper verification tests, set `memberId` to the seeded PIC `MasterMember` id and insert `EventPicHelper` rows for the demo event.

---

## Task 1: Prisma — menu entities + migration

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/*_menu_items_for_vertical_slice/migration.sql` (via CLI)
- Test: `npx prisma validate`

- [ ] **Step 1: Append models and relations to `prisma/schema.prisma`**

Add these models and extend `Event` and `Ticket` (keep existing field order style in your file; append new relations at end of `Event` and `Ticket` models):

```prisma
model EventMenuItem {
  id     String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)

  name    String
  /// IDR smallest unit (consistent with ticket prices).
  price   Int
  sortOrder Int @default(0)
  voucherEligible Boolean @default(false)

  selections TicketMenuSelection[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([eventId])
}

model TicketMenuSelection {
  ticketId String
  ticket   Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  menuItemId String
  menuItem   EventMenuItem @relation(fields: [menuItemId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())

  @@id([ticketId, menuItemId])
  @@index([menuItemId])
}
```

On `model Event` add:

```prisma
  menuItems EventMenuItem[]
```

On `model Ticket` add:

```prisma
  menuSelections TicketMenuSelection[]
```

- [ ] **Step 2: Run migrate**

Run:

```bash
cd /Users/mac/Documents/CISC/match-screening
npx prisma migrate dev --name menu_items_for_vertical_slice
```

Expected: migration creates new tables; `prisma migrate dev` succeeds.

- [ ] **Step 3: Regenerate client**

Run:

```bash
npx prisma generate
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add EventMenuItem and TicketMenuSelection for menu slice"
```

---

## Task 2: Pricing — compute locked total (unit-tested)

**Files:**

- Create: `src/lib/pricing/compute-submit-total.ts`
- Create: `src/lib/pricing/compute-submit-total.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/pricing/compute-submit-total.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  computeSubmitTotal,
  type SubmitPricingInput,
} from "@/lib/pricing/compute-submit-total";

const baseEvent = {
  ticketMemberPrice: 100_000,
  ticketNonMemberPrice: 150_000,
  menuMode: "PRESELECT" as const,
  voucherPrice: null as number | null,
};

describe("computeSubmitTotal", () => {
  it("single non-member PRESELECT sums ticket + menu", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "PRESELECT", voucherPrice: null },
      primaryPriceType: "non_member",
      includePartner: false,
      perTicketMenu: [
        { mode: "PRESELECT", selectedMenuItems: [{ price: 50_000 }] },
      ],
    };
    expect(computeSubmitTotal(input)).toEqual({
      ticketMemberPriceApplied: 100_000,
      ticketNonMemberPriceApplied: 150_000,
      voucherPriceApplied: null,
      computedTotalAtSubmit: 200_000,
    });
  });

  it("member + partner privilege uses member price for partner ticket (voucher mode)", () => {
    const input: SubmitPricingInput = {
      event: { ...baseEvent, menuMode: "VOUCHER", voucherPrice: 75_000 },
      primaryPriceType: "member",
      includePartner: true,
      perTicketMenu: [{ mode: "VOUCHER" }, { mode: "VOUCHER" }],
    };
    expect(computeSubmitTotal(input).computedTotalAtSubmit).toBe(
      100_000 + 75_000 + 100_000 + 75_000
    );
  });
});
```

Run:

```bash
npm test -- src/lib/pricing/compute-submit-total.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 2: Implement `compute-submit-total.ts`**

Create `src/lib/pricing/compute-submit-total.ts`:

```ts
import type { MenuMode, TicketPriceType } from "@prisma/client";

export type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
    menuMode: MenuMode;
    voucherPrice: number | null;
  };
  primaryPriceType: Extract<TicketPriceType, "member" | "non_member">;
  includePartner: boolean;
  perTicketMenu: Array<
    | { mode: "PRESELECT"; selectedMenuItems: { price: number }[] }
    | { mode: "VOUCHER" }
  >;
};

export type SubmitPricingResult = {
  ticketMemberPriceApplied: number;
  ticketNonMemberPriceApplied: number;
  voucherPriceApplied: number | null;
  computedTotalAtSubmit: number;
};

function ticketLineRupiah(
  input: SubmitPricingInput,
  ticket: {
    role: "primary" | "partner";
    priceType: TicketPriceType;
  }
): number {
  const { event } = input;
  if (ticket.priceType === "non_member") return event.ticketNonMemberPrice;
  if (ticket.priceType === "member") return event.ticketMemberPrice;
  return event.ticketMemberPrice;
}

function menuLineRupiah(
  event: SubmitPricingInput["event"],
  ent: SubmitPricingInput["perTicketMenu"][number]
): number {
  if (event.menuMode === "VOUCHER") {
    if (event.voucherPrice == null) {
      throw new Error("voucherPrice required for VOUCHER menu mode");
    }
    return event.voucherPrice;
  }
  if (ent.mode !== "PRESELECT") {
    throw new Error("PRESELECT requires selected menus per ticket");
  }
  return ent.selectedMenuItems.reduce((s, i) => s + i.price, 0);
}

export function computeSubmitTotal(
  input: SubmitPricingInput
): SubmitPricingResult {
  const ticketMemberPriceApplied = input.event.ticketMemberPrice;
  const ticketNonMemberPriceApplied = input.event.ticketNonMemberPrice;
  const voucherPriceApplied =
    input.event.menuMode === "VOUCHER" ? input.event.voucherPrice : null;

  const primaryType: TicketPriceType =
    input.primaryPriceType === "member" ? "member" : "non_member";

  const lines: number[] = [];

  lines.push(
    ticketLineRupiah(input, { role: "primary", priceType: primaryType })
  );
  lines.push(menuLineRupiah(input.event, input.perTicketMenu[0]));

  if (input.includePartner) {
    lines.push(
      ticketLineRupiah(input, {
        role: "partner",
        priceType: "privilege_partner_member_price",
      })
    );
    lines.push(menuLineRupiah(input.event, input.perTicketMenu[1]));
  }

  const computedTotalAtSubmit = lines.reduce((a, b) => a + b, 0);

  return {
    ticketMemberPriceApplied,
    ticketNonMemberPriceApplied,
    voucherPriceApplied,
    computedTotalAtSubmit,
  };
}
```

Run:

```bash
npm test -- src/lib/pricing/compute-submit-total.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing/compute-submit-total.ts src/lib/pricing/compute-submit-total.test.ts
git commit -m "feat(pricing): compute locked submit totals"
```

---

## Task 3: WhatsApp helpers + tests

**Files:**

- Create: `src/lib/wa-templates/encode.ts`
- Create: `src/lib/wa-templates/messages.ts`
- Create: `src/lib/wa-templates/messages.test.ts`

- [ ] **Step 1: Implement encode utilities**

Create `src/lib/wa-templates/encode.ts`:

```ts
/**
 * Normalize Indonesian WhatsApp digits to international form without '+' (wa.me expects country code numeric only).
 */
export function normalizeIdPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.length >= 9) return `62${digits}`;
  return digits;
}

export function waMeLink(phone: string, message: string): string {
  const n = normalizeIdPhone(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 2: Implement minimum templates from design spec §7.2**

Create `src/lib/wa-templates/messages.ts`:

```ts
export type RegistrationMessageCtx = {
  contactName: string;
  eventTitle: string;
  registrationId: string;
  computedTotalIdr: number;
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export function templateReceipt(c: RegistrationMessageCtx): string {
  return [
    `Halo ${c.contactName},`,
    ``,
    `Terima kasih — pendaftaran untuk *${c.eventTitle}* sudah kami terima.`,
    `ID: \`${c.registrationId}\``,
    `Total (snapshot): *${idr(c.computedTotalIdr)}*`,
    `Status: *menunggu verifikasi admin*.`,
  ].join("\n");
}

export function templatePaymentIssue(reason: string): string {
  return [
    `Halo,`,
    ``,
    `Kami perlu klarifikasi terkait bukti transfer:`,
    reason,
    ``,
    `Mohon balas pesan ini setelah menyesuaikan / mengunggah ulang bukti sesuai arahan.`,
  ].join("\n");
}

export function templateApproved(
  eventTitle: string,
  venue: string,
  startAtIso: string
): string {
  const when = new Date(startAtIso).toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  return [
    `Selamat — pendaftaran untuk *${eventTitle}* *disetujui*.`,
    ``,
    `Detail acara: ${venue}`,
    `Waktu: ${when}`,
  ].join("\n");
}

export function templateRejected(reason: string): string {
  return [
    `Mohon maaf, pendaftaran belum dapat kami proses.`,
    ``,
    `Alasan:`,
    reason,
  ].join("\n");
}
```

- [ ] **Step 3: Write tests**

Create `src/lib/wa-templates/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { templateReceipt } from "@/lib/wa-templates/messages";
import { waMeLink } from "@/lib/wa-templates/encode";

describe("wa templates", () => {
  it("builds wa.me with encoded text", () => {
    const url = waMeLink("081234567890", "Halo & test");
    expect(url).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Halo & test");
  });

  it("includes registration id in receipt", () => {
    const body = templateReceipt({
      contactName: "A",
      eventTitle: "Final UCL",
      registrationId: "reg_1",
      computedTotalIdr: 250000,
    });
    expect(body).toContain("reg_1");
    expect(body).toContain("menunggu verifikasi");
  });
});
```

Run:

```bash
npm test -- src/lib/wa-templates/messages.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wa-templates
git commit -m "feat(wa): add wa.me encoding and admin message templates"
```

---

## Task 4: Admin context loader (for guards)

**Files:**

- Create: `src/lib/auth/admin-context.ts`
- Modify: `src/lib/permissions/guards.ts` (only if you need a typed import re-export; optional)

- [ ] **Step 1: Implement loader**

Create `src/lib/auth/admin-context.ts`:

```ts
import type { AdminContext } from "@/lib/permissions/guards";
import type { AdminRole } from "@/lib/permissions/roles";
import { prisma } from "@/lib/db/prisma";

export async function getAdminContext(
  authUserId: string
): Promise<AdminContext | null> {
  const profile = await prisma.adminProfile.findUnique({
    where: { authUserId },
    include: {
      member: {
        include: {
          eventsAsHelper: { select: { eventId: true } },
        },
      },
    },
  });
  if (!profile) return null;

  const helperEventIds =
    profile.member?.eventsAsHelper.map((e) => e.eventId) ?? [];

  return {
    role: profile.role as AdminRole,
    helperEventIds,
  };
}
```

- [ ] **Step 2: Manual typecheck**

Run:

```bash
cd /Users/mac/Documents/CISC/match-screening
npx tsc --noEmit
```

Expected: no errors (fix imports if Prisma client types differ).

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/admin-context.ts
git commit -m "feat(auth): load admin context with PIC helper event ids"
```

---

## Task 5: Duplicate member guard

**Files:**

- Create: `src/lib/registrations/duplicate-members.ts`
- Create: `src/lib/registrations/duplicate-members.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/registrations/duplicate-members.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";

describe("findDuplicateMemberNumbers", () => {
  beforeEach(() => {
    vi.mocked(prisma.ticket.findMany).mockReset();
  });

  it("returns duplicates when DB has same member on event", async () => {
    vi.mocked(prisma.ticket.findMany).mockResolvedValueOnce([
      { memberNumber: "123" } as never,
    ]);
    const d = await findDuplicateMemberNumbers("evt", ["123"]);
    expect(d).toEqual(["123"]);
  });
});
```

Run `npm test -- src/lib/registrations/duplicate-members.test.ts` — expect FAIL (missing export).

- [ ] **Step 2: Implement**

Create `src/lib/registrations/duplicate-members.ts`:

```ts
import { prisma } from "@/lib/db/prisma";

export async function findDuplicateMemberNumbers(
  eventId: string,
  candidates: string[]
): Promise<string[]> {
  const nums = [...new Set(candidates.filter(Boolean))];
  if (nums.length === 0) return [];

  const existing = await prisma.ticket.findMany({
    where: { eventId, memberNumber: { in: nums } },
    select: { memberNumber: true },
  });

  const set = new Set(
    existing.map((e) => e.memberNumber).filter(Boolean) as string[]
  );
  return nums.filter((n) => set.has(n));
}
```

Run `npm test -- src/lib/registrations/duplicate-members.test.ts` — expect PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/registrations/duplicate-members.ts src/lib/registrations/duplicate-members.test.ts
git commit -m "feat(registrations): detect duplicate member numbers per event"
```

---

## Task 6: Server Action — submit registration

**Files:**

- Create: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/uploads/upload-image.ts` (no change if signature already matches)
- Depends on: Task 1–2, 5

This task is long; keep **one** Server Action file with Zod schema co-located.

- [ ] **Step 1: Add Zod + action skeleton with `export type` for the form**

Create `src/lib/actions/submit-registration.ts` with the following complete content:

```ts
"use server";

import { z } from "zod";
import { MenuMode, MenuSelection, RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { findDuplicateMemberNumbers } from "@/lib/registrations/duplicate-members";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";
import {
  ok,
  fieldError,
  rootError,
  type ActionResult,
} from "@/lib/forms/action-result";
import { del } from "@vercel/blob";

const phone = z.string().trim().min(8, "WhatsApp wajib diisi");

const baseSchema = z.object({
  slug: z.string().trim().min(1),
  contactName: z.string().trim().min(2, "Nama wajib diisi"),
  contactWhatsapp: phone,
  claimedMemberNumber: z.string().trim().optional(),
  qtyPartner: z.union([z.literal(0), z.literal(1)]),
  partnerName: z.string().trim().optional(),
  partnerWhatsapp: z.string().trim().optional(),
  partnerMemberNumber: z.string().trim().optional(),
  selectedMenuItemIds: z.array(z.string()).optional(),
});

export type SubmitRegistrationInput = z.infer<typeof baseSchema>;

export async function submitRegistration(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult<{ registrationId: string }>> {
  const raw = Object.fromEntries(formData.entries());
  const qtyPartnerNorm: 0 | 1 =
    String(raw.qtyPartner ?? "0").trim() === "1" ? 1 : 0;
  const selectedMenuItemIds = formData
    .getAll("selectedMenuItemIds")
    .map(String)
    .filter(Boolean);

  const parsed = baseSchema.safeParse({
    ...raw,
    qtyPartner: qtyPartnerNorm,
    selectedMenuItemIds,
  });

  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const p = issue.path[0];
      if (typeof p === "string") fe[p] = issue.message;
    }
    return fieldError(fe);
  }

  const data = parsed.data;

  const event = await prisma.event.findFirst({
    where: { slug: data.slug, status: "active" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!event) {
    return rootError("Event tidak tersedia atau belum aktif.");
  }

  const transferProof = formData.get("transferProof");
  const memberCard = formData.get("memberCardPhoto");

  if (!(transferProof instanceof File) || transferProof.size === 0) {
    return fieldError({ transferProof: "Unggah bukti transfer wajib." });
  }

  const claimingMember = Boolean(data.claimedMemberNumber?.trim());
  if (claimingMember) {
    if (!(memberCard instanceof File) || memberCard.size === 0) {
      return fieldError({
        memberCardPhoto: "Foto kartu member wajib jika nomor member diisi.",
      });
    }
  }

  const primaryMemberNumber = data.claimedMemberNumber?.trim() || undefined;
  const partnerMemberNumber = data.partnerMemberNumber?.trim() || undefined;

  const candidates = [primaryMemberNumber, partnerMemberNumber].filter(
    Boolean
  ) as string[];

  const dup = await findDuplicateMemberNumbers(event.id, candidates);
  if (dup.length > 0) {
    return rootError(
      `Nomor member berikut sudah terdaftar untuk acara ini: ${dup.join(", ")}`
    );
  }

  let picMaster = null as { isPengurus: boolean } | null;
  if (primaryMemberNumber) {
    picMaster = await prisma.masterMember.findFirst({
      where: { memberNumber: primaryMemberNumber, isActive: true },
      select: { isPengurus: true },
    });
  }

  if (data.qtyPartner === 1) {
    if (!data.partnerName?.trim()) {
      return fieldError({
        partnerName: "Nama partner wajib jika membawa partner.",
      });
    }
    if (!picMaster?.isPengurus) {
      return rootError(
        "Tiket partner hanya untuk pengurus (komite) — validasi nomor member utama."
      );
    }
  }

  const primaryIsMemberPrice = Boolean(primaryMemberNumber);

  const menuParts: Parameters<typeof computeSubmitTotal>[0]["perTicketMenu"] =
    [];

  if (event.menuMode === MenuMode.VOUCHER) {
    menuParts.push({ mode: "VOUCHER" });
    if (data.qtyPartner === 1) menuParts.push({ mode: "VOUCHER" });
  } else {
    const ids = data.selectedMenuItemIds ?? [];
    if (event.menuSelection === MenuSelection.SINGLE && ids.length !== 1) {
      return fieldError({
        selectedMenuItemIds: "Pilih tepat satu menu.",
      });
    }
    if (event.menuSelection === MenuSelection.MULTI && ids.length < 1) {
      return fieldError({ selectedMenuItemIds: "Pilih minimal satu menu." });
    }
    const items = event.menuItems.filter((m) => ids.includes(m.id));
    if (items.length !== ids.length) {
      return rootError("Menu tidak valid untuk acara ini.");
    }
    menuParts.push({
      mode: "PRESELECT",
      selectedMenuItems: items.map((i) => ({ price: i.price })),
    });
    if (data.qtyPartner === 1) {
      menuParts.push({
        mode: "PRESELECT",
        selectedMenuItems: items.map((i) => ({ price: i.price })),
      });
    }
  }

  const pricing = computeSubmitTotal({
    event: {
      ticketMemberPrice: event.ticketMemberPrice,
      ticketNonMemberPrice: event.ticketNonMemberPrice,
      menuMode: event.menuMode,
      voucherPrice: event.voucherPrice,
    },
    primaryPriceType: primaryIsMemberPrice ? "member" : "non_member",
    includePartner: data.qtyPartner === 1,
    perTicketMenu: menuParts,
  });

  let registrationId = "";

  try {
    const reg = await prisma.$transaction(async (tx) => {
      const registration = await tx.registration.create({
        data: {
          eventId: event.id,
          contactName: data.contactName,
          contactWhatsapp: data.contactWhatsapp,
          claimedMemberNumber: primaryMemberNumber ?? null,
          ticketMemberPriceApplied: pricing.ticketMemberPriceApplied,
          ticketNonMemberPriceApplied: pricing.ticketNonMemberPriceApplied,
          voucherPriceApplied: pricing.voucherPriceApplied,
          computedTotalAtSubmit: pricing.computedTotalAtSubmit,
          status: RegistrationStatus.submitted,
        },
      });

      registrationId = registration.id;

      await tx.ticket.create({
        data: {
          registrationId: registration.id,
          eventId: event.id,
          role: "primary",
          fullName: data.contactName,
          whatsapp: data.contactWhatsapp,
          memberNumber: primaryMemberNumber ?? null,
          ticketPriceType: primaryIsMemberPrice ? "member" : "non_member",
        },
      });

      if (data.qtyPartner === 1 && data.partnerName) {
        await tx.ticket.create({
          data: {
            registrationId: registration.id,
            eventId: event.id,
            role: "partner",
            fullName: data.partnerName.trim(),
            whatsapp: data.partnerWhatsapp?.trim() || null,
            memberNumber: partnerMemberNumber ?? null,
            ticketPriceType: "privilege_partner_member_price",
          },
        });
      }

      if (event.menuMode === MenuMode.PRESELECT) {
        const tickets = await tx.ticket.findMany({
          where: { registrationId: registration.id },
        });
        const idsMenu = data.selectedMenuItemIds ?? [];
        for (const t of tickets) {
          for (const mid of idsMenu) {
            await tx.ticketMenuSelection.create({
              data: { ticketId: t.id, menuItemId: mid },
            });
          }
        }
      }

      return registration;
    });

    await uploadImageForRegistration({
      purpose: "transfer_proof",
      registrationId: reg.id,
      file: transferProof,
    });

    if (claimingMember && memberCard instanceof File) {
      await uploadImageForRegistration({
        purpose: "member_card_photo",
        registrationId: reg.id,
        file: memberCard,
      });
    }

    await prisma.registration.update({
      where: { id: reg.id },
      data: { status: RegistrationStatus.pending_review },
    });

    return ok({ registrationId: reg.id });
  } catch (e) {
    if (registrationId) {
      const uploads = await prisma.upload.findMany({
        where: { registrationId },
        select: { blobUrl: true },
      });
      for (const u of uploads) {
        try {
          await del(u.blobUrl);
        } catch {
          /* best-effort */
        }
      }
      await prisma.registration
        .delete({ where: { id: registrationId } })
        .catch(() => {});
    }
    console.error(e);
    return rootError("Gagal menyimpan pendaftaran. Coba lagi.");
  }
}
```

- [ ] **Step 2: Fix Prisma delegate name**

Use the interactive transaction client delegate that matches Prisma Client (typically `tx.ticketMenuSelection.create`). Run `prisma generate` and fix casing if TypeScript reports an unknown delegate.

Run `npx tsc --noEmit` and fix any delegate naming.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/submit-registration.ts
git commit -m "feat(actions): submit registration with uploads and pending_review"
```

---

## Task 7: Public pages — home + registration + receipt

**Files:**

- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/page.tsx`
- Delete: `src/app/page.tsx` (the default starter) OR replace content — **must leave a single `/` route**
- Create: `src/app/(public)/events/[slug]/page.tsx`
- Create: `src/app/(public)/events/[slug]/register/[registrationId]/page.tsx`
- Create: `src/components/public/registration-form.tsx`
- Create: `src/components/public/event-card.tsx`
- Modify: `src/app/layout.tsx` — set `metadata.title` to product name (optional)

- [ ] **Step 1: Public home queries active events**

`src/app/(public)/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function PublicHomePage() {
  const events = await prisma.event.findMany({
    where: { status: "active" },
    orderBy: { startAt: "asc" },
    select: {
      slug: true,
      title: true,
      startAt: true,
      venueName: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">
          Nobar — acara aktif
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Pilih acara untuk mendaftar.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {events.map((e) => (
          <li key={e.slug}>
            <Link
              className="block rounded-lg border border-border bg-card p-4 hover:bg-accent/40"
              href={`/events/${e.slug}`}
            >
              <div className="font-medium">{e.title}</div>
              <div className="mt-1 text-muted-foreground text-sm">
                {e.venueName} ·{" "}
                {new Date(e.startAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada acara aktif.</p>
      ) : null}
    </main>
  );
}
```

Remove conflicting `src/app/page.tsx` if present so `(public)/page.tsx` owns `/`.

- [ ] **Step 2: Registration page loads event + menus**

Use a server component wrapper that passes props to client `RegistrationForm`. Implementation requirement: `<RegistrationForm slug={slug} event={serialized} />` where `serialized` matches a explicit type exported from `submit-registration.ts` or a dedicated `types.ts` — **keep props JSON-serializable** (Dates as ISO strings).

- [ ] **Step 3: Receipt page verifies slug + registration**

Query `registration` including `event` where `event.slug === slug` and `registration.id === registrationId`; if not found, `notFound()`.

Show: status badge `pending_review`, bank account from `event.bankAccount`, `computedTotalAtSubmit` in IDR.

- [ ] **Step 4: Commit**

```bash
git add src/app/(public) src/components/public src/app/page.tsx
git commit -m "feat(public): active events list, registration, receipt"
```

_(Adjust `git add` paths if `page.tsx` was delete vs modify.)_

---

## Task 8: shadcn components needed for admin + public

- [ ] **Step 1: Add components**

From project root:

```bash
cd /Users/mac/Documents/CISC/match-screening
npx shadcn@latest add badge card table textarea select alert separator skeleton dialog
```

If the CLI asks for path, align with existing `src/components/ui`.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui
git commit -m "chore(ui): add shadcn components for inbox and forms"
```

---

## Task 9: Admin inbox list + detail UI

**Files:**

- Create: `src/app/admin/events/[eventId]/inbox/page.tsx`
- Create: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx`
- Create: `src/components/admin/registration-status-badge.tsx`
- Create: `src/components/admin/inbox-table.tsx`
- Create: `src/components/admin/registration-detail.tsx`

- [ ] **Step 1: Inbox list server component**

`src/app/admin/events/[eventId]/inbox/page.tsx` must:

1. `await requireAdminSession()`
2. `const ctx = await getAdminContext(session.user.id)` — if `!ctx`, show "Missing AdminProfile"
3. If `!canVerifyEvent(ctx, params.eventId)` return `notFound()` or forbidden message
4. `findMany` registrations for `eventId` with `orderBy: { createdAt: "desc" }`, include primary ticket contact fields

Use design colors: badge per §4.1 UI spec (`pending_review` slate/blue tint, `payment_issue` amber, `approved` green, `rejected` destructive).

- [ ] **Step 2: Detail page**

Include: contact, WhatsApp, claimed member, thumbnails linking Blob URL for uploads (use `<a target="_blank" rel="noopener">`), computed total mono font, ticket rows.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/events src/components/admin
git commit -m "feat(admin): event registration inbox list and detail"
```

---

## Task 10: Admin verification Server Actions

**Files:**

- Create: `src/lib/actions/verify-registration.ts`

- [ ] **Step 1: Implement guarded mutations**

Create `src/lib/actions/verify-registration.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canVerifyEvent } from "@/lib/permissions/guards";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";

async function guard(eventId: string) {
  const session = await requireAdminSession();
  const ctx = await getAdminContext(session.user.id);
  if (!ctx) throw new Error("NO_PROFILE");
  if (!canVerifyEvent(ctx, eventId)) throw new Error("FORBIDDEN");
}

export async function approveRegistration(
  eventId: string,
  registrationId: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const r = await prisma.registration.findFirst({
    where: { id: registrationId, eventId },
  });
  if (!r) return rootError("Pendaftaran tidak ditemukan.");

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: RegistrationStatus.approved,
      rejectionReason: null,
      paymentIssueReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function rejectRegistration(
  eventId: string,
  registrationId: string,
  reason: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const trimmed = reason.trim();
  if (!trimmed) return rootError("Alasan penolakan wajib diisi.");

  await prisma.registration.update({
    where: { id: registrationId, eventId },
    data: {
      status: RegistrationStatus.rejected,
      rejectionReason: trimmed,
      paymentIssueReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}

export async function markPaymentIssue(
  eventId: string,
  registrationId: string,
  reason: string
): Promise<ActionResult<{ ok: true }>> {
  try {
    await guard(eventId);
  } catch {
    return rootError("Tidak diizinkan.");
  }

  const trimmed = reason.trim();
  if (!trimmed) return rootError("Alasan masalah pembayaran wajib diisi.");

  await prisma.registration.update({
    where: { id: registrationId, eventId },
    data: {
      status: RegistrationStatus.payment_issue,
      paymentIssueReason: trimmed,
      rejectionReason: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/inbox`);
  revalidatePath(`/admin/events/${eventId}/inbox/${registrationId}`);
  return ok({ ok: true });
}
```

Wire these from `registration-detail.tsx` using `<form action={...}>` or client `useTransition` with `toast` feedback.

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/verify-registration.ts src/components/admin/registration-detail.tsx
git commit -m "feat(admin): approve, reject, and payment_issue actions"
```

---

## Task 11: WhatsApp buttons on admin detail

- [ ] **Step 1: Add button row**

On `registration-detail.tsx`, compute `participantPhone = partnerWhatsappPrimary ?? contactWhatsapp` per spec §6 edge case defaults (for MVP use primary ticket WhatsApp = `contactWhatsapp` — spec: partner empty → templates go to primary).

Render links:

```tsx
<a
  className={...}
  href={waMeLink(participantPhone, templateReceipt(...))}
  target="_blank"
  rel="noopener noreferrer"
>
  WhatsApp · receipt template
</a>
```

Add similar for `templatePaymentIssue`, `templateApproved`, `templateRejected` with appropriate placeholders (reuse `registration.event` columns).

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/registration-detail.tsx
git commit -m "feat(admin): wa.me shortcuts for inbox templates"
```

---

## Task 12: Seed script (demo horizontal slice)

**Files:**

- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Install tsx**

```bash
npm i -D tsx
```

- [ ] **Step 2: Create `prisma/seed.ts`**

Use this complete script (updates emails if collision — engineer may tweak names):

```ts
import "dotenv/config";
import {
  PrismaClient,
  EventStatus,
  MenuMode,
  MenuSelection,
  PricingSource,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pic = await prisma.masterMember.upsert({
    where: { memberNumber: "CISC-DEMO-PIC-1" },
    update: {},
    create: {
      memberNumber: "CISC-DEMO-PIC-1",
      fullName: "Demo PIC Pengurus",
      isActive: true,
      isPengurus: true,
      canBePIC: true,
    },
  });

  const bank = await prisma.picBankAccount.create({
    data: {
      ownerMemberId: pic.id,
      bankName: "BCA",
      accountNumber: "1234567890",
      accountName: "Demo CISC Tangsel",
      isActive: true,
    },
  });

  const event = await prisma.event.upsert({
    where: { slug: "demo-final-ucl-2026" },
    update: {},
    create: {
      slug: "demo-final-ucl-2026",
      title: "Demo — Final Watch Party",
      startAt: new Date("2026-05-20T18:30:00+07:00"),
      venueName: "Venue Demo",
      venueAddress: "Jl. Demo No. 1, Tangerang Selatan",
      status: EventStatus.active,
      ticketMemberPrice: 125_000,
      ticketNonMemberPrice: 175_000,
      pricingSource: PricingSource.global_default,
      menuMode: MenuMode.PRESELECT,
      menuSelection: MenuSelection.SINGLE,
      voucherPrice: null,
      picMasterMemberId: pic.id,
      bankAccountId: bank.id,
    },
  });

  await prisma.eventMenuItem.deleteMany({ where: { eventId: event.id } });
  await prisma.eventMenuItem.createMany({
    data: [
      {
        eventId: event.id,
        name: "Paket Burger",
        price: 55_000,
        sortOrder: 1,
        voucherEligible: true,
      },
      {
        eventId: event.id,
        name: "Paket Nasi",
        price: 50_000,
        sortOrder: 2,
        voucherEligible: true,
      },
    ],
  });

  console.log("Seed OK:", event.slug);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

If `upsert` fails on second run due to orphaned `PicBankAccount` rows, simplify by using `await prisma.event.deleteMany()` in dev seeds only or always `upsert` bank by a stable synthetic id pattern — OK for MVP to reset DB with `migrate reset` during development.

- [ ] **Step 3: Add prisma seed target**

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

- [ ] **Step 4: Run**

```bash
npx prisma db seed
```

Expected: completes, prints slug.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "chore(prisma): add demo seed for active event"
```

---

## Self-review (plan author checklist)

**Spec coverage**

| Requirement                                                        | Tasks            |
| ------------------------------------------------------------------ | ---------------- |
| Public `/` active events                                           | Task 7           |
| Public `/events/[slug]` registration + uploads + PRESELECT/VOUCHER | Tasks 1, 2, 6, 7 |
| Status `pending_review` after submit                               | Task 6           |
| Admin inbox per event                                              | Tasks 9–10       |
| Approve / reject(reason) / payment_issue(reason)                   | Task 10          |
| `wa.me` templates                                                  | Tasks 3, 11      |
| Guarded Server Actions                                             | Tasks 4, 10      |

**Explicitly out of scope for this slice (later plans)**

- Invoice adjustments, attendance, cancel/refund flows beyond stubs
- Email sending for magic link (still console logs)
- Automated rate limiting (mention in backlog only)
- Event CR UI in-app (seed creates demo event)

**Placeholder scan:** No TBD/TODO/FIXME placeholders in mandated code blocks above.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-vertical-slice-mvp-public-registration-admin-inbox.md`. Two execution options:**

**1. Subagent-driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. **REQUIRED SUB-SKILL:** `superpowers:subagent-driven-development`.

**2. Inline execution** — Execute tasks in this session with checkpoints for review. **REQUIRED SUB-SKILL:** `superpowers:executing-plans`.

Which approach?
