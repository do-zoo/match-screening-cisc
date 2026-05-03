# Venue management — menu & voucher (live link) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `Venue` + `VenueMenuItem` + `EventVenueMenuItem`, replace `Event.venueName`/`venueAddress` and `EventMenuItem` with venue-backed live links, rewire public submit + admin + reports + voucher redemption, and enforce **strict freeze** when any `Registration` exists for an event.

**Architecture:** One **canonical menu row** per `VenueMenuItem`. Each `Event` references a `Venue` and exposes a **subset** via `EventVenueMenuItem` (optional per-event `sortOrder`). `TicketMenuSelection` and `Ticket.voucherRedeemedMenuItemId` reference `VenueMenuItem` ids. Data moves from legacy tables via a **TypeScript backfill script** (one `Venue` per existing `Event` at migration time — preserves 1:1 mapping without dedupe guesswork). Application guards enforce venue/subset invariants and strict freeze for `venueId`, join rows, and frozen `VenueMenuItem` fields.

**Tech stack:** Next.js App Router, Prisma + PostgreSQL, Zod, Vitest (mocked `prisma`), existing `ActionResult` / `guardOwnerOrAdmin` patterns.

**Authoritative spec:** [`docs/superpowers/specs/2026-05-04-venue-management-menu-voucher-design.md`](../specs/2026-05-04-venue-management-menu-voucher-design.md)

---

## File map (create / modify)

| Path | Role |
|------|------|
| `prisma/schema.prisma` | Add `Venue`, `VenueMenuItem`, `EventVenueMenuItem`; `Event.venueId`; remove `Event.venueName`, `venueAddress`, `EventMenuItem`; point `Ticket` / `TicketMenuSelection` at `VenueMenuItem`. |
| `prisma/migrations/<ts>_venue_menu/migration.sql` | Structural DDL (new tables, FK changes, drop old). |
| `scripts/backfill-venue-menu-from-events.ts` | One-off data migration: create venue + items + join + rewrite ticket FKs; run after expand DDL, before NOT NULL / drop old columns if split. |
| `src/lib/venues/venue-menu-frozen-item-ids.ts` | Db query helper: IDs of `VenueMenuItem` rows locked by spec §6.3. |
| `src/lib/venues/assert-event-venue-subset.ts` | Pure validation: incoming `venueMenuItemId[]` ⊆ venue’s catalog and match `Event.venueId`. |
| `src/lib/events/event-edit-guards.ts` | Extend `EventIntegritySnapshot` + `findLockedViolations` for `venueId`. |
| `src/lib/forms/admin-event-form-schema.ts` | Replace `venueName`/`venueAddress`/inline menu drafts with `venueId` + `linkedVenueMenuItems`. |
| `src/lib/actions/admin-venues.ts` | Server actions: venue CRUD, `VenueMenuItem` CRUD with freeze checks. |
| `src/lib/actions/admin-events.ts` | Create/update/delete paths for `venueId`, `EventVenueMenuItem`, remove `eventMenuItem` writes. |
| `src/lib/actions/submit-registration.ts` | Include `venue` + `eventVenueMenuItems` → `venueMenuItem` payload for schema. |
| `src/lib/actions/voucher-redemption.ts` | Load `VenueMenuItem`; verify `venueId` matches event’s venue and row is in subset + `voucherEligible`. |
| `src/lib/forms/submit-registration-schema.ts` | Keep menu id validation against **subset** ids (still `menuItems` or rename in payload — keep client stable if possible). |
| `src/lib/events/event-registration-page.ts`, `src/lib/events/public-active-events.ts`, `src/components/public/event-serialization.ts` | Resolve `venueName`/`venueAddress` (or flattened `venueName`) from `event.venue`. |
| `src/lib/reports/queries.ts`, `src/lib/reports/csv.ts` | `TicketMenuSelection` → join `VenueMenuItem` for names. |
| `src/app/admin/venues/page.tsx`, `.../new`, `.../[venueId]/edit` | List + CRUD shells (reuse patterns from `/admin/events`). |
| `src/app/admin/events/[eventId]/edit/page.tsx`, `src/app/admin/events/new/page.tsx` | Loader + default values for venue + linked items. |
| `src/components/admin/forms/event-admin-form.tsx` | Venue `<Select>` + subset picker/reorder UI (multi-select chips or dual listbox). |
| New venue form components under `src/components/admin/venues/` | Optional split: `venue-form.tsx`, `venue-menu-items-editor.tsx`. |
| `src/lib/admin/global-nav-flags.ts`, `src/components/admin/admin-app-shell.tsx` | `venues` nav flag + link “Venue”. |
| `src/lib/admin/load-admin-dashboard.ts`, `dashboard-view-model.ts`, `src/app/admin/page.tsx` | `venue?.name ?? ""` instead of `venueName` column. |
| `src/components/admin/registration-detail.tsx`, `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` | Prisma selects + voucher panel props use `VenueMenuItem`. |
| `prisma/seed.ts` | Create `Venue` + items + link events. |
| `src/lib/dashboard-view-model.test.ts`, `submit-registration-schema.test.ts`, `voucher-redemption.test.ts`, `admin-events` tests | Update mocks/selectors. |

