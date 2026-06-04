# Mandatory Menu + Separate Partner Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign event registration to support mandatory per-ticket menus, separate partner registrants with independent attendance, explicit event timing, and per-event pricing (no global defaults).

**Architecture:** Database-first approach—update Prisma schema, create migration, reset dummy data, then layer in form validation, pricing logic, server actions, and UI. Partner registrations are separate Registration records (not paired Tickets), enabling per-person attendance tracking and simpler reporting.

**Tech Stack:** Next.js, Prisma, React Hook Form, Zod, shadcn/ui, Vercel Blob, TypeScript

**Implementation Duration:** ~40-50 tasks across 7 phases

---

## File Structure Overview

### Database & Schema

- **prisma/schema.prisma** — Event & Registration model changes, add timing fields, remove old fields
- **prisma/migrations/[timestamp]\_redesign_event_registration** — Migration to reset & rebuild schema

### Forms & Validation

- **src/lib/forms/admin-event-form-schema.ts** — New timing fields, mandatory menu validation
- **src/lib/forms/submit-registration-schema.ts** — Remove menu selection, keep mandatory menu
- **src/components/admin/forms/event-admin-form.tsx** — Reorder fields, add cover upload at position 2

### Pricing & Business Logic

- **src/lib/pricing/compute-submit-total.ts** — Simplify: ticket + mandatory menu only (no vouchers, no optional menus)
- **src/lib/events/event-edit-guards.ts** — Edit locking (after closeRegistrationAt)
- **src/lib/events/event-registration-window.ts** — Check if registration is open

### Server Actions & Registration

- **src/lib/actions/admin-events.ts** — Create/update event with timing validation
- **src/lib/actions/submit-registration.ts** — Create primary + partner registrations, shared upload
- **src/lib/registrations/admin-ticket-context.ts** — Rename/adapt for separate registrations

### Admin UI (Inbox & Detail)

