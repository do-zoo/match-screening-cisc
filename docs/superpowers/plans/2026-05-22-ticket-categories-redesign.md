# Ticket Categories Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat member/non-member pricing on Event with a multi-category ticket system, eliminate the partner concept in favour of quantity-based holder rows, and update the public form and admin editor accordingly.

**Architecture:** Add `EventTicketCategory` and `RegistrationHolder` Prisma models. Each `Registration` links to one category and carries N holder rows (one per ticket). The public form becomes a single-page expandable-card layout. The admin event editor gains a "Harga & Tiket" tab for category CRUD. Old partner/pricing fields are removed from `Event` and `Registration`.

**Tech Stack:** Prisma (migrations), Next.js App Router, `react-hook-form` + `zod`, `@base-ui/react` Dialog, shadcn/ui, Vitest (unit tests)

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/lib/tickets/get-event-ticket-categories.ts` | Query categories for an event (public + admin) |
| `src/lib/actions/admin-ticket-categories.ts` | Server actions: create/update/delete category |
| `src/lib/forms/ticket-category-schema.ts` | Zod schema for category form |
| `src/lib/pricing/compute-submit-total.ts` | **Rewrite** (same path, new types) |
| `src/components/admin/event-editor/ticket-categories-panel.tsx` | Category CRUD table + dialog in Harga & Tiket tab |
| `src/components/public/registration-form/holder-card.tsx` | Expandable card for one ticket holder |
| `src/components/public/registration-form/category-picker.tsx` | Category selection + qty input |

### Modified files
| Path | What changes |
|---|---|
| `prisma/schema.prisma` | Add models, update Event/Registration |
| `src/lib/pricing/compute-submit-total.test.ts` | Rewrite tests for new types |
| `src/lib/actions/submit-registration.ts` | Create Registration + RegistrationHolder[] in tx |
| `src/lib/forms/submit-registration-schema.ts` | Replace partner/pricing fields with holder-based fields |
| `src/components/public/registration-form/registration-form.tsx` | Replace multi-step with single-page layout |
| `src/components/public/registration-form/registration-steps.ts` | Remove partner step; simplify steps |
| `src/components/public/registration-form/use-pricing-preview.ts` | Update for new pricing types |
| `src/app/admin/events/[eventId]/edit/page.tsx` | Pass categories to form |
| `src/components/admin/forms/event-admin-form.tsx` | Add Harga & Tiket tab |
| `src/components/admin/registration-detail-panels/tab-summary/` | Show RegistrationHolder list |
| `src/components/admin/registration-detail-panels/tab-verification/` | Per-holder member validation |
| `src/lib/registrations/admin-ticket-context.ts` | Update for new model |
| `src/lib/reports/queries.ts` | Update to use holder aggregates |
| `src/lib/reports/csv.ts` | Update columns |
| `CLAUDE.md` | Update data model section |

### Deleted files
| Path | Reason |
|---|---|
| `src/components/public/registration-form/partner-ticket-section.tsx` | Partner concept removed |
| `src/lib/registrations/partner-registration.ts` | Partner helpers no longer needed |
| `src/lib/actions/lookup-member-partner-eligibility.ts` | Partner lookup removed |
| `src/lib/actions/check-member-seat-for-event.ts` | Partner seat check removed |
| `src/components/public/registration-form/use-partner-member-number-validation.ts` | Partner hook removed |
| `src/components/public/registration-form/use-primary-purchaser-identity-gate.ts` | Replaced by simplified holder flow |

---

## Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `EventTicketCategory` model to schema**

In `prisma/schema.prisma`, add after the `Venue` model block:

```prisma
model EventTicketCategory {
  id              String   @id @default(cuid())
  eventId         String
  event           Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name            String
  regularPrice    Int
  memberPrice     Int
  maxQtyPerPerson Int?
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())

  registrations Registration[]

  @@index([eventId, sortOrder])
}
```

- [ ] **Step 2: Add `RegistrationHolder` model to schema**

Add after `EventTicketCategory`:

```prisma
model RegistrationHolder {
  id                        String           @id @default(cuid())
  registrationId            String
  registration              Registration     @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  sortOrder                 Int
  holderName                String
  claimedMemberNumber       String?
  memberValidation          MemberValidation @default(unknown)
  memberId                  String?
  member                    MasterMember?    @relation(fields: [memberId], references: [id], onDelete: SetNull)
  ticketPriceApplied        Int
  mandatoryMenuItemId       String?
  mandatoryMenuPriceApplied Int?

  @@index([registrationId])
}
```

- [ ] **Step 3: Update `Event` model — add fields, remove old pricing fields**

In the `Event` model block:

Add (after `status` field):
```prisma
  multiCategoryPurchase Boolean @default(false)
  ticketCategories      EventTicketCategory[]
```

Remove these two lines:
```prisma
  ticketMemberPrice    Int
  ticketNonMemberPrice Int
```

- [ ] **Step 4: Update `Registration` model — add fields, remove partner/pricing fields**

In the `Registration` model block, add after `eventId`:
```prisma
  ticketCategoryId String
  ticketCategory   EventTicketCategory @relation(fields: [ticketCategoryId], references: [id], onDelete: Restrict)
  ticketQty        Int                 @default(1)
```

Add at the end of the model (before closing brace):
```prisma
  holders RegistrationHolder[]
```

Remove these lines from `Registration`:
```prisma
  primaryRegistrationId String?
  primaryRegistration   Registration?  @relation("PartnerLink", fields: [primaryRegistrationId], references: [id], onDelete: Cascade)
  partnerRegistrations  Registration[] @relation("PartnerLink")
  ticketRole          TicketRole
  ticketPriceType     TicketPriceType
  mandatoryMenuItemId String
  mandatoryMenuItem   VenueMenuItem   @relation("RegistrationMandatoryMenu", fields: [mandatoryMenuItemId], references: [id], onDelete: Restrict)
  ticketPriceApplied        Int
  mandatoryMenuPriceApplied Int
  primaryManagementMemberId   String?
  primaryManagementMember     ManagementMember? @relation(fields: [primaryManagementMemberId], references: [id], onDelete: SetNull)
  claimedManagementPublicCode String?