---

### Task 1: Prisma schema + migrations M1 / M2

**Files:**
- Modify: `prisma/schema.prisma` twice (commit M1 before backfill; commit M2 after backfill)

#### M1 — expand (before backfill script)

- [ ] **Step 1a: Add parallel venue graph; keep legacy columns and `EventMenuItem`**

- Create `Venue`, `VenueMenuItem`, `EventVenueMenuItem` models as in Task 2 prerequisites.
- Add to `Event`:
  - `venueId String?` and `venue Venue? @relation(...)` plus `eventVenueMenuItems EventVenueMenuItem[]`
  - **Retain** `venueName`, `venueAddress`, `menuItems EventMenuItem[]` unchanged.
- **Do not** change `TicketMenuSelection` / `Ticket` relations yet (still `EventMenuItem`).

Run:

```bash
pnpm prisma migrate dev --name venue_menu_m1_expand
```

- [ ] **Step 1b: Commit M1**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "chore(prisma): venue menu M1 expand"
```

#### M2 — contract (after Task 2 script succeeds)

- [ ] **Step 1c: Final schema — match end state below**

- `Event.venueId` **required**; **remove** `venueName`, `venueAddress`, relation `menuItems` / model `EventMenuItem`.
- Point `TicketMenuSelection.menuItemId` and `Ticket.voucherRedeemedMenuItemId` at `VenueMenuItem` (relations as below).

```prisma
model Venue {
  id        String   @id @default(cuid())
  name      String
  address   String   @db.Text
  notes     String?  @db.Text
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  menuItems VenueMenuItem[]
  events    Event[]
}

model VenueMenuItem {
  id              String   @id @default(cuid())
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  name            String
  price           Int
  sortOrder       Int      @default(0)
  voucherEligible Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  eventLinks         EventVenueMenuItem[]
  ticketSelections   TicketMenuSelection[]
  voucherRedemptions Ticket[]              @relation("VoucherRedemption")

  @@index([venueId])
}

model EventVenueMenuItem {
  eventId         String
  venueMenuItemId String
  sortOrder       Int?

  event         Event         @relation(fields: [eventId], references: [id], onDelete: Cascade)
  venueMenuItem VenueMenuItem @relation(fields: [venueMenuItemId], references: [id], onDelete: Restrict)

  @@id([eventId, venueMenuItemId])
  @@index([venueMenuItemId])
}

model Event {
  venueId               String
  venue                 Venue                  @relation(fields: [venueId], references: [id], onDelete: Restrict)
  eventVenueMenuItems   EventVenueMenuItem[]
}

model Ticket {
  voucherRedeemedMenuItemId String?
  voucherRedeemedItem       VenueMenuItem? @relation("VoucherRedemption", fields: [voucherRedeemedMenuItemId], references: [id], onDelete: SetNull)
}

model TicketMenuSelection {
  ticketId   String
  menuItemId String
  ticket     Ticket        @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  menuItem   VenueMenuItem @relation(fields: [menuItemId], references: [id], onDelete: Restrict)

  @@id([ticketId, menuItemId])
  @@index([menuItemId])
}
```

(Elipsis `model Event` — **merge** with existing `Event` fields in the real file; keep all non-venue fields.)

Run:

```bash
pnpm prisma migrate dev --name venue_menu_m2_contract
```

- [ ] **Step 1d: Commit M2**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "chore(prisma): venue menu M2 contract (drop EventMenuItem)"
```