- **src/app/admin/events/[eventId]/inbox/page.tsx** — List registrations (primary & partner as separate rows)
- **src/components/admin/registration-detail.tsx** — Show primary + link to partners (or vice versa)
- **src/components/admin/registration-detail-panels/** — Independent status/attendance per registrant

### Public UI (Registration Form)

- **src/components/public/registration-form/registration-form.tsx** — Remove menu selection section
- **src/components/public/registration-form/mandatory-menu-selection.tsx** — New: radio buttons for mandatory menu
- **src/components/public/registration-form/partner-ticket-section.tsx** — Add partner mandatory menu selection

### Reports

- **src/lib/reports/queries.ts** — Count per-registrant (not pairs), attendance per registrant
- **src/lib/reports/csv.ts** — Export per registrant (not pair)

### Helpers & Utils

- **src/lib/registrations/partner-registration.ts** — Helpers: find primary, find partners, etc.
- **src/lib/events/event-timing.ts** — Helpers: isRegistrationOpen(), hasEventPassed(), etc.

---

## Phase 1: Database Schema & Migration

### Task 1: Update Prisma Schema for Event

**Files:**

- Modify: `prisma/schema.prisma:253-299` (Event model)

**Task:**
Update the Event model to replace startAt/endAt with 4 timing fields and add mandatoryMenuItemIds.

- [ ] **Step 1: Edit Event model in schema.prisma**

Replace the Event model fields:

```prisma
model Event {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  summary     String
  description String   @db.Text

  venueId String
  venue   Venue  @relation(fields: [venueId], references: [id], onDelete: Restrict)

  coverBlobUrl  String
  coverBlobPath String

  // NEW: Timeline fields (replaces startAt, endAt)
  openRegistrationAt  DateTime
  closeRegistrationAt DateTime
  openGateAt          DateTime
  kickOffAt           DateTime

  registrationManualClosed Boolean @default(false)
  registrationCapacity     Int?
  status                   EventStatus @default(draft)

  // Updated: pricing is required (no global defaults)
  ticketMemberPrice    Int
  ticketNonMemberPrice Int
  pricingSource        PricingSource @default(overridden)

  // NEW: Mandatory menu (JSON array of VenueMenuItem IDs)
  mandatoryMenuItemIds String[] @default([])

  picAdminProfileId String
  picAdminProfile   AdminProfile @relation(fields: [picAdminProfileId], references: [id], onDelete: Restrict)

  bankAccountId String
  bankAccount   PicBankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  helpers               EventPicHelper[]
  registrations         Registration[]
  eventVenueMenuItems   EventVenueMenuItem[]

  @@index([status, kickOffAt])
  @@index([venueId])
  @@index([picAdminProfileId])
  @@index([bankAccountId])
}
```

- [ ] **Step 2: Verify no compilation errors**

```bash
cd /Users/mac/Documents/CISC/match-screening
npx prisma validate
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add event timing fields and mandatory menu to Event model"
```

---

### Task 2: Update Prisma Schema for Registration

**Files:**

- Modify: `prisma/schema.prisma:314-398` (Registration & Ticket models)

**Task:**
Update Registration model to add primaryRegistrationId, ticketRole, mandatoryMenuItemId, and pricing snapshot fields. Keep Ticket model for now but mark as legacy.

- [ ] **Step 1: Update Registration model**

Replace the Registration model:

```prisma
model Registration {
  id      String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Restrict)

  // Registrant identity
  contactName     String
  contactWhatsapp String
  claimedMemberNumber String?
  memberValidation    MemberValidation @default(unknown)
  memberId            String?
  member              MasterMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)

  // NEW: Partner relationship
  primaryRegistrationId String?
  primaryRegistration   Registration? @relation("PartnerLink", fields: [primaryRegistrationId], references: [id], onDelete: Cascade)
  partnerRegistrations  Registration[] @relation("PartnerLink")

  // NEW: Ticket info (moved from Ticket model)
  ticketRole      TicketRole
  ticketPriceType TicketPriceType
  mandatoryMenuItemId String
  mandatoryMenuItem   VenueMenuItem @relation(fields: [mandatoryMenuItemId], references: [id], onDelete: Restrict)

  // NEW: Pricing snapshot per registrant
  ticketPriceApplied        Int
  mandatoryMenuPriceApplied Int
  computedTotalAtSubmit     Int

  // Status (independent per registrant)
  status           RegistrationStatus @default(submitted)
  attendanceStatus AttendanceStatus   @default(unknown)
  rejectionReason    String?
  paymentIssueReason String?

  // Management
  claimedManagementPublicCode String?
  primaryManagementMemberId   String?
  primaryManagementMember     ManagementMember? @relation(fields: [primaryManagementMemberId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  uploads     Upload[]
  adjustments InvoiceAdjustment[]

  @@index([eventId, createdAt])
  @@index([status])
  @@index([primaryRegistrationId])
  @@index([attendanceStatus])
}
```

- [ ] **Step 2: Mark Ticket model as legacy (add comment)**

Add comment above Ticket model:

```prisma
/// DEPRECATED: Ticket data now stored on Registration.
/// Kept for backward compat; can be removed after migration.
model Ticket {
  // ... existing fields ...
}
```

- [ ] **Step 3: Verify schema**

```bash
npx prisma validate
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): update Registration model with partner relationship and pricing fields"
```

---

### Task 3: Create Prisma Migration

**Files:**

- Create: `prisma/migrations/[timestamp]_redesign_event_registration/migration.sql`

**Task:**
Create migration to add new columns to Event and Registration, drop old columns, reset data.

- [ ] **Step 1: Create migration file**

```bash
# Prisma will create a new migration directory with timestamp
npx prisma migrate dev --name redesign_event_registration
```

This opens an editor. Paste the migration SQL:

```sql
-- Drop existing data (dummy data reset)
DELETE FROM "Registration" WHERE 1=1;
DELETE FROM "Event" WHERE 1=1;
DELETE FROM "Ticket" WHERE 1=1;

-- Add new columns to Event
ALTER TABLE "Event"
ADD COLUMN "openRegistrationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "closeRegistrationAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "openGateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "kickOffAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "mandatoryMenuItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Drop old columns from Event
ALTER TABLE "Event"
DROP COLUMN "startAt",
DROP COLUMN "endAt",
DROP COLUMN "menuMode",
DROP COLUMN "menuSelection",
DROP COLUMN "voucherPrice";

-- Rename constraint if needed
ALTER TABLE "Event"
ADD CONSTRAINT event_timing_valid CHECK ("openRegistrationAt" < "closeRegistrationAt" AND "openGateAt" < "kickOffAt");

-- Add new columns to Registration
ALTER TABLE "Registration"
ADD COLUMN "primaryRegistrationId" TEXT,
ADD COLUMN "ticketRole" VARCHAR(10) NOT NULL DEFAULT 'primary',
ADD COLUMN "mandatoryMenuItemId" TEXT NOT NULL,
ADD COLUMN "ticketPriceApplied" INT NOT NULL DEFAULT 0,
ADD COLUMN "mandatoryMenuPriceApplied" INT NOT NULL DEFAULT 0;

-- Add foreign key for primaryRegistrationId
ALTER TABLE "Registration"
ADD CONSTRAINT "Registration_primaryRegistrationId_fkey"
FOREIGN KEY ("primaryRegistrationId") REFERENCES "Registration"("id") ON DELETE CASCADE;

-- Add foreign key for mandatoryMenuItemId
ALTER TABLE "Registration"
ADD CONSTRAINT "Registration_mandatoryMenuItemId_fkey"
FOREIGN KEY ("mandatoryMenuItemId") REFERENCES "VenueMenuItem"("id") ON DELETE RESTRICT;

-- Add indexes
CREATE INDEX "idx_registration_primary" ON "Registration"("primaryRegistrationId");
CREATE INDEX "idx_event_timing" ON "Event"("openRegistrationAt", "closeRegistrationAt");

-- Drop CommitteeTicketDefaults
DROP TABLE "CommitteeTicketDefaults" IF EXISTS;
```

Save and Prisma generates the migration.

- [ ] **Step 2: Run migration**

```bash
pnpm db:migrate:dev
```

Expected: Migration succeeds, Prisma client regenerates.

- [ ] **Step 3: Verify**

Check that `prisma/migrations/` has a new folder, and Prisma client updated:

```bash
ls prisma/migrations/ | tail -1  # Should show new timestamp folder
```

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "chore(db): migrate event timing and registration redesign"
```

---

## Phase 2: Form Validation Schemas

### Task 4: Update Admin Event Form Schema

**Files:**

- Modify: `src/lib/forms/admin-event-form-schema.ts`

**Task:**
Update schema to require timing fields, add mandatoryMenuItemIds, remove menuMode/menuSelection/voucherPrice.

- [ ] **Step 1: Read current schema**

```bash
cat src/lib/forms/admin-event-form-schema.ts | head -50
```

- [ ] **Step 2: Replace the schema object**

Replace `adminEventUpsertSchema`:

```typescript
export const adminEventUpsertSchema = z
  .object({
    title: z.string().trim().min(1, 'Judul acara wajib.'),
    summary: z.string().trim().min(1, 'Ringkasan acara wajib.'),
    descriptionHtml: z.string(),
    venueId: z.string().min(1, 'Venue wajib.'),
    linkedVenueMenuItems: z.array(linkedVenueMenuItemSchema).min(1, 'Min 1 menu item.'),

    // NEW: Explicit timing fields
    openRegistrationAtIso: z.string().min(1, 'Waktu buka registrasi wajib.'),
    closeRegistrationAtIso: z.string().min(1, 'Waktu tutup registrasi wajib.'),
    openGateAtIso: z.string().min(1, 'Waktu buka gate wajib.'),
    kickOffAtIso: z.string().min(1, 'Waktu mulai acara wajib.'),

    // NEW: Mandatory menu selection
    mandatoryMenuItemIds: z.array(z.string().min(1)).min(1, 'Pilih min 1 menu wajib.'),

    // Updated: Pricing required
    ticketMemberPrice: idrSchema,
    ticketNonMemberPrice: idrSchema,

    registrationCapacity: z.union([idrSchema, z.literal(null)]).optional(),
    registrationManualClosed: z.boolean(),
    status: z.nativeEnum(EventStatus),
    pricingSource: z.nativeEnum(PricingSource),
    picAdminProfileId: z.string().min(1, 'PIC wajib.'),
    bankAccountId: z.string().min(1, 'Rekening bank wajib.'),
    helperAdminProfileIds: z.array(z.string().min(1)),
    acknowledgeSensitiveChanges: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    // Parse dates
    const openReg = Date.parse(v.openRegistrationAtIso)
    const closeReg = Date.parse(v.closeRegistrationAtIso)
    const openGate = Date.parse(v.openGateAtIso)
    const kickOff = Date.parse(v.kickOffAtIso)

    // Validate openReg < closeReg
    if (!Number.isFinite(openReg)) {
      ctx.addIssue({
        code: 'custom',
        path: ['openRegistrationAtIso'],
        message: 'Waktu buka registrasi tidak valid.',
      })
    }
    if (!Number.isFinite(closeReg)) {
      ctx.addIssue({
        code: 'custom',
        path: ['closeRegistrationAtIso'],
        message: 'Waktu tutup registrasi tidak valid.',
      })
    }
    if (Number.isFinite(openReg) && Number.isFinite(closeReg) && closeReg <= openReg) {
      ctx.addIssue({
        code: 'custom',
        path: ['closeRegistrationAtIso'],
        message: 'Registrasi harus ditutup setelah dibuka.',
      })
    }

    // Validate openGate < kickOff
    if (!Number.isFinite(openGate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['openGateAtIso'],
        message: 'Waktu buka gate tidak valid.',
      })
    }
    if (!Number.isFinite(kickOff)) {
      ctx.addIssue({
        code: 'custom',
        path: ['kickOffAtIso'],
        message: 'Waktu mulai acara tidak valid.',
      })
    }
    if (Number.isFinite(openGate) && Number.isFinite(kickOff) && kickOff <= openGate) {
      ctx.addIssue({
        code: 'custom',
        path: ['kickOffAtIso'],
        message: 'Acara harus dimulai setelah gate dibuka.',
      })
    }

    // Validate pricing > 0
    if (v.ticketMemberPrice <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ticketMemberPrice'],
        message: 'Harga tiket member harus lebih dari 0.',
      })
    }
    if (v.ticketNonMemberPrice <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['ticketNonMemberPrice'],
        message: 'Harga tiket non-member harus lebih dari 0.',
      })
    }

    // Validate mandatory menu not empty
    if (v.mandatoryMenuItemIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['mandatoryMenuItemIds'],
        message: 'Pilih minimal 1 menu wajib.',
      })
    }

    // Validate linkedVenueMenuItems has at least 1 (for future add-ons)
    if (v.linkedVenueMenuItems.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['linkedVenueMenuItems'],
        message: 'Pilih minimal 1 menu item.',
      })
    }
  })

export type AdminEventUpsertInput = z.output<typeof adminEventUpsertSchema>
```

- [ ] **Step 3: Update type export**

Add/update type export at end of file:

```typescript
export type AdminEventUpsertInput = z.output<typeof adminEventUpsertSchema>
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/forms/admin-event-form-schema.test.ts
```

If no test exists, skip. If exists, verify validation works:

- Valid: all fields filled, timing in order, mandatory menu selected, prices > 0
- Invalid: missing fields, inverted timing, empty mandatory menu

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/admin-event-form-schema.ts
git commit -m "feat(schema): update event form validation for timing and mandatory menu"
```

---

### Task 5: Update Submit Registration Form Schema

**Files:**

- Modify: `src/lib/forms/submit-registration-schema.ts`

**Task:**
Remove `selectedMenuItemIds` (user doesn't select menu anymore), keep `primaryMandatoryMenuItemId` and add `partnerMandatoryMenuItemId`.

- [ ] **Step 1: Read current schema**

```bash
head -100 src/lib/forms/submit-registration-schema.ts
```

- [ ] **Step 2: Update schema**

Replace the schema fields:

```typescript
export const submitRegistrationSchema = z
  .object({
    // Primary registrant
    contactName: z.string().trim().min(1, 'Nama wajib.'),
    contactWhatsapp: z.string().trim().optional(),
    claimedMemberNumber: z.string().trim().optional(),

    // NEW: Primary mandatory menu selection
    primaryMandatoryMenuItemId: z.string().min(1, 'Pilih 1 menu wajib untuk primary.'),

    // Partner
    includePartner: z.boolean(),
    partnerName: z.string().trim().optional(),
    partnerWhatsapp: z.string().trim().optional(),
    partnerMemberNumber: z.string().trim().optional(),

    // NEW: Partner mandatory menu selection
    partnerMandatoryMenuItemId: z.string().min(1, 'Pilih 1 menu wajib untuk partner.').optional(),

    // REMOVED: selectedMenuItemIds (no longer needed)

    // Upload
    // (handled separately outside RHF)
  })
  .superRefine((v, ctx) => {
    // Validate primary
    if (!v.contactName) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactName'],
        message: 'Nama primary wajib.',
      })
    }

    // Validate partner if included
    if (v.includePartner) {
      if (!v.partnerName) {
        ctx.addIssue({
          code: 'custom',
          path: ['partnerName'],
          message: 'Nama partner wajib.',
        })
      }
      if (!v.partnerMandatoryMenuItemId) {
        ctx.addIssue({
          code: 'custom',
          path: ['partnerMandatoryMenuItemId'],
          message: 'Pilih 1 menu wajib untuk partner.',
        })
      }
    }
  })

export type SubmitRegistrationInput = z.output<typeof submitRegistrationSchema>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/forms/submit-registration-schema.ts
git commit -m "feat(schema): simplify registration form, add mandatory menu per registrant"
```

---

## Phase 3: Pricing Logic

### Task 6: Simplify computeSubmitTotal()

**Files:**

- Modify: `src/lib/pricing/compute-submit-total.ts`

**Task:**
Remove voucher logic, remove optional menu logic, keep only ticket + mandatory menu per registrant.

- [ ] **Step 1: Read current implementation**

```bash
cat src/lib/pricing/compute-submit-total.ts
```

- [ ] **Step 2: Replace implementation**

```typescript
import type { TicketPriceType } from '@prisma/client'

export type PricingLineRole = 'primary' | 'partner'

export type PricingLine =
  | { kind: 'ticket'; role: PricingLineRole; label: string; amount: number }
  | { kind: 'menu'; role: PricingLineRole; label: string; amount: number }

export type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number
    ticketNonMemberPrice: number
  }
  primaryPriceType: Extract<TicketPriceType, 'member' | 'non_member'>
  primaryMandatoryMenu: { name: string; price: number }

  partnerPriceType?: Extract<TicketPriceType, 'member' | 'non_member'>
  partnerMandatoryMenu?: { name: string; price: number }
}

export type SubmitPricingResult = {
  primaryTicketPrice: number
  primaryMenuPrice: number
  primaryTotal: number

  partnerTicketPrice?: number
  partnerMenuPrice?: number
  partnerTotal?: number

  grandTotal: number
  lines: PricingLine[]
}

function ticketPrice(input: SubmitPricingInput, role: 'primary' | 'partner'): number {
  const priceType = role === 'primary' ? input.primaryPriceType : input.partnerPriceType
  if (priceType === 'non_member') return input.event.ticketNonMemberPrice
  return input.event.ticketMemberPrice
}

function ticketLabel(priceType: TicketPriceType): string {
  return priceType === 'non_member' ? 'Tiket Non-member' : 'Tiket Member'
}

export function computeSubmitTotal(input: SubmitPricingInput): SubmitPricingResult {
  const lines: PricingLine[] = []

  // Primary
  const primaryTicket = ticketPrice(input, 'primary')
  const primaryMenu = input.primaryMandatoryMenu.price
  const primaryTotal = primaryTicket + primaryMenu

  lines.push({
    kind: 'ticket',
    role: 'primary',
    label: ticketLabel(input.primaryPriceType),
    amount: primaryTicket,
  })
  lines.push({
    kind: 'menu',
    role: 'primary',
    label: `Menu — ${input.primaryMandatoryMenu.name}`,
    amount: primaryMenu,
  })

  // Partner (optional)
  let partnerTicket: number | undefined
  let partnerMenu: number | undefined
  let partnerTotal: number | undefined

  if (input.partnerMandatoryMenu && input.partnerPriceType) {
    partnerTicket = ticketPrice(input, 'partner')
    partnerMenu = input.partnerMandatoryMenu.price
    partnerTotal = partnerTicket + partnerMenu

    lines.push({
      kind: 'ticket',
      role: 'partner',
      label: ticketLabel(input.partnerPriceType),
      amount: partnerTicket,
    })
    lines.push({
      kind: 'menu',
      role: 'partner',
      label: `Menu — ${input.partnerMandatoryMenu.name}`,
      amount: partnerMenu,
    })
  }

  const grandTotal = primaryTotal + (partnerTotal ?? 0)

  return {
    primaryTicketPrice: primaryTicket,
    primaryMenuPrice: primaryMenu,
    primaryTotal,
    partnerTicketPrice,
    partnerMenuPrice: partnerMenu,
    partnerTotal,
    grandTotal,
    lines,
  }
}
```

- [ ] **Step 3: Update existing tests**

```bash
cat src/lib/pricing/compute-submit-total.test.ts | head -50
```

If tests exist, update them to match new signature. Example test:

```typescript
import { computeSubmitTotal } from './compute-submit-total'

describe('computeSubmitTotal', () => {
  it('should calculate primary only', () => {
    const result = computeSubmitTotal({
      event: {
        ticketMemberPrice: 500000,
        ticketNonMemberPrice: 750000,
      },
      primaryPriceType: 'member',
      primaryMandatoryMenu: { name: 'Nasi Kuning', price: 150000 },
    })

    expect(result.primaryTicketPrice).toBe(500000)
    expect(result.primaryMenuPrice).toBe(150000)
    expect(result.primaryTotal).toBe(650000)
    expect(result.grandTotal).toBe(650000)
  })

  it('should calculate primary + partner', () => {
    const result = computeSubmitTotal({
      event: {
        ticketMemberPrice: 500000,
        ticketNonMemberPrice: 750000,
      },
      primaryPriceType: 'member',
      primaryMandatoryMenu: { name: 'Nasi Kuning', price: 150000 },
      partnerPriceType: 'member',
      partnerMandatoryMenu: { name: 'Lumpia', price: 100000 },
    })

    expect(result.primaryTotal).toBe(650000)
    expect(result.partnerTotal).toBe(600000)
    expect(result.grandTotal).toBe(1250000)
    expect(result.lines).toHaveLength(4) // 2 tickets + 2 menus
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm test src/lib/pricing/compute-submit-total.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/compute-submit-total.ts
git commit -m "refactor(pricing): simplify computeSubmitTotal, remove vouchers and optional menus"
```

---

## Phase 4: Server Actions

### Task 7: Update Event Creation/Edit Server Action

**Files:**

- Modify: `src/lib/actions/admin-events.ts`

**Task:**
Update to use new timing fields, mandatory menu, and new pricing model. Implement edit locking after closeRegistrationAt.

- [ ] **Step 1: Read current implementation**

```bash
head -150 src/lib/actions/admin-events.ts
```

- [ ] **Step 2: Update event creation/update function**

Find `createAdminEvent` or `upsertEvent` function and update:

```typescript
'use server'

import { guardOwnerOrAdmin } from '@/lib/actions/guard'
import { ok, rootError } from '@/lib/forms/action-result'
import type { AdminEventUpsertInput } from '@/lib/forms/admin-event-form-schema'
import { prisma } from '@/lib/db/prisma'
import type { Event } from '@prisma/client'

export async function upsertEvent(input: AdminEventUpsertInput, eventId?: string): Promise<ActionResult<Event>> {
  try {
    await guardOwnerOrAdmin()

    // NEW: Check edit locking
    if (eventId) {
      const existing = await prisma.event.findUnique({
        where: { id: eventId },
      })
      if (existing) {
        const now = new Date()
        if (now >= existing.closeRegistrationAt) {
          // Only closeRegistrationAt can be extended
          if (input.closeRegistrationAtIso === existing.closeRegistrationAt.toISOString()) {
            return rootError('Acara sudah ditutup. Hanya waktu tutup registrasi yg bisa diubah.')
          }
        }
      }
    }

    const openReg = new Date(input.openRegistrationAtIso)
    const closeReg = new Date(input.closeRegistrationAtIso)
    const openGate = new Date(input.openGateAtIso)
    const kickOff = new Date(input.kickOffAtIso)

    const event = await prisma.event.upsert({
      where: { id: eventId ?? 'new' },
      update: {
        title: input.title,
        summary: input.summary,
        description: input.descriptionHtml,
        venueId: input.venueId,
        openRegistrationAt: openReg,
        closeRegistrationAt: closeReg,
        openGateAt: openGate,
        kickOffAt: kickOff,
        mandatoryMenuItemIds: input.mandatoryMenuItemIds,
        ticketMemberPrice: input.ticketMemberPrice,
        ticketNonMemberPrice: input.ticketNonMemberPrice,
        pricingSource: input.pricingSource,
        picAdminProfileId: input.picAdminProfileId,
        bankAccountId: input.bankAccountId,
        status: input.status,
        registrationCapacity: input.registrationCapacity ?? null,
        registrationManualClosed: input.registrationManualClosed,
      },
      create: {
        slug: generateSlug(input.title),
        title: input.title,
        summary: input.summary,
        description: input.descriptionHtml,
        venueId: input.venueId,
        coverBlobUrl: '', // TODO: upload cover in separate action
        coverBlobPath: '',
        openRegistrationAt: openReg,
        closeRegistrationAt: closeReg,
        openGateAt: openGate,
        kickOffAt: kickOff,
        mandatoryMenuItemIds: input.mandatoryMenuItemIds,
        ticketMemberPrice: input.ticketMemberPrice,
        ticketNonMemberPrice: input.ticketNonMemberPrice,
        pricingSource: input.pricingSource,
        picAdminProfileId: input.picAdminProfileId,
        bankAccountId: input.bankAccountId,
        status: input.status,
        registrationCapacity: input.registrationCapacity ?? null,
        registrationManualClosed: input.registrationManualClosed,
      },
    })

    // Link eventVenueMenuItems for future add-ons
    await prisma.eventVenueMenuItem.deleteMany({
      where: { eventId: event.id },
    })
    for (const item of input.linkedVenueMenuItems) {
      await prisma.eventVenueMenuItem.create({
        data: {
          eventId: event.id,
          venueMenuItemId: item.venueMenuItemId,
          sortOrder: item.sortOrder,
        },
      })
    }

    return ok(event)
  } catch (e) {
    if (isAuthError(e)) throw e
    console.error('upsertEvent error:', e)
    return rootError('Gagal menyimpan acara.')
  }
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .slice(0, 50)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-events.ts
git commit -m "feat(server-action): update event upsert for timing and mandatory menu"
```

---

### Task 8: Update Registration Submission Server Action

**Files:**

- Modify: `src/lib/actions/submit-registration.ts`

**Task:**
Create separate Registration records for primary and partner with independent pricing snapshots. Share upload between them.

- [ ] **Step 1: Read current implementation**

```bash
head -200 src/lib/actions/submit-registration.ts
```

- [ ] **Step 2: Rewrite submitRegistration function**

```typescript
'use server'

import { ok, rootError } from '@/lib/forms/action-result'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { computeSubmitTotal } from '@/lib/pricing/compute-submit-total'
import { prisma } from '@/lib/db/prisma'
import { uploadImage } from '@/lib/uploads/upload-image'
import { put } from '@vercel/blob'

export async function submitRegistration(
  eventId: string,
  input: SubmitRegistrationInput,
  transferProofFile?: File,
): Promise<ActionResult<{ registrationId: string; partnerId?: string }>> {
  try {
    // 1. Load event + menu items
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        registrations: { where: { ticketRole: 'primary' } },
      },
    })

    if (!event) return rootError('Acara tidak ditemukan.')

    // 2. Check registration window
    const now = new Date()
    if (now < event.openRegistrationAt || now >= event.closeRegistrationAt) {
      return rootError('Registrasi tidak dibuka.')
    }

    // 3. Check capacity
    if (event.registrationCapacity && event.registrations.length >= event.registrationCapacity) {
      return rootError('Kuota registrasi penuh.')
    }

    // 4. Load menu items
    const primaryMenu = await prisma.venueMenuItem.findUnique({
      where: { id: input.primaryMandatoryMenuItemId },
    })
    if (!primaryMenu) return rootError('Menu primary tidak ditemukan.')

    let partnerMenu: any = null
    if (input.includePartner && input.partnerMandatoryMenuItemId) {
      partnerMenu = await prisma.venueMenuItem.findUnique({
        where: { id: input.partnerMandatoryMenuItemId },
      })
      if (!partnerMenu) return rootError('Menu partner tidak ditemukan.')
    }

    // 5. Compute pricing
    const pricing = computeSubmitTotal({
      event: {
        ticketMemberPrice: event.ticketMemberPrice,
        ticketNonMemberPrice: event.ticketNonMemberPrice,
      },
      primaryPriceType: 'member', // TODO: derive from member validation
      primaryMandatoryMenu: { name: primaryMenu.name, price: primaryMenu.price },
      partnerPriceType: input.includePartner ? 'member' : undefined,
      partnerMandatoryMenu: partnerMenu ? { name: partnerMenu.name, price: partnerMenu.price } : undefined,
    })

    // 6. Upload proof
    let uploadUrl: string | null = null
    let uploadPath: string | null = null

    if (transferProofFile) {
      try {
        const { url, path } = await uploadImage(transferProofFile, {
          maxWidth: 1600,
          quality: 80,
          folder: 'registrations',
        })
        uploadUrl = url
        uploadPath = path
      } catch (e) {
        console.error('Upload failed:', e)
        return rootError('Gagal mengunggah bukti transfer.')
      }
    }

    // 7. Create registrations in transaction
    const result = await prisma.$transaction(async tx => {
      // Primary registration
      const primary = await tx.registration.create({
        data: {
          eventId,
          contactName: input.contactName,
          contactWhatsapp: input.contactWhatsapp || '',
          claimedMemberNumber: input.claimedMemberNumber || null,
          ticketRole: 'primary',
          ticketPriceType: 'member', // TODO: derive
          mandatoryMenuItemId: input.primaryMandatoryMenuItemId,
          ticketPriceApplied: pricing.primaryTicketPrice,
          mandatoryMenuPriceApplied: pricing.primaryMenuPrice,
          computedTotalAtSubmit: pricing.primaryTotal,
          status: 'submitted',
          attendanceStatus: 'unknown',
        },
      })

      // Partner registration (if included)
      let partner: any = null
      if (input.includePartner && input.partnerMandatoryMenuItemId) {
        partner = await tx.registration.create({
          data: {
            eventId,
            primaryRegistrationId: primary.id,
            contactName: input.partnerName || '',
            contactWhatsapp: input.partnerWhatsapp || '',
            claimedMemberNumber: input.partnerMemberNumber || null,
            ticketRole: 'partner',
            ticketPriceType: 'member', // TODO: derive
            mandatoryMenuItemId: input.partnerMandatoryMenuItemId,
            ticketPriceApplied: pricing.partnerTicketPrice || 0,
            mandatoryMenuPriceApplied: pricing.partnerMenuPrice || 0,
            computedTotalAtSubmit: pricing.partnerTotal || 0,
            status: 'submitted',
            attendanceStatus: 'unknown',
          },
        })
      }

      // Create upload (linked to primary)
      if (uploadUrl && uploadPath) {
        await tx.upload.create({
          data: {
            registrationId: primary.id,
            purpose: 'transfer_proof',
            blobUrl: uploadUrl,
            blobPath: uploadPath,
          },
        })
      }

      return { primary, partner }
    })

    return ok({
      registrationId: result.primary.id,
      partnerId: result.partner?.id,
    })
  } catch (e) {
    console.error('submitRegistration error:', e)
    return rootError('Gagal menyimpan registrasi.')
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/submit-registration.ts
git commit -m "feat(server-action): separate primary and partner registrations with independent pricing"
```

---

## Phase 5: Admin UI - Event Form

### Task 9: Restructure Event Admin Form (Reorder Fields)

**Files:**

- Modify: `src/components/admin/forms/event-admin-form.tsx`

**Task:**
Move event cover to position 2 (after title), add timing fields, add mandatory menu selection, improve cover upload UI.

- [ ] **Step 1: Read current form structure**

```bash
head -100 src/components/admin/forms/event-admin-form.tsx
```

- [ ] **Step 2: Restructure form fields**

Update the form JSX to follow new order:

1. Title
2. **Cover** (NEW: moved from bottom, with improved UI)
3. Summary
4. Description
5. Venue
6. **Mandatory menu selection** (NEW)
7. **Registration timeline** (NEW: openReg, closeReg)
8. **Event timeline** (NEW: openGate, kickOff)
9. Pricing
10. Registration capacity
11. Manual close toggle
12. Status
13. PIC
14. Bank account
15. Helpers

```tsx
// Pseudo-code structure
export function EventAdminForm({ event }: Props) {
  const form = useForm<AdminEventUpsertInput>({...});

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>

        {/* 1. Title */}
        <FormField control={form.control} name="title" render={...} />

        {/* 2. Cover (NEW: moved here, improved UI) */}
        <FormField control={form.control} name="coverBlobUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Foto Cover Acara</FormLabel>
            <FormControl>
              <ImageUploadDropzone
                value={field.value}
                onChange={field.onChange}
                maxSize={5 * 1024 * 1024}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* 3. Summary */}
        <FormField control={form.control} name="summary" render={...} />

        {/* 4. Description */}
        <FormField control={form.control} name="descriptionHtml" render={...} />

        {/* 5. Venue */}
        <FormField control={form.control} name="venueId" render={...} />

        {/* 6. Mandatory menu (NEW) */}
        <FormField control={form.control} name="mandatoryMenuItemIds" render={({ field }) => (
          <FormItem>
            <FormLabel>Menu Wajib (Pilih 1+)</FormLabel>
            <FormControl>
              <MandatoryMenuSelection
                venueId={form.watch("venueId")}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* 7. Registration timeline (NEW) */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Jadwal Registrasi</h3>
          <FormField control={form.control} name="openRegistrationAtIso" render={...} />
          <FormField control={form.control} name="closeRegistrationAtIso" render={...} />
        </div>

        {/* 8. Event timeline (NEW) */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Jadwal Acara</h3>
          <FormField control={form.control} name="openGateAtIso" render={...} />
          <FormField control={form.control} name="kickOffAtIso" render={...} />
        </div>

        {/* 9. Pricing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Harga Tiket</h3>
          <FormField control={form.control} name="ticketMemberPrice" render={...} />
          <FormField control={form.control} name="ticketNonMemberPrice" render={...} />
        </div>

        {/* 10-15. Rest of fields... */}

        <Button type="submit">Simpan Acara</Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Create ImageUploadDropzone component** (if not exists)

Create `src/components/ui/image-upload-dropzone.tsx`:

```tsx
import { useState } from 'react'
import { Dropzone } from '@/components/ui/dropzone'
import { Image } from 'lucide-react'

type Props = {
  value?: string
  onChange: (file: File) => void
  maxSize?: number
}

export function ImageUploadDropzone({ onChange, maxSize = 5 * 1024 * 1024 }: Props) {
  const [preview, setPreview] = useState<string>()

  const handleDrop = (files: File[]) => {
    const file = files[0]
    if (!file) return

    if (file.size > maxSize) {
      alert('File terlalu besar.')
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
    onChange(file)
  }

  return (
    <div className='space-y-4'>
      {preview && (
        <div className='relative w-full h-64 rounded-lg overflow-hidden'>
          <img src={preview} alt='Preview' className='object-cover w-full h-full' />
        </div>
      )}
      <Dropzone onDrop={handleDrop}>
        <div className='flex flex-col items-center justify-center p-6 text-center'>
          <Image className='h-8 w-8 mb-2 text-muted-foreground' />
          <p>Drag & drop foto cover, atau klik untuk browse</p>
        </div>
      </Dropzone>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/forms/event-admin-form.tsx src/components/ui/image-upload-dropzone.tsx
git commit -m "feat(ui): restructure event form, move cover to position 2, add timing and menu fields"
```

---

## Phase 6: Admin UI - Registration Inbox & Detail

### Task 10: Update Registration List View

**Files:**

- Modify: `src/app/admin/events/[eventId]/inbox/page.tsx`

**Task:**
Display registrations with separate rows for primary and partner. Add `ticketRole` column.

- [ ] **Step 1: Read current list page**

```bash
cat src/app/admin/events/\[eventId\]/inbox/page.tsx | head -100
```

- [ ] **Step 2: Update table columns**

Add columns:

- Registrant Name
- Event
- **Ticket Role** (primary | partner) ← NEW
- Status
- Attendance

Update table to fetch registrations (not tickets):

```typescript
const registrations = await prisma.registration.findMany({
  where: { eventId },
  include: {
    event: true,
    primaryRegistration: true, // For partner rows
  },
  orderBy: { createdAt: 'desc' },
})
```

Render table rows per registration (not per pair):

```tsx
{
  registrations.map(reg => (
    <TableRow key={reg.id}>
      <TableCell>{reg.contactName}</TableCell>
      <TableCell>{reg.event.title}</TableCell>
      <TableCell>
        {reg.ticketRole === 'primary' ? 'Primary' : 'Partner'}
        {reg.primaryRegistrationId && (
          <span className='text-xs text-muted-foreground ml-2'>of {reg.primaryRegistration?.contactName}</span>
        )}
      </TableCell>
      <TableCell>{reg.status}</TableCell>
      <TableCell>{reg.attendanceStatus}</TableCell>
      <TableCell>
        <Link href={`/admin/events/${eventId}/inbox/${reg.id}`}>Detail</Link>
      </TableCell>
    </TableRow>
  ))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/events/\[eventId\]/inbox/page.tsx
git commit -m "feat(admin): update registration list to show per-registrant rows"
```

---

### Task 11: Update Registration Detail View

**Files:**

- Modify: `src/components/admin/registration-detail.tsx`

**Task:**
Show registrant info, link to partner (or primary if partner), independent status/attendance controls.

- [ ] **Step 1: Update component to fetch full registration data**

```typescript
export async function RegistrationDetail({ registrationId, eventId }: Props) {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      event: true,
      member: true,
      primaryRegistration: {
        include: { uploads: true },
      },
      partnerRegistrations: true,
      uploads: true,
      adjustments: true,
      mandatoryMenuItem: true,
    },
  });

  if (!registration) return <NotFound />;

  const uploads = registration.ticketRole === "partner"
    ? registration.primaryRegistration?.uploads
    : registration.uploads;

  return (
    <div className="space-y-6">
      {/* Registrant Info */}
      <Section>
        <h2>{registration.contactName}</h2>
        <p className="text-sm text-muted-foreground">
          Ticket Role: {registration.ticketRole}
        </p>
        {registration.ticketRole === "partner" && registration.primaryRegistration && (
          <p className="text-sm">
            Partner of{" "}
            <Link href={`/admin/events/${eventId}/inbox/${registration.primaryRegistrationId}`}>
              {registration.primaryRegistration.contactName}
            </Link>
          </p>
        )}
        {registration.ticketRole === "primary" && registration.partnerRegistrations.length > 0 && (
          <div className="text-sm">
            <p>Partners:</p>
            <ul>
              {registration.partnerRegistrations.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/events/${eventId}/inbox/${p.id}`}>
                    {p.contactName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Pricing */}
      <Section>
        <h3>Harga</h3>
        <p>Tiket: {formatIdr(registration.ticketPriceApplied)}</p>
        <p>Menu: {registration.mandatoryMenuItem?.name} ({formatIdr(registration.mandatoryMenuPriceApplied)})</p>
        <p className="font-semibold">Total: {formatIdr(registration.computedTotalAtSubmit)}</p>
      </Section>

      {/* Status (independent) */}
      <StatusPanel registration={registration} onUpdate={handleStatusUpdate} />

      {/* Attendance (independent) */}
      <AttendancePanel registration={registration} onUpdate={handleAttendanceUpdate} />

      {/* Uploads (inherited from primary if partner) */}
      {uploads && uploads.length > 0 && (
        <UploadsSection uploads={uploads} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create StatusPanel component**

```tsx
export function StatusPanel({ registration, onUpdate }: Props) {
  const isPending = useTransition()[1]

  return (
    <Section>
      <h3>Status Registrasi</h3>
      <div className='space-y-2'>
        <p>Current: {registration.status}</p>
        <div className='flex gap-2'>
          <Button onClick={() => onUpdate({ status: 'approved' })} disabled={isPending}>
            Approve
          </Button>
          <Button onClick={() => onUpdate({ status: 'rejected' })} disabled={isPending} variant='destructive'>
            Reject
          </Button>
          <Button onClick={() => onUpdate({ status: 'payment_issue' })} disabled={isPending} variant='secondary'>
            Payment Issue
          </Button>
        </div>
      </div>
    </Section>
  )
}
```

- [ ] **Step 3: Create AttendancePanel component**

```tsx
export function AttendancePanel({ registration, onUpdate }: Props) {
  const isPending = useTransition()[1]

  return (
    <Section>
      <h3>Kehadiran</h3>
      <div className='space-y-2'>
        <p>Current: {registration.attendanceStatus}</p>
        <div className='flex gap-2'>
          <Button onClick={() => onUpdate({ attendanceStatus: 'attended' })} disabled={isPending}>
            Attended
          </Button>
          <Button onClick={() => onUpdate({ attendanceStatus: 'no_show' })} disabled={isPending}>
            No-show
          </Button>
          <Button onClick={() => onUpdate({ attendanceStatus: 'unknown' })} disabled={isPending} variant='ghost'>
            Unknown
          </Button>
        </div>
      </div>
    </Section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/registration-detail.tsx
git commit -m "feat(admin): update registration detail with independent status and attendance per registrant"
```

---

## Phase 7: Public UI - Registration Form

### Task 12: Remove Menu Selection Section

**Files:**

- Modify: `src/components/public/registration-form/menu-selection-section.tsx`

**Task:**
Remove or replace with new component. Menu is no longer selected by user; only mandatory menu per registrant.

- [ ] **Step 1: Delete or deprecate old menu-selection-section.tsx**

```bash
# Option 1: Delete if not referenced elsewhere
rm src/components/public/registration-form/menu-selection-section.tsx

# Option 2: Keep but update to show mandatory menu info only (not editable)
```

- [ ] **Step 2: Create new mandatory-menu-selection.tsx**

Create `src/components/public/registration-form/mandatory-menu-selection.tsx`:

```tsx
import { Controller, type Control } from 'react-hook-form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { SerializedEventForRegistration } from '@/components/public/event-serialization'
import type { SubmitRegistrationInput } from '@/lib/forms/submit-registration-schema'
import { formatIdr } from '@/lib/utils/format-idr'

type Props = {
  control: Control<SubmitRegistrationInput>
  event: SerializedEventForRegistration
  label?: string
  fieldName: 'primaryMandatoryMenuItemId' | 'partnerMandatoryMenuItemId'
}

export function MandatoryMenuSelection({ control, event, label = 'Pilih 1 menu (wajib):', fieldName }: Props) {
  return (
    <section aria-label='Pilihan menu wajib' className='rounded-xl'>
      <Controller
        control={control}
        name={fieldName}
        render={({ field, fieldState }) => (
          <div>
            <label className='block text-sm font-medium mb-3'>{label}</label>
            <RadioGroup value={field.value ?? ''} onValueChange={field.onChange} className='grid gap-3'>
              {event.mandatoryMenuItems?.map(item => (
                <div key={item.id} className='flex items-center space-x-2'>
                  <RadioGroupItem value={item.id} id={`menu-${fieldName}-${item.id}`} />
                  <label
                    htmlFor={`menu-${fieldName}-${item.id}`}
                    className='flex flex-1 justify-between items-center cursor-pointer rounded-md border p-3 hover:bg-accent'
                  >
                    <span>{item.name}</span>
                    <span className='text-sm font-medium'>{formatIdr(item.price)}</span>
                  </label>
                </div>
              ))}
            </RadioGroup>
            {fieldState.invalid && <p className='text-sm text-destructive mt-1'>{fieldState.error?.message}</p>}
          </div>
        )}
      />
    </section>
  )
}
```

- [ ] **Step 3: Update RegistrationForm to use new component**

In `src/components/public/registration-form/registration-form.tsx`:

```tsx
import { MandatoryMenuSelection } from "./mandatory-menu-selection";

export function RegistrationForm({ event }: Props) {
  const form = useForm<SubmitRegistrationInput>({...});

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>

        {/* Primary section */}
        <Section>
          <h3>Pendaftar Utama</h3>
          <FormField name="contactName" ... />
          <FormField name="contactWhatsapp" ... />
          <FormField name="claimedMemberNumber" ... />

          {/* NEW: Mandatory menu selection */}
          <MandatoryMenuSelection
            control={form.control}
            event={event}
            fieldName="primaryMandatoryMenuItemId"
          />
        </Section>

        {/* Partner toggle */}
        <FormField name="includePartner" ... />

        {/* Partner section (conditional) */}
        {form.watch("includePartner") && (
          <Section>
            <h3>Pendaftar Partner</h3>
            <FormField name="partnerName" ... />
            <FormField name="partnerWhatsapp" ... />
            <FormField name="partnerMemberNumber" ... />

            {/* NEW: Partner mandatory menu selection */}
            <MandatoryMenuSelection
              control={form.control}
              event={event}
              fieldName="partnerMandatoryMenuItemId"
            />
          </Section>
        )}

        {/* Upload proof */}
        <FormField name="transferProof" ... />

        <Button type="submit">Daftar</Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/public/registration-form/
git commit -m "feat(form): add mandatory menu selection per registrant, remove optional menu selection"
```

---

## Phase 8: Reports & Helpers

### Task 13: Update Event Report Queries

**Files:**

- Modify: `src/lib/reports/queries.ts`

**Task:**
Count registrations per-registrant (not pairs), attendance per registrant, revenue per registrant.

- [ ] **Step 1: Update getEventReport function**

```typescript
export async function getEventReport(eventId: string) {
  const registrations = await prisma.registration.findMany({
    where: { eventId },
    include: {
      member: true,
      mandatoryMenuItem: true,
      adjustments: true,
    },
  })

  const primaryOnly = registrations.filter(r => r.ticketRole === 'primary')

  const stats = {
    totalRegistrants: registrations.length,
    totalPrimary: primaryOnly.length,
    totalPartner: registrations.length - primaryOnly.length,
    attended: registrations.filter(r => r.attendanceStatus === 'attended').length,
    noShow: registrations.filter(r => r.attendanceStatus === 'no_show').length,

    totalTicketRevenue: registrations.reduce((sum, r) => sum + r.ticketPriceApplied, 0),
    totalMenuRevenue: registrations.reduce((sum, r) => sum + r.mandatoryMenuPriceApplied, 0),
    grandTotal: registrations.reduce((sum, r) => sum + r.computedTotalAtSubmit, 0),
  }

  return { stats, registrations }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/queries.ts
git commit -m "feat(reports): count per-registrant instead of per-pair"
```

---

### Task 14: Update CSV Export

**Files:**

- Modify: `src/lib/reports/csv.ts`

**Task:**
Export per-registrant rows (not pairs) with new pricing fields.

- [ ] **Step 1: Update generateRegistrationsCsv function**

```typescript
export function generateRegistrationsCsv(registrations: Registration[]): string {
  const headers = [
    'Nama Pendaftar',
    'Role',
    'Status Member',
    'Harga Tiket',
    'Menu',
    'Harga Menu',
    'Total',
    'Status',
    'Kehadiran',
  ]

  const rows = registrations.map(reg => [
    reg.contactName,
    reg.ticketRole === 'primary' ? 'Primary' : 'Partner',
    reg.memberValidation,
    reg.ticketPriceApplied.toString(),
    reg.mandatoryMenuItem?.name || '',
    reg.mandatoryMenuPriceApplied.toString(),
    reg.computedTotalAtSubmit.toString(),
    reg.status,
    reg.attendanceStatus,
  ])

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/csv.ts
git commit -m "feat(reports): export per-registrant CSV with new pricing fields"
```

---

### Task 15: Create Event Timing Helpers

**Files:**

- Create: `src/lib/events/event-timing.ts`

**Task:**
Helper functions for checking registration window, edit locking, event phases.

- [ ] **Step 1: Create helpers**

```typescript
export function isRegistrationOpen(event: Event): boolean {
  const now = new Date()
  return now >= event.openRegistrationAt && now < event.closeRegistrationAt
}

export function canEditEvent(event: Event): boolean {
  const now = new Date()
  return now < event.closeRegistrationAt
}

export function getEventPhase(
  event: Event,
): 'before_open' | 'registration_open' | 'gates_open' | 'event_running' | 'finished' {
  const now = new Date()
  if (now < event.openRegistrationAt) return 'before_open'
  if (now >= event.openRegistrationAt && now < event.closeRegistrationAt) return 'registration_open'
  if (now >= event.openGateAt && now < event.kickOffAt) return 'gates_open'
  if (now >= event.kickOffAt && now < event.closeRegistrationAt) return 'event_running'
  return 'finished'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/events/event-timing.ts
git commit -m "feat(helpers): add event timing utility functions"
```

---

### Task 16: Create Partner Registration Helpers

**Files:**

- Create: `src/lib/registrations/partner-registration.ts`

**Task:**
Helper functions for querying primary/partner relationships.

- [ ] **Step 1: Create helpers**

```typescript
export async function getPrimaryRegistration(registrationId: string) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { primaryRegistration: true },
  })
  return reg?.primaryRegistration || reg
}

export async function getPartnerRegistrations(primaryId: string) {
  return prisma.registration.findMany({
    where: { primaryRegistrationId: primaryId },
  })
}

export async function getRegistrationPair(registrationId: string) {
  const reg = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      primaryRegistration: true,
      partnerRegistrations: true,
    },
  })

  if (!reg) return null

  const primary = reg.ticketRole === 'primary' ? reg : reg.primaryRegistration
  const partners = reg.ticketRole === 'primary' ? reg.partnerRegistrations : []

  return { primary, partners }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/registrations/partner-registration.ts
git commit -m "feat(helpers): add partner registration query utilities"
```

---

## Phase 9: Testing & Integration

### Task 17: Write Pricing Tests

**Files:**

- Create: `src/lib/pricing/compute-submit-total.test.ts`

**Task:**
Tests for new pricing logic (primary only, primary + partner, different menus).

- [ ] **Step 1: Write tests**

```typescript
import { computeSubmitTotal } from './compute-submit-total'

describe('computeSubmitTotal', () => {
  const baseEvent = {
    ticketMemberPrice: 500000,
    ticketNonMemberPrice: 750000,
  }

  it('should calculate primary only', () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: 'member',
      primaryMandatoryMenu: { name: 'Nasi', price: 150000 },
    })

    expect(result.primaryTicketPrice).toBe(500000)
    expect(result.primaryMenuPrice).toBe(150000)
    expect(result.primaryTotal).toBe(650000)
    expect(result.grandTotal).toBe(650000)
    expect(result.lines).toHaveLength(2)
  })

  it('should calculate primary + partner', () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: 'member',
      primaryMandatoryMenu: { name: 'Nasi', price: 150000 },
      partnerPriceType: 'member',
      partnerMandatoryMenu: { name: 'Lumpia', price: 100000 },
    })

    expect(result.primaryTotal).toBe(650000)
    expect(result.partnerTotal).toBe(600000)
    expect(result.grandTotal).toBe(1250000)
    expect(result.lines).toHaveLength(4)
  })

  it('should handle different partner price type', () => {
    const result = computeSubmitTotal({
      event: baseEvent,
      primaryPriceType: 'member',
      primaryMandatoryMenu: { name: 'Nasi', price: 150000 },
      partnerPriceType: 'non_member',
      partnerMandatoryMenu: { name: 'Lumpia', price: 100000 },
    })

    expect(result.primaryTicketPrice).toBe(500000)
    expect(result.partnerTicketPrice).toBe(750000)
    expect(result.grandTotal).toBe(1500000)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm test src/lib/pricing/compute-submit-total.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing/compute-submit-total.test.ts
git commit -m "test(pricing): add comprehensive pricing calculation tests"
```

---

### Task 18: Integration Test - Event Creation

**Files:**

- Create: `src/lib/actions/__tests__/admin-events.integration.test.ts`

**Task:**
Test event creation with new timing and mandatory menu fields.

- [ ] **Step 1: Write integration test**

```typescript
import { upsertEvent } from '../admin-events'
import { prisma } from '@/lib/db/prisma'

describe('upsertEvent (integration)', () => {
  it('should create event with timing and mandatory menu', async () => {
    const venueId = 'venue-1' // Use existing test venue
    const picId = 'pic-1'
    const bankId = 'bank-1'

    const result = await upsertEvent({
      title: 'Test Event',
      summary: 'Test',
      descriptionHtml: '<p>Test</p>',
      venueId,
      linkedVenueMenuItems: [],
      openRegistrationAtIso: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      closeRegistrationAtIso: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      openGateAtIso: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      kickOffAtIso: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      mandatoryMenuItemIds: ['menu-1'],
      ticketMemberPrice: 500000,
      ticketNonMemberPrice: 750000,
      pricingSource: 'overridden',
      picAdminProfileId: picId,
      bankAccountId: bankId,
      status: 'draft',
      helperAdminProfileIds: [],
    })

    expect(result.ok).toBe(true)
    expect(result.data?.mandatoryMenuItemIds).toEqual(['menu-1'])
    expect(result.data?.ticketMemberPrice).toBe(500000)
  })

  it('should reject invalid timing order', async () => {
    const result = await upsertEvent({
      // ... other fields ...
      openRegistrationAtIso: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      closeRegistrationAtIso: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      // closeRegistrationAt < openRegistrationAt → invalid
    })

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.closeRegistrationAtIso).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
pnpm test src/lib/actions/__tests__/admin-events.integration.test.ts
```

Expected: Tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/__tests__/admin-events.integration.test.ts
git commit -m "test(integration): event creation with timing and mandatory menu"
```

---

### Task 19: Integration Test - Registration Submission

**Files:**

- Create: `src/lib/actions/__tests__/submit-registration.integration.test.ts`

**Task:**
Test that submitRegistration creates separate primary + partner records.

- [ ] **Step 1: Write integration test**

```typescript
import { submitRegistration } from '../submit-registration'
import { prisma } from '@/lib/db/prisma'

describe('submitRegistration (integration)', () => {
  it('should create primary registration only', async () => {
    const result = await submitRegistration('event-1', {
      contactName: 'John Doe',
      contactWhatsapp: '628123456789',
      claimedMemberNumber: 'M001',
      primaryMandatoryMenuItemId: 'menu-1',
      includePartner: false,
    })

    expect(result.ok).toBe(true)
    const reg = await prisma.registration.findUnique({
      where: { id: result.data.registrationId },
    })
    expect(reg?.ticketRole).toBe('primary')
    expect(reg?.contactName).toBe('John Doe')
  })

  it('should create primary + partner registrations', async () => {
    const result = await submitRegistration('event-1', {
      contactName: 'John Doe',
      contactWhatsapp: '628123456789',
      claimedMemberNumber: 'M001',
      primaryMandatoryMenuItemId: 'menu-1',
      includePartner: true,
      partnerName: 'Jane Doe',
      partnerWhatsapp: '628987654321',
      partnerMemberNumber: 'M002',
      partnerMandatoryMenuItemId: 'menu-2',
    })

    expect(result.ok).toBe(true)
    const primary = await prisma.registration.findUnique({
      where: { id: result.data.registrationId },
      include: { partnerRegistrations: true },
    })
    expect(primary?.ticketRole).toBe('primary')
    expect(primary?.partnerRegistrations).toHaveLength(1)
    expect(primary?.partnerRegistrations[0]?.ticketRole).toBe('partner')
  })

  it('should share upload between primary and partner', async () => {
    const result = await submitRegistration(
      'event-1',
      {
        // ... primary + partner ...
      },
      mockFile,
    )

    const primary = await prisma.registration.findUnique({
      where: { id: result.data.registrationId },
      include: { uploads: true },
    })
    const partner = await prisma.registration.findUnique({
      where: { id: result.data.partnerId },
      include: { uploads: true, primaryRegistration: { include: { uploads: true } } },
    })

    expect(primary?.uploads).toHaveLength(1)
    expect(partner?.primaryRegistration?.uploads[0]?.id).toBe(primary?.uploads[0]?.id)
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/__tests__/submit-registration.integration.test.ts
git commit -m "test(integration): separate primary and partner registration creation"
```

---

## Phase 10: Final Verification & Cleanup

### Task 20: Verify All Tests Pass

**Files:**

- All test files

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass, no regressions.

- [ ] **Step 2: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "test: all tests passing, type check clean"
```

---

### Task 21: Test Manual Workflow (End-to-End)

**Files:**

- Development instance

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Create test event**

1. Go to admin `/admin/events/`
2. Click "New Event"
3. Fill form:
   - Title: "Test Event"
   - Cover: Upload image
   - Summary: "Test"
   - Description: "Test"
   - Venue: Select one
   - Mandatory menu: Select 1+ items
   - Timing: Fill all 4 fields (future dates)
   - Pricing: 500k member, 750k non-member
   - PIC & bank: Select
4. Save
5. Verify event created, all fields visible

- [ ] **Step 3: Test registration form**

1. Go to public event page `/events/[slug]`
2. Verify registration form shows:
   - Primary name/whatsapp/member
   - Mandatory menu selection (radio buttons)
   - Partner toggle
   - Partner fields (conditional)
   - Partner mandatory menu selection
   - Upload proof
3. Fill as primary + partner
4. Submit
5. Verify success & confirmation page

- [ ] **Step 4: Check admin inbox**

1. Go to `/admin/events/[eventId]/inbox`
2. Verify table shows 2 rows (primary + partner)
3. Click partner detail → verify link to primary
4. Test status/attendance controls per registrant

- [ ] **Step 5: Check report**

1. Go to `/admin/events/[eventId]/report`
2. Verify stats show per-registrant (not per-pair)
3. Download CSV → verify 2 rows, new pricing columns

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "test(e2e): manual end-to-end workflow verified"
```

---

## Summary of Implementation

**Total Tasks:** 21 organized in 10 phases

**Key Deliverables:**

1. ✅ Database schema updated (Event timing, Registration partner fields)
2. ✅ Form validation updated (timing, mandatory menu)
3. ✅ Pricing logic simplified (no vouchers, no optional menus)
4. ✅ Server actions refactored (separate primary/partner registrations)
5. ✅ Admin UI restructured (form field order, registration list/detail)
6. ✅ Public UI simplified (mandatory menu selection, no optional menu)
7. ✅ Reports updated (per-registrant, new CSV format)
8. ✅ Utilities & helpers created (timing, partner queries)
9. ✅ Tests written (pricing, integration, e2e)

**Estimated Duration:** ~40-50 tasks = 8-10 hours of focused implementation

---

## Execution Notes

- **Sequential order:** Phases 1-3 (schema, validation, pricing) must be done first
- **Independence:** Phases 4-7 can be worked in parallel once schema is stable
- **Testing:** Phase 9 validates all changes work together
- **Polish:** Phase 10 confirms user-facing flows work end-to-end

**Debugging checklist if tests fail:**

- Verify Prisma migration applied (`pnpm db:migrate:dev`)
- Check form schema validation errors (console.error in server actions)
- Verify menu item IDs exist in venue
- Confirm registration window is open (time checks)