```

Also remove `mandatoryMenuItemId` from `mandatoryMenuItemIds` reference if it appears in a relation comment.

- [ ] **Step 5: Remove `TicketRole` enum and update `TicketPriceType`**

Remove the entire `enum TicketRole` block:
```prisma
enum TicketRole {
  primary
  partner
}
```

Remove the entire `enum TicketPriceType` block:
```prisma
enum TicketPriceType {
  member
  non_member
  privilege_partner_member_price
}
```

- [ ] **Step 6: Add `MasterMember` relation for `RegistrationHolder`**

In the `MasterMember` model, add:
```prisma
  registrationHolders RegistrationHolder[]
```

- [ ] **Step 7: Run migration**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/mac/Documents/CISC/match-screening && nvm use
pnpm db:migrate:dev
```

When prompted for migration name, enter: `ticket_categories_redesign`

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 8: Verify build still produces a Prisma client**

```bash
pnpm prisma generate
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add EventTicketCategory and RegistrationHolder, remove partner/flat-pricing fields"
```

---

## Task 2: Pricing Logic Rewrite

**Files:**
- Modify: `src/lib/pricing/compute-submit-total.ts`
- Modify: `src/lib/pricing/compute-submit-total.test.ts`

- [ ] **Step 1: Write failing tests first**

Replace the entire contents of `src/lib/pricing/compute-submit-total.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSubmitTotal, type SubmitPricingInput } from "./compute-submit-total";

const cat = { regularPrice: 800_000, memberPrice: 650_000 };
const menu = { price: 150_000, name: "Paket A" };

describe("computeSubmitTotal", () => {
  it("single non-member holder, no menu", () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: "invalid", category: cat }],
    };
    const result = computeSubmitTotal(input);
    expect(result.grandTotal).toBe(800_000);
    expect(result.lines[0].ticketPrice).toBe(800_000);
    expect(result.lines[0].isMember).toBe(false);
  });

  it("single member holder (valid)", () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: "valid", category: cat }],
    };
    const result = computeSubmitTotal(input);
    expect(result.grandTotal).toBe(650_000);
    expect(result.lines[0].isMember).toBe(true);
  });

  it("overridden validation counts as member", () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: "overridden", category: cat }],
    };
    expect(computeSubmitTotal(input).lines[0].isMember).toBe(true);
  });

  it("unknown validation counts as non-member", () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: "unknown", category: cat }],
    };
    expect(computeSubmitTotal(input).lines[0].isMember).toBe(false);
  });

  it("two holders — member + non-member", () => {
    const input: SubmitPricingInput = {
      holders: [
        { memberValidation: "valid", category: cat },
        { memberValidation: "invalid", category: cat },
      ],
    };
    const result = computeSubmitTotal(input);
    expect(result.grandTotal).toBe(650_000 + 800_000);
    expect(result.lines).toHaveLength(2);
  });

  it("menu price stored separately, not added to grandTotal", () => {
    const input: SubmitPricingInput = {
      holders: [{ memberValidation: "invalid", category: cat, menuItem: menu }],
    };
    const result = computeSubmitTotal(input);
    // grandTotal is ticket only
    expect(result.grandTotal).toBe(800_000);
    expect(result.lines[0].menuPrice).toBe(150_000);
  });

  it("empty holders returns zero total", () => {
    const result = computeSubmitTotal({ holders: [] });
    expect(result.grandTotal).toBe(0);
    expect(result.lines).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm vitest run src/lib/pricing/compute-submit-total.test.ts
```

