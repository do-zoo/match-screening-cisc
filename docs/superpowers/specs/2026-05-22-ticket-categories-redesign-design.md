# Ticket Categories Redesign

**Date:** 2026-05-22
**Status:** Approved
**Depends on:** nothing (foundation)
**Blocks:** menu-configuration, invoice-generation

## Overview

Replace the flat member/non-member pricing on `Event` with a multi-category ticket system. Each event can define N ticket categories, each with its own regular and member price, and an optional per-person quantity cap. The partner concept is eliminated — quantity handles multiple attendees per transaction, with each attendee filling their own holder data.

Old events (with existing registrations) are out of scope. This redesign applies only to events created after migration.

## Data Model

### New model: `EventTicketCategory`

```prisma
model EventTicketCategory {
  id               String   @id @default(cuid())
  eventId          String
  event            Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  name             String
  regularPrice     Int      // IDR, whole rupiah
  memberPrice      Int      // IDR, whole rupiah
  maxQtyPerPerson  Int?     // null = unlimited
  sortOrder        Int      @default(0)
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())

  registrations    Registration[]

  @@index([eventId])
}
```

### New model: `RegistrationHolder`

One row per ticket in a transaction. `sortOrder = 1` is the primary buyer; higher values are additional attendees.

```prisma
model RegistrationHolder {
  id                        String           @id @default(cuid())
  registrationId            String
  registration              Registration     @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  sortOrder                 Int              // 1 = primary buyer
  holderName                String
  claimedMemberNumber       String?
  memberValidation          MemberValidation @default(unknown)
  memberId                  String?
  member                    MasterMember?    @relation(fields: [memberId], references: [id], onDelete: SetNull)
  ticketPriceApplied        Int              // snapshot at submit time
  mandatoryMenuItemId       String?          // null when menuRequired = false on event
  mandatoryMenuPriceApplied Int?

  @@index([registrationId])
}
```

### `Event` — changes

Add:
```prisma
multiCategoryPurchase Boolean @default(false)  // allow buying across categories in one transaction
ticketCategories      EventTicketCategory[]
```

Remove:
```prisma
ticketMemberPrice     Int   // DELETED
ticketNonMemberPrice  Int   // DELETED
```

### `Registration` — changes

Add:
```prisma
ticketCategoryId      String
ticketCategory        EventTicketCategory @relation(fields: [ticketCategoryId], references: [id], onDelete: Restrict)
ticketQty             Int                 @default(1)
holders               RegistrationHolder[]
```

Remove:
```prisma
primaryRegistrationId         // DELETED — no partner concept
primaryRegistration           // DELETED
partnerRegistrations          // DELETED
ticketRole                    // DELETED
ticketPriceType               // DELETED
ticketPriceApplied            // DELETED — moved to RegistrationHolder
mandatoryMenuItemId           // DELETED — moved to RegistrationHolder
mandatoryMenuPriceApplied     // DELETED — moved to RegistrationHolder
primaryManagementMemberId     // DELETED
claimedManagementPublicCode   // DELETED
```

`computedTotalAtSubmit` stays on `Registration` (sum of all holder prices).

### Enums removed

- `TicketRole` (primary/partner) — deleted entirely
- `TicketPriceType` — deleted entirely; member/non-member distinction is now carried by `RegistrationHolder.memberValidation` (MemberValidation enum) + `ticketPriceApplied` snapshot

## Pricing Logic

`computeSubmitTotal` recalculated: iterate `holders`, sum `ticketPriceApplied` per holder. Each holder's price = `category.memberPrice` if `memberValidation = valid`, else `category.regularPrice`. Admin can override per holder during verification (same flow as current).

`computedTotalAtSubmit` on `Registration` = `SUM(holders.ticketPriceApplied)`.

## Admin Event Editor

### Tab structure (revised)

| Tab | Content |
|---|---|
| Dasar | Info dasar, cover, timeline, kapasitas |
| Harga & Tiket | Kategori tiket (CRUD) + settings pembelian |
| Venue & Menu | Pilih venue + konfigurasi menu (→ spec: menu-configuration) |

### Harga & Tiket tab

- **Category list** — table: Nama · Harga Reguler · Harga Member · Maks/Orang · Aksi (edit/delete)
- **Tambah Kategori** button — opens inline form or dialog: name, regularPrice (IDR input), memberPrice (IDR input), maxQtyPerPerson (optional number)
- Reorder via sortOrder (drag or up/down arrows)
- **Settings:** checkbox `multiCategoryPurchase` — "Izinkan beli lintas kategori dalam satu transaksi"
- Guard: cannot delete a category that has registrations; show count instead

### Edit category guard

After first registration exists for the event: `regularPrice` and `memberPrice` are locked (read-only in UI, backend rejects mutations). `name`, `maxQtyPerPerson`, `sortOrder`, `isActive` remain editable.

## Public Registration Form

Single-page form with expandable holder cards (design choice C).

### Flow

1. **Pilih kategori** — radio buttons showing each active `EventTicketCategory` with both prices. If `multiCategoryPurchase = false` (default), single selection only.
2. **Jumlah tiket** — number input, max = `category.maxQtyPerPerson ?? ∞`
3. **Holder cards** — one card per ticket, collapsed by default except card 1 (primary buyer). Each card:
   - Nama lengkap (required)
   - Nomor Member (optional) — triggers member price preview
   - Menu selection (if `menuRequired = true` → see menu-configuration spec)
4. **Kontak & Pembayaran** — WA number (primary buyer only), upload bukti transfer
5. **Ringkasan harga** — live preview: per holder (member/reguler badge + price) + grand total
6. **Submit** — single action, creates `Registration` + `RegistrationHolder[]` in a Prisma transaction

### Member pricing display

While filling form: show estimated price based on whether member number is entered (not validated yet). Final price determined by admin during verification. This matches current UX.

## Server Action

`submitRegistration` updated:
- Receives: `eventId`, `ticketCategoryId`, `ticketQty`, `holders[]` (holderName, claimedMemberNumber?, menuItemId?)
- Validates `ticketQty ≤ category.maxQtyPerPerson` (if set)
- Validates `holders.length === ticketQty`
- Creates `Registration` + `RegistrationHolder[]` in one transaction
- Uploads payment proof (unchanged)
- Returns `ActionResult<{ registrationId }>`

## Admin Registration Detail

### Ringkasan tab — updated

Show holder table: Tiket # · Nama · Status Member · Harga Applied · Menu Pilihan

### Verifikasi tab — updated

Per holder: validate member number, set `memberValidation`, update `ticketPriceApplied`. Admin can override price per holder.

## Migration

New migration: add `EventTicketCategory`, `RegistrationHolder`, add fields to `Event` and `Registration`, drop removed fields. Old registration data is not migrated (out of scope per product decision).

## Out of Scope

- Multi-category in one transaction UI (flag exists in data model, UI defaults to single-category; full multi-category UI is a future enhancement)
- Public quota display per category
- Waiting list