**Execution order:** `1a → 1b → Task 2 → 1c migrate → 1d`. Application tasks (Tasks 3+) assume **final** Prisma schema (after M2).

---

### Task 2: Data backfill script (run between M1 and M2)

**Files:**
- Create: `scripts/backfill-venue-menu-from-events.ts`

**Default migration sequence (use unless production forces otherwise):**

1. **Migration M1 (expand):** Create `Venue`, `VenueMenuItem`, `EventVenueMenuItem`. Add `Event.venueId` **nullable**. Keep `Event.venueName`, `Event.venueAddress`, `EventMenuItem`, and **keep** `TicketMenuSelection` / `Ticket` foreign keys pointing at `EventMenuItem`.
2. **Run** `scripts/backfill-venue-menu-from-events.ts` (rewrites `menuItemId` / `voucherRedeemedMenuItemId` to new `VenueMenuItem` ids and sets `Event.venueId`).
3. **Migration M2 (contract):** Drop FK from `TicketMenuSelection` and `Ticket` to `EventMenuItem`; add FK to `VenueMenuItem`; drop `EventMenuItem` table; drop `Event.venueName` / `venueAddress`; set `Event.venueId` **NOT NULL**.

The script body below matches **after M1** and **before M2**.

- [ ] **Step 1: Add runnable script** (Prisma-only; one `Venue` per `Event`).

```typescript
/**
 * One-off backfill. Preconditions (adjust if your phased migration differs):
 * - Event has venueName, venueAddress; venueId nullable.
 * - EventMenuItem rows exist per event.
 * - TicketMenuSelection.menuItemId and Ticket.voucherRedeemedMenuItemId reference EventMenuItem ids.
 *
 * Creates Venue + VenueMenuItem + EventVenueMenuItem, sets Event.venueId, remaps ticket FKs.
 * After this: apply migration dropping EventMenuItem + venue text columns & setting venueId NOT NULL.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      venueName: true,
      venueAddress: true,
    },
  });

  for (const e of events) {
    const venue = await prisma.venue.create({
      data: { name: e.venueName, address: e.venueAddress },
    });

    await prisma.event.update({
      where: { id: e.id },
      data: { venueId: venue.id },
    });

    const oldItems = await prisma.eventMenuItem.findMany({
      where: { eventId: e.id },
      orderBy: { sortOrder: "asc" },
    });

    const idMap = new Map<string, string>();

    for (const o of oldItems) {
      const created = await prisma.venueMenuItem.create({
        data: {
          venueId: venue.id,
          name: o.name,
          price: o.price,
          sortOrder: o.sortOrder,
          voucherEligible: o.voucherEligible,
        },
      });
      idMap.set(o.id, created.id);
      await prisma.eventVenueMenuItem.create({
        data: {
          eventId: e.id,
          venueMenuItemId: created.id,
          sortOrder: o.sortOrder,
        },
      });
    }

    for (const [oldId, newId] of idMap) {
      await prisma.ticketMenuSelection.updateMany({
        where: { menuItemId: oldId },
        data: { menuItemId: newId },
      });
      await prisma.ticket.updateMany({
        where: { voucherRedeemedMenuItemId: oldId },
        data: { voucherRedeemedMenuItemId: newId },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run script on dev DB**

```bash
pnpm exec tsx scripts/backfill-venue-menu-from-events.ts
```

Expected: exits 0; row counts match.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-venue-menu-from-events.ts
git commit -m "chore(db): backfill Venue from Event/EventMenuItem"
```

---

### Task 3: Frozen VenueMenuItem query helper (+ unit test via mocked prisma)

**Files:**
- Create: `src/lib/venues/venue-menu-frozen-item-ids.ts`
- Create: `src/lib/venues/venue-menu-frozen-item-ids.test.ts`

- [ ] **Step 1: Implement query**

```typescript
import type { PrismaClient } from "@prisma/client";

/** VenueMenuItem ids that appear on any event which already has >=1 Registration — spec §6.3 */
export async function venueMenuItemIdsFrozenByExistingRegistrations(
  db: Pick<PrismaClient, "eventVenueMenuItem">,
): Promise<Set<string>> {
  const rows = await db.eventVenueMenuItem.findMany({
    where: {
      event: {
        registrations: { some: {} },
      },
    },
    select: { venueMenuItemId: true },
    distinct: ["venueMenuItemId"],
  });
  return new Set(rows.map((r) => r.venueMenuItemId));
}
```