Expected: FAIL (old types don't match new test expectations).

- [ ] **Step 3: Rewrite `compute-submit-total.ts`**

Replace the entire file:

```ts
import type { MemberValidation } from "@prisma/client";

export type HolderInput = {
  memberValidation: MemberValidation;
  category: { regularPrice: number; memberPrice: number };
  menuItem?: { price: number; name: string } | null;
};

export type SubmitPricingInput = {
  holders: HolderInput[];
};

export type HolderPricingLine = {
  index: number;
  isMember: boolean;
  ticketPrice: number;
  /** Price stored for venue payout reporting only — not added to grandTotal. */
  menuPrice: number | null;
};

export type SubmitPricingResult = {
  lines: HolderPricingLine[];
  /** Sum of ticketPrice across all holders (menu excluded). */
  grandTotal: number;
};

function resolveIsMember(v: MemberValidation): boolean {
  return v === "valid" || v === "overridden";
}

export function computeSubmitTotal(input: SubmitPricingInput): SubmitPricingResult {
  const lines: HolderPricingLine[] = input.holders.map((h, i) => {
    const isMember = resolveIsMember(h.memberValidation);
    const ticketPrice = isMember ? h.category.memberPrice : h.category.regularPrice;
    const menuPrice = h.menuItem?.price ?? null;
    return { index: i, isMember, ticketPrice, menuPrice };
  });
  const grandTotal = lines.reduce((sum, l) => sum + l.ticketPrice, 0);
  return { lines, grandTotal };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm vitest run src/lib/pricing/compute-submit-total.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/compute-submit-total.ts src/lib/pricing/compute-submit-total.test.ts
git commit -m "feat(pricing): rewrite compute-submit-total for holder-based model"
```

---

## Task 3: Ticket Category Query Helper

**Files:**
- Create: `src/lib/tickets/get-event-ticket-categories.ts`

- [ ] **Step 1: Create the query helper**

```ts
import { prisma } from "@/lib/db/prisma";

export type EventTicketCategoryRow = {
  id: string;
  name: string;
  regularPrice: number;
  memberPrice: number;
  maxQtyPerPerson: number | null;
  sortOrder: number;
  isActive: boolean;
  registrationCount: number;
};

export async function getEventTicketCategories(
  eventId: string,
): Promise<EventTicketCategoryRow[]> {
  const rows = await prisma.eventTicketCategory.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      memberPrice: true,
      maxQtyPerPerson: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { registrations: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    regularPrice: r.regularPrice,
    memberPrice: r.memberPrice,
    maxQtyPerPerson: r.maxQtyPerPerson,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    registrationCount: r._count.registrations,
  }));
}

/** Active categories only — for the public registration form. */
export async function getActiveEventTicketCategories(
  eventId: string,
): Promise<Omit<EventTicketCategoryRow, "registrationCount">[]> {
  const rows = await prisma.eventTicketCategory.findMany({
    where: { eventId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      memberPrice: true,
      maxQtyPerPerson: true,
      sortOrder: true,
      isActive: true,
    },
  });
  return rows;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tickets/get-event-ticket-categories.ts
git commit -m "feat(tickets): add getEventTicketCategories query helper"
```

---

## Task 4: Admin Ticket Category Server Actions

**Files:**
- Create: `src/lib/forms/ticket-category-schema.ts`
- Create: `src/lib/actions/admin-ticket-categories.ts`

- [ ] **Step 1: Create the Zod schema**

`src/lib/forms/ticket-category-schema.ts`:

```ts
import { z } from "zod";

export const ticketCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi"),
  regularPrice: z.number().int().min(0, "Harga reguler tidak boleh negatif"),
  memberPrice: z.number().int().min(0, "Harga member tidak boleh negatif"),
  maxQtyPerPerson: z.number().int().min(1).nullable(),
});

export type TicketCategoryInput = z.infer<typeof ticketCategorySchema>;
```

- [ ] **Step 2: Create server actions**

`src/lib/actions/admin-ticket-categories.ts`:

```ts
"use server";

import { prisma } from "@/lib/db/prisma";
import { guardOwnerOrAdmin } from "@/lib/actions/guard";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import {
  ticketCategorySchema,
  type TicketCategoryInput,
} from "@/lib/forms/ticket-category-schema";

export async function createTicketCategory(
  eventId: string,
  input: TicketCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  await guardOwnerOrAdmin();
  const parsed = ticketCategorySchema.safeParse(input);
  if (!parsed.success) return rootError("Data kategori tidak valid.");

  const maxSort = await prisma.eventTicketCategory.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

  const category = await prisma.eventTicketCategory.create({
    data: { eventId, ...parsed.data, sortOrder },
    select: { id: true },
  });
  return ok(category);
}

export async function updateTicketCategory(
  categoryId: string,
  input: TicketCategoryInput,
): Promise<ActionResult<void>> {
  await guardOwnerOrAdmin();
  const parsed = ticketCategorySchema.safeParse(input);
  if (!parsed.success) return rootError("Data kategori tidak valid.");

  const hasRegistrations =
    (await prisma.registration.count({ where: { ticketCategoryId: categoryId } })) > 0;

  const data = hasRegistrations
    ? { name: parsed.data.name, maxQtyPerPerson: parsed.data.maxQtyPerPerson }
    : parsed.data;

  await prisma.eventTicketCategory.update({ where: { id: categoryId }, data });
  return ok(undefined);
}

export async function deleteTicketCategory(
  categoryId: string,
): Promise<ActionResult<void>> {
  await guardOwnerOrAdmin();

  const count = await prisma.registration.count({
    where: { ticketCategoryId: categoryId },
  });
  if (count > 0)
    return rootError(
      `Tidak dapat dihapus — sudah ada ${count} registrasi untuk kategori ini.`,
    );

  await prisma.eventTicketCategory.delete({ where: { id: categoryId } });
  return ok(undefined);
}

export async function toggleTicketCategoryActive(
  categoryId: string,
  isActive: boolean,
): Promise<ActionResult<void>> {
  await guardOwnerOrAdmin();
  await prisma.eventTicketCategory.update({
    where: { id: categoryId },
    data: { isActive },
  });
  return ok(undefined);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/forms/ticket-category-schema.ts src/lib/actions/admin-ticket-categories.ts
git commit -m "feat(admin): add ticket category CRUD server actions"
```

---

## Task 5: Admin Event Editor — Harga & Tiket Tab

**Files:**
- Create: `src/components/admin/event-editor/ticket-categories-panel.tsx`
- Modify: `src/components/admin/forms/event-admin-form.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`

- [ ] **Step 1: Create the ticket categories panel component**

`src/components/admin/event-editor/ticket-categories-panel.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogClose } from "@base-ui-react/react/dialog";

import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IdrAmountInput } from "@/components/ui/idr-amount-input";
import { toastCudSuccess, toastActionErr } from "@/lib/client/cud-notify";
import {
  createTicketCategory,
  updateTicketCategory,
  deleteTicketCategory,
  toggleTicketCategoryActive,
} from "@/lib/actions/admin-ticket-categories";
import { ticketCategorySchema, type TicketCategoryInput } from "@/lib/forms/ticket-category-schema";
import { formatIdr } from "@/lib/utils/format-idr";
import { parseIdrDigitsToInt } from "@/lib/utils/idr-input";
import type { EventTicketCategoryRow } from "@/lib/tickets/get-event-ticket-categories";

type Props = {
  eventId: string;
  categories: EventTicketCategoryRow[];
};

type DialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: EventTicketCategoryRow };

export function TicketCategoriesPanel({ eventId, categories: initial }: Props) {
  const [categories, setCategories] = useState(initial);
  const [dialogState, setDialogState] = useState<DialogState>({ mode: "closed" });
  const [isPending, startTransition] = useTransition();

  function refreshWith(updated: EventTicketCategoryRow[]) {
    setCategories(updated);
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteTicketCategory(id);
      if (!res.ok) { toastActionErr(res, "Gagal menghapus kategori."); return; }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toastCudSuccess("delete", "Kategori dihapus.");
    });
  }

  async function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const res = await toggleTicketCategoryActive(id, isActive);
      if (!res.ok) { toastActionErr(res, "Gagal mengubah status."); return; }
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, isActive } : c));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Kategori Tiket</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogState({ mode: "create" })}
        >
          + Tambah Kategori
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada kategori tiket.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nama</th>
                <th className="px-3 py-2 text-right font-medium">Reguler</th>
                <th className="px-3 py-2 text-right font-medium">Member</th>
                <th className="px-3 py-2 text-right font-medium">Maks/Orang</th>
                <th className="px-3 py-2 text-right font-medium">Registrasi</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-t">
                  <td className="px-3 py-2">
                    {cat.name}
                    {!cat.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">(nonaktif)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{formatIdr(cat.regularPrice)}</td>
                  <td className="px-3 py-2 text-right">{formatIdr(cat.memberPrice)}</td>
                  <td className="px-3 py-2 text-right">
                    {cat.maxQtyPerPerson ?? "∞"}
                  </td>
                  <td className="px-3 py-2 text-right">{cat.registrationCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDialogState({ mode: "edit", category: cat })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(cat.id, !cat.isActive)}
                        disabled={isPending}
                      >
                        {cat.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                      {cat.registrationCount === 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(cat.id)}
                          disabled={isPending}
                        >
                          Hapus
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogState.mode !== "closed" && (
        <CategoryFormDialog
          eventId={eventId}
          mode={dialogState.mode}
          category={dialogState.mode === "edit" ? dialogState.category : undefined}
          onClose={() => setDialogState({ mode: "closed" })}
          onSaved={(updated) => {
            if (dialogState.mode === "create") {
              setCategories((prev) => [...prev, updated]);
            } else {
              setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            }
            setDialogState({ mode: "closed" });
          }}
        />
      )}
    </div>
  );
}

function CategoryFormDialog({
  eventId,
  mode,
  category,
  onClose,
  onSaved,
}: {
  eventId: string;
  mode: "create" | "edit";
  category?: EventTicketCategoryRow;
  onClose: () => void;
  onSaved: (updated: EventTicketCategoryRow) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const priceLocked = mode === "edit" && (category?.registrationCount ?? 0) > 0;

  const form = useForm<TicketCategoryInput>({
    resolver: zodResolver(ticketCategorySchema),
    defaultValues: {
      name: category?.name ?? "",
      regularPrice: category?.regularPrice ?? 0,
      memberPrice: category?.memberPrice ?? 0,
      maxQtyPerPerson: category?.maxQtyPerPerson ?? null,
    },
  });

  function onSubmit(values: TicketCategoryInput) {
    startTransition(async () => {
      if (mode === "create") {
        const res = await createTicketCategory(eventId, values);
        if (!res.ok) { toastActionErr(res, "Gagal menyimpan."); return; }
        toastCudSuccess("create", "Kategori ditambahkan.");
        onSaved({
          id: res.data.id,
          ...values,
          sortOrder: 0,
          isActive: true,
          registrationCount: 0,
        } as EventTicketCategoryRow);
      } else {
        const res = await updateTicketCategory(category!.id, values);
        if (!res.ok) { toastActionErr(res, "Gagal menyimpan."); return; }
        toastCudSuccess("update", "Kategori diperbarui.");
        onSaved({ ...category!, ...values });
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPopup className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
          <DialogTitle className="text-lg font-semibold mb-4">
            {mode === "create" ? "Tambah Kategori" : "Edit Kategori"}
          </DialogTitle>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Kategori</FormLabel>
                    <FormControl>
                      <Input placeholder="Cat 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="regularPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Reguler (IDR)</FormLabel>
                    <FormControl>
                      <IdrAmountInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={priceLocked}
                      />
                    </FormControl>
                    {priceLocked && (
                      <p className="text-xs text-muted-foreground">
                        Harga tidak dapat diubah — sudah ada registrasi.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="memberPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Member (IDR)</FormLabel>
                    <FormControl>
                      <IdrAmountInput
                        value={field.value}
                        onChange={field.onChange}
                        disabled={priceLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxQtyPerPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maks Tiket per Orang (opsional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Tidak dibatasi"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : parseInt(e.target.value, 10),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Batal
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the panel into the event editor**

In `src/app/admin/events/[eventId]/edit/page.tsx`, add the categories query and pass it to the form. Find the section where the event is fetched from Prisma and add:

```ts
const categories = await getEventTicketCategories(eventId);
```

Import at top:
```ts
import { getEventTicketCategories } from "@/lib/tickets/get-event-ticket-categories";
```

Pass `categories` as a prop to `<EventAdminForm>`.

- [ ] **Step 3: Add `TicketCategoriesPanel` to `EventAdminForm`**

In `src/components/admin/forms/event-admin-form.tsx`:

1. Accept a `categories` prop of type `EventTicketCategoryRow[]`
2. Find the existing tab/section for pricing (currently renders `ticketMemberPrice` / `ticketNonMemberPrice` fields)
3. Rename the section to "Harga & Tiket"
4. Replace the old price inputs with `<TicketCategoriesPanel eventId={eventId} categories={categories} />`
5. Add a checkbox for `multiCategoryPurchase`:

```tsx
<div className="flex items-center gap-2 pt-2">
  <Checkbox
    id="multiCategoryPurchase"
    checked={form.watch("multiCategoryPurchase")}
    onCheckedChange={(v) => form.setValue("multiCategoryPurchase", Boolean(v))}
  />
  <label htmlFor="multiCategoryPurchase" className="text-sm">
    Izinkan beli tiket dari beberapa kategori dalam satu transaksi
  </label>
</div>
```

6. Remove all references to `ticketMemberPrice` and `ticketNonMemberPrice` from the form schema and render.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -40
```

Expected: no type errors related to changed files (other errors may exist until later tasks complete).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/event-editor/ src/components/admin/forms/event-admin-form.tsx src/app/admin/events/\[eventId\]/edit/page.tsx src/lib/tickets/
git commit -m "feat(admin): add Harga & Tiket tab with ticket category CRUD to event editor"
```

---

## Task 6: Public Form Schema Update

**Files:**
- Modify: `src/lib/forms/submit-registration-schema.ts`

- [ ] **Step 1: Rewrite submit-registration-schema.ts**

The new schema removes all partner/step-based fields and replaces them with a holder array:

```ts
import { isValidPhoneNumber } from "libphonenumber-js";
import { z } from "zod";
import { toE164PlusForValidation } from "@/lib/forms/phone-value-string";

const contactWhatsappSchema = z.string().trim().superRefine((val, ctx) => {
  const e164 = toE164PlusForValidation(val);
  if (!e164) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WhatsApp wajib diisi" });
    return;
  }
  if (!isValidPhoneNumber(e164)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nomor WhatsApp tidak valid" });
  }
});

export const holderSchema = z.object({
  holderName: z.string().trim().min(1, "Nama pemegang tiket wajib diisi"),
  claimedMemberNumber: z.string().trim().optional(),
  mandatoryMenuItemId: z.string().optional(),
});

export type HolderInput = z.infer<typeof holderSchema>;

export const submitRegistrationSchema = z.object({
  ticketCategoryId: z.string().min(1, "Pilih kategori tiket"),
  ticketQty: z.number().int().min(1, "Jumlah tiket minimal 1"),
  holders: z.array(holderSchema).min(1, "Minimal satu pemegang tiket"),
  contactWhatsapp: contactWhatsappSchema,
  transferProof: z.instanceof(File, { message: "Bukti transfer wajib diunggah" }),
});

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/forms/submit-registration-schema.ts
git commit -m "feat(forms): replace partner-based schema with holder array schema"
```

---

## Task 7: Public Registration Form — Category Picker + Holder Cards

**Files:**
- Create: `src/components/public/registration-form/category-picker.tsx`
- Create: `src/components/public/registration-form/holder-card.tsx`
- Modify: `src/components/public/registration-form/registration-form.tsx`
- Modify: `src/components/public/registration-form/registration-steps.ts`
- Modify: `src/components/public/registration-form/use-pricing-preview.ts`

- [ ] **Step 1: Create `category-picker.tsx`**

```tsx
"use client";