- [ ] **Step 2: Failing-isn’t-needed test — verify query shape**

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/db/prisma", () => ({
  prisma: { eventVenueMenuItem: { findMany: vi.fn() } },
}));
import { prisma } from "@/lib/db/prisma";
import { venueMenuItemIdsFrozenByExistingRegistrations } from "./venue-menu-frozen-item-ids";

describe("venueMenuItemIdsFrozenByExistingRegistrations", () => {
  beforeEach(() => {
    vi.mocked(prisma.eventVenueMenuItem.findMany).mockReset();
  });

  it("returns distinct ids for join rows tied to events with registrations", async () => {
    vi.mocked(prisma.eventVenueMenuItem.findMany).mockResolvedValueOnce([
      { venueMenuItemId: "a" },
      { venueMenuItemId: "b" },
    ] as never);
    const s = await venueMenuItemIdsFrozenByExistingRegistrations(prisma);
    expect(s.has("a")).toBe(true);
    expect(prisma.eventVenueMenuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { event: { registrations: { some: {} } } },
      }),
    );
  });
});
```

Run:

```bash
pnpm vitest run src/lib/venues/venue-menu-frozen-item-ids.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/venues/venue-menu-frozen-item-ids.ts src/lib/venues/venue-menu-frozen-item-ids.test.ts
git commit -m "feat(venues): query frozen VenueMenuItem ids"
```

---

### Task 4: Pure subset invariant

**Files:**
- Create: `src/lib/venues/assert-event-venue-subset.ts`
- Create: `src/lib/venues/assert-event-venue-subset.test.ts`

- [ ] **Step 1: Implement**

```typescript
/** Returns Indonesian error message or null when ok. */
export function validateVenueSubsetForEvent(opts: {
  eventVenueId: string;
  venueMenuItemIds: string[];
  catalogById: Map<string, { venueId: string }>;
}): string | null {
  for (const id of opts.venueMenuItemIds) {
    const row = opts.catalogById.get(id);
    if (!row) return "Item menu tidak termasuk dalam katalog venue.";
    if (row.venueId !== opts.eventVenueId) return "Item menu tidak sesuai venue acara.";
  }
  return null;
}
```

- [ ] **Step 2: Test**

```typescript
import { describe, expect, it } from "vitest";
import { validateVenueSubsetForEvent } from "./assert-event-venue-subset";

describe("validateVenueSubsetForEvent", () => {
  it("rejectsunknown id", () => {
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: new Map(),
      }),
    ).toMatch(/katalog/);
  });

  it("rejects mismatched venue", () => {
    const m = new Map([["x", { venueId: "other" }]]);
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: m,
      }),
    ).toMatch(/venue/);
  });

  it("accepts aligned ids", () => {
    const m = new Map([["x", { venueId: "v1" }]]);
    expect(
      validateVenueSubsetForEvent({
        eventVenueId: "v1",
        venueMenuItemIds: ["x"],
        catalogById: m,
      }),
    ).toBeNull();
  });
});
```

Run: `pnpm vitest run src/lib/venues/assert-event-venue-subset.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/venues/assert-event-venue-subset.ts src/lib/venues/assert-event-venue-subset.test.ts
git commit -m "feat(venues): validate event menu subset against venue catalog"
```

---

### Task 5: Event edit guards — freeze `venueId`

**Files:**
- Modify: `src/lib/events/event-edit-guards.ts`

- [ ] **Step 1: Extend snapshot + violations**

Replace type and function bodies with:

```typescript
export type EventIntegritySnapshot = {
  slug: string;
  venueId: string;
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  voucherPrice: number | null;
  pricingSource: PricingSource;
  picAdminProfileId: string;
  bankAccountId: string;
};

export function findLockedViolations(opts: {
  registrationCount: number;
  persisted: EventIntegritySnapshot;
  candidate: Partial<{
    slug: string;
    venueId: string;
    menuMode: MenuMode;
    menuSelection: MenuSelection;
  }>;
}): Array<keyof Pick<
  EventIntegritySnapshot,
  "slug" | "menuMode" | "menuSelection" | "venueId"