import type { EventTicketCategoryRow } from "@/lib/tickets/get-event-ticket-categories";
import { formatIdr } from "@/lib/utils/format-idr";

type Props = {
  categories: Omit<EventTicketCategoryRow, "registrationCount">[];
  selectedId: string;
  onSelect: (id: string) => void;
  qty: number;
  onQtyChange: (qty: number) => void;
};

export function CategoryPicker({ categories, selectedId, onSelect, qty, onQtyChange }: Props) {
  const selected = categories.find((c) => c.id === selectedId);
  const max = selected?.maxQtyPerPerson ?? 20;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium mb-2">Pilih Kategori Tiket</legend>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selectedId === cat.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="ticketCategory"
                value={cat.id}
                checked={selectedId === cat.id}
                onChange={() => onSelect(cat.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{cat.name}</div>
                <div className="text-sm text-muted-foreground">
                  Member: {formatIdr(cat.memberPrice)} · Reguler: {formatIdr(cat.regularPrice)}
                </div>
                {cat.maxQtyPerPerson && (
                  <div className="text-xs text-muted-foreground">
                    Maks {cat.maxQtyPerPerson} tiket/orang
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="text-sm font-medium">Jumlah Tiket</label>
        <select
          value={qty}
          onChange={(e) => onQtyChange(parseInt(e.target.value, 10))}
          className="mt-1 block w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `holder-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import type { SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";

type Props = {
  index: number;
  isPrimary: boolean;
  menuItems?: { id: string; name: string; price: number }[];
  menuRequired: boolean;
};

export function HolderCard({ index, isPrimary, menuItems, menuRequired }: Props) {
  const [expanded, setExpanded] = useState(isPrimary);
  const form = useFormContext<SubmitRegistrationInput>();

  const holderName = form.watch(`holders.${index}.holderName`);
  const memberNumber = form.watch(`holders.${index}.claimedMemberNumber`);

  const summary = holderName
    ? `${holderName}${memberNumber ? ` · ${memberNumber}` : ""}`
    : "Belum diisi";

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-medium">
          Tiket {index + 1}
          {isPrimary && " (Anda)"}
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{summary}</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <FormField
            control={form.control}
            name={`holders.${index}.holderName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Lengkap</FormLabel>
                <FormControl>
                  <Input placeholder="Nama sesuai identitas" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`holders.${index}.claimedMemberNumber`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor Member CISC (opsional)</FormLabel>
                <FormControl>
                  <Input placeholder="Kosongkan jika bukan member" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {menuRequired && menuItems && menuItems.length > 0 && (
            <FormField
              control={form.control}
              name={`holders.${index}.mandatoryMenuItemId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilihan Menu</FormLabel>
                  <FormControl>
                    <select
                      className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    >
                      <option value="">-- Pilih menu --</option>
                      {menuItems.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update `registration-steps.ts`**

Remove "partner" step entirely. Replace the full file:

```ts
export type RegistrationStepId = "category" | "holders" | "payment";

export const REGISTRATION_STEP_ORDER = [
  "category",
  "holders",
  "payment",
] as const satisfies readonly RegistrationStepId[];

export function registrationStepTitle(id: RegistrationStepId): string {
  switch (id) {
    case "category": return "Pilih Tiket";
    case "holders": return "Data Peserta";
    case "payment": return "Pembayaran";
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
```

- [ ] **Step 4: Update `use-pricing-preview.ts`**

Replace the hook to use the new `computeSubmitTotal`:

```ts
"use client";

import { useMemo } from "react";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import type { EventTicketCategoryRow } from "@/lib/tickets/get-event-ticket-categories";
import type { HolderInput } from "@/lib/forms/submit-registration-schema";

type UsePricingPreviewArgs = {
  category: Omit<EventTicketCategoryRow, "registrationCount"> | undefined;
  holders: HolderInput[];
};

export function usePricingPreview({ category, holders }: UsePricingPreviewArgs) {
  return useMemo(() => {
    if (!category || holders.length === 0) return null;
    return computeSubmitTotal({
      holders: holders.map((h) => ({
        memberValidation: h.claimedMemberNumber ? "unknown" : "invalid",
        category: {
          regularPrice: category.regularPrice,
          memberPrice: category.memberPrice,
        },
      })),
    });
  }, [category, holders]);
}
```

- [ ] **Step 5: Rewrite `registration-form.tsx` to single-page layout**

Replace the multi-step logic with a single-page form that renders `<CategoryPicker>` at the top, then maps `ticketQty` to N `<HolderCard>` components, then a payment/contact section at the bottom.

The key structure:

```tsx
"use client";

import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitRegistration } from "@/lib/actions/submit-registration";
import { submitRegistrationSchema, type SubmitRegistrationInput } from "@/lib/forms/submit-registration-schema";
import { CategoryPicker } from "./category-picker";
import { HolderCard } from "./holder-card";
import { usePricingPreview } from "./use-pricing-preview";
import { formatIdr } from "@/lib/utils/format-idr";
import type { RegistrationFormProps } from "./types";

export function RegistrationForm({ event }: RegistrationFormProps) {
  const form = useForm<SubmitRegistrationInput>({
    resolver: zodResolver(submitRegistrationSchema),
    defaultValues: {
      ticketCategoryId: event.ticketCategories?.[0]?.id ?? "",
      ticketQty: 1,
      holders: [{ holderName: "", claimedMemberNumber: "", mandatoryMenuItemId: "" }],
      contactWhatsapp: "",
    },
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: "holders" });

  const selectedCategoryId = form.watch("ticketCategoryId");
  const ticketQty = form.watch("ticketQty");
  const holders = form.watch("holders");

  const selectedCategory = event.ticketCategories?.find((c) => c.id === selectedCategoryId);
  const pricing = usePricingPreview({ category: selectedCategory, holders });

  function handleQtyChange(qty: number) {
    form.setValue("ticketQty", qty);
    const current = form.getValues("holders");
    const next = Array.from({ length: qty }, (_, i) => current[i] ?? { holderName: "", claimedMemberNumber: "" });
    replace(next);
  }

  async function onSubmit(values: SubmitRegistrationInput) {
    const formData = new FormData();
    // Append all values to FormData for server action
    formData.append("ticketCategoryId", values.ticketCategoryId);
    formData.append("ticketQty", String(values.ticketQty));
    formData.append("holders", JSON.stringify(values.holders));
    formData.append("contactWhatsapp", values.contactWhatsapp);
    if (values.transferProof) formData.append("transferProof", values.transferProof);

    const result = await submitRegistration(event.id, formData);
    if (!result.ok) {
      form.setError("root", { message: result.rootError ?? "Terjadi kesalahan." });
      return;
    }
    // redirect handled server-side
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <CategoryPicker
          categories={event.ticketCategories ?? []}
          selectedId={selectedCategoryId}
          onSelect={(id) => form.setValue("ticketCategoryId", id)}
          qty={ticketQty}
          onQtyChange={handleQtyChange}
        />

        <div className="space-y-3">
          <h3 className="font-medium">Data Peserta</h3>
          {fields.map((field, index) => (
            <HolderCard
              key={field.id}
              index={index}
              isPrimary={index === 0}
              menuItems={event.menuItems}
              menuRequired={event.menuRequired ?? false}
            />
          ))}
        </div>

        {/* Contact section */}
        <div className="space-y-3">
          <h3 className="font-medium">Kontak & Pembayaran</h3>
          <FormField
            control={form.control}
            name="contactWhatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor WhatsApp</FormLabel>
                <FormControl>
                  <Input placeholder="+62 812 xxxx xxxx" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Bukti Transfer</FormLabel>
            <FormControl>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) form.setValue("transferProof", file);
                }}
              />
            </FormControl>
            {form.formState.errors.transferProof && (
              <p className="text-sm text-destructive">
                {form.formState.errors.transferProof.message}
              </p>
            )}
          </FormItem>
        </div>

        {pricing && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-1">
            <p className="font-medium">Estimasi Total</p>
            {pricing.lines.map((l) => (
              <div key={l.index} className="flex justify-between text-sm">
                <span>Tiket {l.index + 1} ({l.isMember ? "Member" : "Reguler"})</span>
                <span>{formatIdr(l.ticketPrice)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Total</span>
              <span>{formatIdr(pricing.grandTotal)}</span>
            </div>
          </div>
        )}

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}

        <button type="submit" disabled={form.formState.isSubmitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground font-medium">
          {form.formState.isSubmitting ? "Mengirim..." : "Daftar Sekarang"}
        </button>
      </form>
    </FormProvider>
  );
}
```

- [ ] **Step 6: Update event serialization to include categories**

In `src/components/public/event-serialization.ts`, add `ticketCategories` to the serialized event type and fetch from the query that populates the form. The event page query must include:

```ts
ticketCategories: {
  where: { isActive: true },
  orderBy: { sortOrder: "asc" },
  select: { id: true, name: true, regularPrice: true, memberPrice: true, maxQtyPerPerson: true },
},
```

Add to `SerializedEventForRegistration`:
```ts
ticketCategories: {
  id: string;
  name: string;
  regularPrice: number;
  memberPrice: number;
  maxQtyPerPerson: number | null;
}[];
menuRequired: boolean;
```

- [ ] **Step 7: Delete partner-specific files**

```bash
rm src/components/public/registration-form/partner-ticket-section.tsx
rm src/components/public/registration-form/use-partner-member-number-validation.ts
rm src/components/public/registration-form/use-primary-purchaser-identity-gate.ts
rm src/lib/registrations/partner-registration.ts
rm src/lib/actions/lookup-member-partner-eligibility.ts
rm src/lib/actions/check-member-seat-for-event.ts
```

- [ ] **Step 8: Run lint to find remaining references to deleted files**

```bash
pnpm lint 2>&1 | grep -E "error|import" | head -30
```

Fix any import errors by removing the import lines from affected files.

- [ ] **Step 9: Commit**

```bash
git add src/components/public/ src/lib/forms/
git commit -m "feat(public-form): replace multi-step partner form with single-page holder cards"
```

---

## Task 8: Submit Registration Server Action

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`

- [ ] **Step 1: Rewrite submit-registration.ts**

The action now accepts `eventId` and `formData`, creates a `Registration` + `RegistrationHolder[]` in a single transaction:

```ts
"use server";

import { del } from "@vercel/blob";
import { RegistrationStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { submitRegistrationSchema } from "@/lib/forms/submit-registration-schema";
import { computeSubmitTotal } from "@/lib/pricing/compute-submit-total";
import { uploadImageForRegistration } from "@/lib/uploads/upload-image";
import { UploadError } from "@/lib/uploads/errors";
import {
  assertRegistrationAcceptableOrThrowForTx,
  isRegistrationOpenForEvent,
  registrationBlockMessageForPublic,
  RegistrationNotAcceptableError,
} from "@/lib/events/registration-window";
import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  mergeGlobalRegistrationClosure,
} from "@/lib/public/club-operational-policy";
import { loadClubOperationalSettings } from "@/lib/public/load-club-operational-settings";

function uploadErrorMessage(err: UploadError): string {
  const code = (err as UploadError & { meta?: { code?: string } }).meta?.code ?? err.code;
  if (code === "invalid_content_type") return "File harus berupa gambar JPG, PNG, WebP, HEIC, atau HEIF.";
  if (code === "file_too_large") return "Ukuran file terlalu besar. Maksimal 8 MB.";
  return "Gagal mengunggah gambar. Coba unggah ulang.";
}

export async function submitRegistration(
  eventId: string,
  formData: FormData,
): Promise<ActionResult<{ registrationId: string }>> {
  // Parse holders from JSON string in FormData
  let holdersRaw: unknown;
  try {
    holdersRaw = JSON.parse(formData.get("holders") as string);
  } catch {
    return rootError("Data peserta tidak valid.");
  }

  const rawInput = {
    ticketCategoryId: formData.get("ticketCategoryId"),
    ticketQty: Number(formData.get("ticketQty")),
    holders: holdersRaw,
    contactWhatsapp: formData.get("contactWhatsapp"),
    transferProof: formData.get("transferProof"),
  };

  const parsed = submitRegistrationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return rootError(firstIssue?.message ?? "Data tidak valid.");
  }

  const input = parsed.data;

  // Check event + registration window
  const [event, clubSettings] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        status: true,
        registrationManualClosed: true,
        openRegistrationAt: true,
        closeRegistrationAt: true,
        registrationCapacity: true,
        bankAccountId: true,
        ticketCategories: {
          where: { id: input.ticketCategoryId, isActive: true },
          select: { id: true, regularPrice: true, memberPrice: true, maxQtyPerPerson: true },
        },
      },
    }),
    loadClubOperationalSettings(),
  ]);

  if (!event) return rootError("Acara tidak ditemukan.");

  const globalClosed = mergeGlobalRegistrationClosure(
    clubSettings ?? { globalRegistrationClosed: DEFAULT_GLOBAL_REGISTRATION_CLOSED },
    event,
  );
  if (globalClosed) return rootError(registrationBlockMessageForPublic("closed"));

  if (!isRegistrationOpenForEvent(event)) {
    return rootError(registrationBlockMessageForPublic("closed"));
  }

  const category = event.ticketCategories[0];
  if (!category) return rootError("Kategori tiket tidak tersedia.");

  if (category.maxQtyPerPerson !== null && input.ticketQty > category.maxQtyPerPerson) {
    return rootError(`Maksimal ${category.maxQtyPerPerson} tiket untuk kategori ini.`);
  }

  if (input.holders.length !== input.ticketQty) {
    return rootError("Jumlah data peserta tidak sesuai dengan jumlah tiket.");
  }

  // Compute total
  const pricing = computeSubmitTotal({
    holders: input.holders.map((h) => ({
      memberValidation: "unknown" as const,
      category: { regularPrice: category.regularPrice, memberPrice: category.memberPrice },
    })),
  });

  // Upload transfer proof
  let uploadBlobUrl: string | null = null;
  let uploadBlobPath: string | null = null;

  try {
    // Registration ID is not yet known; use a temp placeholder and update after insert
    const tempId = `temp-${Date.now()}`;
    const upload = await uploadImageForRegistration(
      tempId,
      "transfer_proof",
      input.transferProof as File,
    );
    uploadBlobUrl = upload.blobUrl;
    uploadBlobPath = upload.blobPath;
  } catch (err) {
    if (err instanceof UploadError) return rootError(uploadErrorMessage(err));
    throw err;
  }

  let registrationId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await assertRegistrationAcceptableOrThrowForTx(tx, event);

      const registration = await tx.registration.create({
        data: {
          eventId,
          ticketCategoryId: input.ticketCategoryId,
          ticketQty: input.ticketQty,
          contactName: input.holders[0].holderName,
          contactWhatsapp: input.contactWhatsapp,
          computedTotalAtSubmit: pricing.grandTotal,
          status: RegistrationStatus.submitted,
          holders: {
            create: input.holders.map((h, i) => ({
              sortOrder: i + 1,
              holderName: h.holderName,
              claimedMemberNumber: h.claimedMemberNumber || null,
              ticketPriceApplied: pricing.lines[i]?.ticketPrice ?? 0,
              mandatoryMenuItemId: h.mandatoryMenuItemId || null,
            })),
          },
          uploads: {
            create: {
              purpose: "transfer_proof",
              blobUrl: uploadBlobUrl!,
              blobPath: uploadBlobPath!,
              originalFilename: (input.transferProof as File).name,
            },
          },
        },
        select: { id: true },
      });

      return registration;
    });
    registrationId = result.id;
  } catch (err) {
    // Rollback blob on transaction failure
    if (uploadBlobPath) {
      await del(uploadBlobPath).catch(() => null);
    }
    if (err instanceof RegistrationNotAcceptableError) {
      return rootError(registrationBlockMessageForPublic(err.reason));
    }
    throw err;
  }

  return ok({ registrationId });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | grep "error TS" | head -20