>> {
  if (opts.registrationCount === 0) return [];

  const out: Array<
    "slug" | "menuMode" | "menuSelection" | "venueId"
  > = [];

  const nextSlug = opts.candidate.slug ?? opts.persisted.slug;
  if (nextSlug !== opts.persisted.slug) out.push("slug");

  const nextVenue =
    opts.candidate.venueId ?? opts.persisted.venueId;
  if (nextVenue !== opts.persisted.venueId) out.push("venueId");

  const nextMode = opts.candidate.menuMode ?? opts.persisted.menuMode;
  if (nextMode !== opts.persisted.menuMode) out.push("menuMode");

  const nextSel =
    opts.candidate.menuSelection ?? opts.persisted.menuSelection;
  if (nextSel !== opts.persisted.menuSelection) out.push("menuSelection");

  return out;
}
```

- [ ] **Step 2: Run typecheck indirectly**

```bash
pnpm exec tsc --noEmit --pretty false 2>&1 | head -40
```

Fix imports at call sites in Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/lib/events/event-edit-guards.ts
git commit -m "feat(events): lock venueId when registrations exist"
```

---

### Task 6: Admin event Zod payload

**Files:**
- Modify: `src/lib/forms/admin-event-form-schema.ts`

- [ ] **Step 1: Replace venue + menu drafts**

Remove `venueName`, `venueAddress`, and `menuItemDraftSchema`-based `menuItems`. Add:

```typescript
const linkedVenueMenuItemSchema = z.object({
  venueMenuItemId: z.string().min(1),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
});

export const adminEventUpsertSchema = z
  .object({
    // ... unchanged fields ...
    venueId: z.string().min(1),
    linkedVenueMenuItems: z.array(linkedVenueMenuItemSchema).min(1),
    // REMOVE: venueName, venueAddress, menuItems
  })
  .superRefine((v, ctx) => {
    // ...existing date checks...
    const seen = new Set<string>();
    for (const row of v.linkedVenueMenuItems) {
      if (seen.has(row.venueMenuItemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["linkedVenueMenuItems"],
          message: "Item menu tidak boleh duplikat.",
        });
        return;
      }
      seen.add(row.venueMenuItemId);
    }
  });
```

Re-run `pnpm exec tsc` after callers updated.

- [ ] **Step 2: Commit**

```bash
git add src/lib/forms/admin-event-form-schema.ts
git commit -m "feat(forms): admin event venueId + linked venue menu subset"
```

---

### Task 7: `admin-events.ts` write path

**Files:**
- Modify: `src/lib/actions/admin-events.ts`

- [ ] **Step 1: `createAdminEvent`** — inside transaction after `event.create`:

  - Set `venueId: data.venueId`.
  - Resolve all `VenueMenuItem` for `data.linkedVenueMenuItems` (`findMany` where `venueId === event’s venue`; build `catalogById`).
  - Call `validateVenueSubsetForEvent`; on error `return rootError(...)`.
  - `eventVenueMenuItem.createMany` with mapped rows.

- [ ] **Step 2: `updateAdminEvent`**

  - `existing` select must include `venueId`, `_count.registrations`, and `eventVenueMenuItems: { select: { venueMenuItemId: true, sortOrder: true }}` (not legacy menu items).
  - Build `persistedIntegrity` with `venueId: existing.venueId`.
  - Extend `findLockedViolations({ candidate: { menuMode: data.menuMode, menuSelection: data.menuSelection }})` → add `venueId: data.venueId`.
  - When `registrationCount > 0`: **reject** payload if `linkedVenueMenuItems` differs from persisted (deep compare sorted ids + sortOrders) → `rootError("Susunan menu acara tidak dapat diubah …")`.
  - When `registrationCount === 0`: delete missing join rows (`deleteMany`), `createMany` new links, reuse `validateVenueSubsetForEvent`.

- [ ] **Step 3: Remove** every `eventMenuItem` CRUD branch.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/lib/actions/admin-events.test.ts
```

Adjust mocks to include `venueId` / `eventVenueMenuItems` as needed until green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-events.ts src/lib/actions/admin-events.test.ts
git commit -m "feat(admin): persist EventVenueMenuItem + venue freeze"
```

---

### Task 8: Venue CRUD actions

**Files:**
- Create: `src/lib/actions/admin-venues.ts`

- [ ] **Step 1: Implement** (sketch — fill `revalidatePath` targets to match routes you add):