```

Fix any remaining type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/submit-registration.ts
git commit -m "feat(submit): rewrite submit-registration to create Registration + RegistrationHolder[]"
```

---

## Task 9: Admin Registration Detail — Show Holders

**Files:**
- Modify: `src/lib/registrations/admin-ticket-context.ts`
- Modify: `src/components/admin/registration-detail-panels/tab-summary/`

- [ ] **Step 1: Update admin ticket context to include holders**

In `src/lib/registrations/admin-ticket-context.ts`, update the Prisma query to include:

```ts
holders: {
  orderBy: { sortOrder: "asc" },
  select: {
    id: true,
    sortOrder: true,
    holderName: true,
    claimedMemberNumber: true,
    memberValidation: true,
    ticketPriceApplied: true,
    mandatoryMenuItemId: true,
    mandatoryMenuItem: { select: { name: true } },
  },
},
ticketCategory: {
  select: { id: true, name: true, regularPrice: true, memberPrice: true },
},
```

Remove all partner-related fields from the select.

Add the holder types to the context type:

```ts
export type RegistrationHolderContext = {
  id: string;
  sortOrder: number;
  holderName: string;
  claimedMemberNumber: string | null;
  memberValidation: MemberValidation;
  ticketPriceApplied: number;
  menuItemName: string | null;
};
```

- [ ] **Step 2: Add holders table to Ringkasan tab**

In the summary tab component (find in `src/components/admin/registration-detail-panels/tab-summary/`), add a section below the main registration info:

```tsx
<div className="space-y-2">
  <h3 className="font-medium text-sm">Pemegang Tiket</h3>
  <table className="w-full text-sm border rounded-md overflow-hidden">
    <thead className="bg-muted/50">
      <tr>
        <th className="px-3 py-2 text-left">#</th>
        <th className="px-3 py-2 text-left">Nama</th>
        <th className="px-3 py-2 text-left">No. Member</th>
        <th className="px-3 py-2 text-left">Status</th>
        <th className="px-3 py-2 text-right">Harga</th>
      </tr>
    </thead>
    <tbody>
      {ticket.holders.map((h) => (
        <tr key={h.id} className="border-t">
          <td className="px-3 py-2">{h.sortOrder}</td>
          <td className="px-3 py-2">{h.holderName}</td>
          <td className="px-3 py-2">{h.claimedMemberNumber ?? "—"}</td>
          <td className="px-3 py-2">
            <MemberValidationBadge validation={h.memberValidation} />
          </td>
          <td className="px-3 py-2 text-right">{formatIdr(h.ticketPriceApplied)}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/registrations/ src/components/admin/registration-detail-panels/
git commit -m "feat(admin): show RegistrationHolder list in registration detail summary tab"
```