```typescript
"use server";

import {
  guardOwnerOrAdmin,
  isAuthError,
} from "@/lib/actions/guard";
import { prisma } from "@/lib/db/prisma";
import { ok, rootError, type ActionResult } from "@/lib/forms/action-result";
import { venueMenuItemIdsFrozenByExistingRegistrations } from "@/lib/venues/venue-menu-frozen-item-ids";

async function frozenSet() {
  return venueMenuItemIdsFrozenByExistingRegistrations(prisma);
}

export async function updateVenueMenuItemAction(input: {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  voucherEligible: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await guardOwnerOrAdmin();
  } catch (e) {
    if (isAuthError(e)) return rootError("Tidak diizinkan.");
    throw e;
  }
  const frozen = await frozenSet();
  if (frozen.has(input.id)) {
    return rootError(
      "Item menu terkunci karena sudah dipakai acara yang memiliki pendaftaran.",
    );
  }
  await prisma.venueMenuItem.update({
    where: { id: input.id },
    data: {
      name: input.name,
      price: input.price,
      sortOrder: input.sortOrder,
      voucherEligible: input.voucherEligible,
    },
  });
  return ok({ id: input.id });
}
```

Add `createVenue`, `updateVenue`, `deleteVenue` (block delete if `events` count > 0), `createVenueMenuItem`, `deleteVenueMenuItem` (block if frozen or referenced by join).

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/admin-venues.ts
git commit -m "feat(admin): venue and venue menu item actions with freeze"
```

---

### Task 9: Public + submit path

**Files:**
- Modify: `src/lib/actions/submit-registration.ts`
- Modify: `src/lib/events/event-registration-page.ts`
- Modify: `src/lib/forms/submit-registration-schema.ts` (pass allowed ids from loader)

Pattern for event load:

```typescript
const event = await prisma.event.findFirst({
  where: { slug, status: "active" },
  include: {
    venue: true,
    eventVenueMenuItems: {
      orderBy: { sortOrder: "asc" },
      include: { venueMenuItem: true },
    },
  },
});

const menuItemsForSchema = event.eventVenueMenuItems.map((x) => ({
  id: x.venueMenuItem.id,
}));