---

## Task 10: Update Reports and CSV

**Files:**
- Modify: `src/lib/reports/queries.ts`
- Modify: `src/lib/reports/csv.ts`

- [ ] **Step 1: Update `getEventReport` in `queries.ts`**

Replace `ticketRole`-based queries with `holders`-based aggregates. The key change: member/non-member count now comes from `RegistrationHolder.memberValidation`, and ticket revenue from `RegistrationHolder.ticketPriceApplied`.

```ts
// Replace the memberCount query:
prisma.registrationHolder.count({
  where: {
    registration: { eventId },
    memberValidation: { in: ["valid", "overridden"] },
  },
}),

// Replace ticketRevAgg:
prisma.registrationHolder.aggregate({
  where: { registration: { eventId, status: RegistrationStatus.approved } },
  _sum: { ticketPriceApplied: true },
}),

// Replace menuRevAgg:
prisma.registrationHolder.aggregate({
  where: { registration: { eventId, status: RegistrationStatus.approved } },
  _sum: { mandatoryMenuPriceApplied: true },
}),
```

Remove `partnerCount` (no longer relevant). Add `holderCount` as total ticket count:
```ts
prisma.registrationHolder.count({
  where: { registration: { eventId } },
}),
```

- [ ] **Step 2: Update `generateRegistrationsCsv` in `csv.ts`**

Replace partner columns with holder-based columns. Each row is now one Registration with N holders inlined:

New columns: `Registration ID`, `Kategori Tiket`, `Jumlah Tiket`, `Kontak WA`, `Status`, `Holder 1 Nama`, `Holder 1 Member`, `Holder 2 Nama`, `Holder 2 Member` (expand up to max qty).

Query update — include `holders` in the Registration select:
```ts
holders: {
  orderBy: { sortOrder: "asc" },
  select: { holderName: true, claimedMemberNumber: true, memberValidation: true, ticketPriceApplied: true },
},
ticketCategory: { select: { name: true } },
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/
git commit -m "feat(reports): update queries and CSV to use RegistrationHolder aggregates"
```

---

## Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Data Model section**

In CLAUDE.md, find the `**Registration**` bullet under Data model and replace with:

```
- **`Registration`** — **satu baris per transaksi** (bukan per tiket); `ticketCategoryId` → `EventTicketCategory`; `ticketQty` = total tiket; `computedTotalAtSubmit` = sum `ticketPriceApplied` semua holder; status flows: `submitted → pending_review → approved / rejected / payment_issue`; konsep partner **dihapus**
- **`RegistrationHolder`** — satu baris per tiket dalam transaksi; `sortOrder=1` = pemesan utama; `holderName`, `claimedMemberNumber`, `memberValidation`, `ticketPriceApplied` (snapshot), `mandatoryMenuItemId` (nullable jika menu tidak wajib)
- **`EventTicketCategory`** — kategori tiket per acara: `name`, `regularPrice`, `memberPrice`, `maxQtyPerPerson` (null=tak terbatas), `isActive`, `sortOrder`
```

Update the `**Event**` bullet to remove `ticketMemberPrice`/`ticketNonMemberPrice` and add `multiCategoryPurchase`, `ticketCategories`.

Remove `TicketRole` enum references and `TicketPriceType` references from the data model section.

- [ ] **Step 2: Update Key library modules**

Update `lib/pricing/compute-submit-total.ts` entry to reflect new `SubmitPricingInput` shape (holders array, not primary+partner).

Update `lib/actions/submit-registration.ts` entry to note it now creates `Registration` + `RegistrationHolder[]`.

Add new entries:
```
- `lib/tickets/get-event-ticket-categories.ts` — `getEventTicketCategories` / `getActiveEventTicketCategories` — query kategori tiket aktif per acara
- `lib/actions/admin-ticket-categories.ts` — CRUD server actions untuk `EventTicketCategory`
- `lib/forms/ticket-category-schema.ts` — Zod schema untuk form kategori tiket
```

Remove partner-specific entries:
```
- lib/registrations/partner-registration.ts  ← REMOVED
- lib/actions/lookup-member-partner-eligibility.ts  ← REMOVED
- lib/actions/check-member-seat-for-event.ts  ← REMOVED
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): update data model and lib modules for ticket categories redesign"
```

---

## Task 12: Final Build + Smoke Test

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: exits 0. Fix any remaining TypeScript errors before continuing.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: all tests pass. Any failing tests for deleted functionality (partner tests) should be deleted along with their source files.

- [ ] **Step 3: Start dev server and verify**

```bash
pnpm dev
```

Manually verify:
1. `http://localhost:3000` — homepage loads
2. Open an event — registration form shows category picker + qty + holder cards
3. `http://localhost:3000/admin/events/[any-id]/edit` — Harga & Tiket tab shows category CRUD
4. Admin registration detail — Ringkasan tab shows holder table

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(ticket-categories): final cleanup and verified build"
```