const menuItemsPayload = event.eventVenueMenuItems.map((x) =>
  Object.assign({}, x.venueMenuItem, {
    sortOrder: x.sortOrder ?? x.venueMenuItem.sortOrder,
  }),
);
```

Use `menuItemsPayload` sorted for UI + `computeSubmitTotal` inputs.

Commit:

```bash
git add src/lib/actions/submit-registration.ts src/lib/events/event-registration-page.ts src/lib/forms/submit-registration-schema.ts
pnpm vitest run src/lib/forms/submit-registration-schema.test.ts
git commit -m "feat(public): submit registration uses VenueMenuItem subset"
```

---

### Task 10: Voucher redemption

**Files:**
- Modify: `src/lib/actions/voucher-redemption.ts`
- Modify: `src/lib/actions/voucher-redemption.test.ts`

- [ ] Replace `eventMenuItem` with `venueMenuItem.findUnique` plus:

```typescript
const inSubset = await prisma.eventVenueMenuItem.findUnique({
  where: {
    eventId_venueMenuItemId: {
      eventId,
      venueMenuItemId: menuItemId,
    },
  },
});
if (!inSubset) return rootError("Item tidak dipilih untuk acara ini.");
```

Run:

```bash
pnpm vitest run src/lib/actions/voucher-redemption.test.ts
git add src/lib/actions/voucher-redemption.ts src/lib/actions/voucher-redemption.test.ts
git commit -m "fix(voucher): redeem against VenueMenuItem + event subset"
```

---

### Task 11: Reports + CSV

**Files:**
- Modify: `src/lib/reports/queries.ts`

Replace:

```typescript
await prisma.eventMenuItem.findMany({
```

with:

```typescript
await prisma.venueMenuItem.findMany({
```

(and `where: { id: { in: itemIds }}}` unchanged).

Modify: `src/lib/reports/csv.ts` selects `menuItem` still works if relation name on `VenueMenuItem` matches Prisma relation from `TicketMenuSelection`.

Commit:

```bash
git add src/lib/reports/queries.ts src/lib/reports/csv.ts
pnpm test
git commit -m "feat(reports): menu stats via VenueMenuItem"
```

---

### Task 12: Admin UI — event form + pages

**Files:**
- Modify: `src/components/admin/forms/event-admin-form.tsx`
- Modify: `src/app/admin/events/[eventId]/edit/page.tsx`
- Modify: `src/app/admin/events/new/page.tsx`

- Fetch venues list (`prisma.venue.findMany({ where:{isActive:true}, orderBy:{name:'asc'}})`) in server pages; pass as prop.
- Replace name/address inputs with `Select` on `venueId`.
- Menu section: load full `venue.menuItems` when user picks venue; multiselect into `linkedVenueMenuItems` with drag reorder (or numeric `sortOrder` fields per row).
- Disable venue + menu subset controls when `registrationCount > 0` (pass `readOnlyVenueAndMenu: boolean`).

Commit:

```bash
git add src/components/admin/forms/event-admin-form.tsx src/app/admin/events/new/page.tsx src/app/admin/events/[eventId]/edit/page.tsx
git commit -m "feat(admin): event form uses venue + menu subset"
```

---

### Task 13: Admin UI — venues module + nav

**Files:**
- Create: `src/app/admin/venues/page.tsx`, `src/app/admin/venues/new/page.tsx`, `src/app/admin/venues/[venueId]/edit/page.tsx`
- Modify: `src/lib/admin/global-nav-flags.ts`, `src/components/admin/admin-app-shell.tsx`

`GlobalSidebarNav` add `venues: boolean` (same rule as `acara` — `hasOperationalOwnerParity`).

Link:

```tsx
{navFlags.venues ? (
  <Link href="/admin/venues" ...>Venue</Link>
) : null}
```

Commit:

```bash
git add src/app/admin/venues src/lib/admin/global-nav-flags.ts src/components/admin/admin-app-shell.tsx
git commit -m "feat(admin): venues CRUD screens and nav"
```

---

### Task 14: Registration detail + dashboard + public cards

**Files:**
- Modify: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` — `include` paths for menu.
- Modify: `src/components/admin/registration-detail.tsx` — `event.venue.name`, `event.eventVenueMenuItems` → flat menu list for voucher panel.
- Modify: `src/lib/admin/load-admin-dashboard.ts`, `src/lib/admin/dashboard-view-model.ts`, `src/app/admin/page.tsx`, `src/lib/events/public-active-events.ts`, `src/components/public/event-serialization.ts`, `src/components/public/home-landing.tsx`, `src/components/public/event-summary.tsx`, `src/components/public/event-card.tsx`

Replace `venueName` string field with `venue.name` (or optional chaining).

Commit:

```bash
git add src/app/admin/events src/components/admin/registration-detail.tsx src/lib/admin src/lib/events/public-active-events.ts src/components/public
git commit -m "chore: read venue display from Venue relation"
```

---

### Task 15: Seed + final verification

**Files:**
- Modify: `prisma/seed.ts`

Rebuild seed to create `Venue` + `VenueMenuItem` + `Event` with `venueId` + `EventVenueMenuItem` links; remove `venueName`/`EventMenuItem` usage.

Run:

```bash
pnpm prisma migrate deploy
pnpm prisma db seed
pnpm lint
pnpm test
pnpm build
```

Expected: all succeed.

Commit:

```bash
git add prisma/seed.ts
git commit -m "chore(seed): venue-backed events"
```

---

## Spec coverage (self-review)

| Spec section | Task(s) |
|--------------|---------|
| §3 Models | 1, 2 |
| §3.4 Join + invariant | 4, 6, 7, 9 |
| §3.5 Replace EventMenuItem | 1, 2, 7, 9–11 |
| §3.6 Snapshots | 9 (ids only change; snapshots unchanged) |
| §4 Auth | 7, 8 (`guardOwnerOrAdmin`) |
| §5 Admin IA | 12, 13 |
| §6 Strict freeze | 3, 5, 7, 8 |
| §7 Validation | 4, 7, 9, 10 |
| §8 Migration | 1, 2, 15 |
| §9 Testing | 3, 4, 7, 9, 10, 11 |

## Placeholder scan

- Task 2 binds to the **three-step expand → script → contract** migration sequence above; alter script only if production demands a different cutover — document the divergence in commit message when doing so.

## Type consistency

- `EventIntegritySnapshot.venueId` threaded through `admin-events` `persistedIntegrity` and `findLockedViolations` candidate.
- `linkedVenueMenuItems[].venueMenuItemId` matches `EventVenueMenuItem.venueMenuItemId` and public schema allowed ids.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-venue-management-menu-voucher.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
