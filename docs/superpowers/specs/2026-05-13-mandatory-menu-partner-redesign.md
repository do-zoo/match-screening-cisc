# Mandatory Menu + Separate Partner Registration + Event Timing Redesign

**Date:** 2026-05-13  
**Scope:** Data model, event creation, registration flow, pricing, admin inbox, reports

---

## Overview

This spec redesigns the event registration system to:
1. Make one menu item mandatory per ticket (selected at event creation)
2. Treat primary and partner registrants as separate Registration records (independent attendance, shared proof)
3. Remove global ticket defaults (per-event pricing now required)
4. Replace vague `startAt`/`endAt` with explicit timeline: registration window + gate/kick-off
5. Improve event cover UI in admin (move to after title, enhance visuals)

**Rationale:** Scope expands to all CISC Tangsel events; separate partner registration enables per-person attendance tracking and clearer headcount reporting. Mandatory menu simplifies pricing and UX (users don't choose; menu is automatic). Explicit timeline accommodates real-world event flow (gates can open before/after registration closes).

---

## 1. Data Model

### Event

**Changes:**
- Replace `startAt`, `endAt` with 4-field timeline
- Add `mandatoryMenuItemIds` (JSON array of VenueMenuItem IDs)
- Make `ticketMemberPrice`, `ticketNonMemberPrice` required
- Remove `menuMode`, `menuSelection`, `voucherPrice`

**Schema:**
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
  
  // Timeline (replaces startAt/endAt)
  openRegistrationAt  DateTime
  closeRegistrationAt DateTime
  openGateAt          DateTime
  kickOffAt           DateTime
  
  registrationManualClosed Boolean @default(false)
  registrationCapacity     Int?
  status                   EventStatus @default(draft)
  
  // Pricing (required, no global defaults)
  ticketMemberPrice    Int
  ticketNonMemberPrice Int
  pricingSource        PricingSource @default(overridden)
  
  // Mandatory menu (admin selects 1+ options, user picks 1)
  mandatoryMenuItemIds String[] // JSON array of VenueMenuItem.id
  
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

**Validation (in schema or app layer):**
```
openRegistrationAt < closeRegistrationAt
openGateAt < kickOffAt
// closeRegistrationAt and openGateAt can be in any order
```

**Edit locking:**
```
After closeRegistrationAt passes:
  - All fields readonly
  - Except: closeRegistrationAt can be extended
```

### Registration (Breaking Change)

**Rationale:** Partner becomes a separate registrant (independent attendance, simplified data structure).

**Changes:**
- Add `primaryRegistrationId` (FK to primary Registration)
- Move `ticketRole` from Ticket model
- Add `mandatoryMenuItemId` per registrant
- Add `ticketPriceApplied`, `mandatoryMenuPriceApplied` (separate fields for margin tracking)
- Make `attendanceStatus` independent (not shared across pair)

**Schema:**
```prisma
model Registration {
  id      String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id], onDelete: Restrict)
  
  // Registrant identity (same fields for primary & partner)
  contactName     String
  contactWhatsapp String
  claimedMemberNumber String?
  memberValidation    MemberValidation @default(unknown)
  memberId            String?
  member              MasterMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)
  
  // Partner relationship
  primaryRegistrationId String?
  primaryRegistration   Registration? @relation("PartnerLink", fields: [primaryRegistrationId], references: [id], onDelete: Cascade)
  partnerRegistrations  Registration[] @relation("PartnerLink")
  
  // Ticket info
  ticketRole      TicketRole      // "primary" | "partner"
  ticketPriceType TicketPriceType
  mandatoryMenuItemId String
  mandatoryMenuItem   VenueMenuItem @relation(fields: [mandatoryMenuItemId], references: [id], onDelete: Restrict)
  
  // Pricing snapshot (per registrant)
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

**Deleted:** Ticket model can be deprecated (or kept as legacy if needed for backward compat).

### Upload (No Change)

**Note:** Partner registration queries uploads via `registration.primaryRegistration.uploads`. Uploads are always stored on primary registration.

```prisma
model Upload {
  id             String   @id @default(cuid())
  registrationId String
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  
  purpose UploadPurpose
  blobUrl  String
  blobPath String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([registrationId])
}
```

### Delete CommitteeTicketDefaults

**Rationale:** Every event now sets own prices; no global defaults.

---

## 2. Event Creation / Edit (Admin)

### Form Fields (in order)

1. **Event title** (text, required)
2. **Event cover** (drag-drop upload, required)
   - New: Visually prominent (preview, enhanced UI)
   - Moved from bottom to position 2 (after title)
3. **Event summary** (text, required)
4. **Event description** (rich text HTML, required)
5. **Venue** (dropdown, required, readonly after first registration)
6. **Mandatory menu items** (multi-checkbox, required)
   - Label: "Pilih menu item(s) yang boleh dipilih sebagai menu wajib (user pilih 1):"
   - Shows: item name, price
   - Min 1, max all
7. **Registration timeline** (required)
   - Open registration: datetime
   - Close registration: datetime
8. **Event timeline** (required)
   - Open gate: datetime
   - Kick off: datetime
9. **Pricing** (required, no defaults)
   - Ticket member price (IDR)
   - Ticket non-member price (IDR)
10. **Registration capacity** (optional, int)
11. **Registration manually closed** (toggle)
12. **Status** (dropdown: draft | active | finished)
13. **Financial PIC** (dropdown, required)
14. **Bank account** (dropdown, required, readonly after first registration)
15. **Helper admins** (multi-select, optional)

### Validation

```
openRegistrationAt < closeRegistrationAt
openGateAt < kickOffAt
// no constraint between closeRegistrationAt and openGateAt

mandatoryMenuItemIds.length > 0
ticketMemberPrice > 0
ticketNonMemberPrice > 0

If event has registrations:
  - Venue readonly
  - bankAccount readonly
  - menuMode/menuSelection/voucherPrice N/A (removed)
  - Can adjust timing fields

If closeRegistrationAt has passed:
  - All fields readonly
  - Except closeRegistrationAt (can extend)
```

### Schema

```typescript
// admin-event-form-schema.ts
export const adminEventUpsertSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  descriptionHtml: z.string(),
  venueId: z.string().min(1),
  linkedVenueMenuItems: z.array(...).min(1), // for future add-ons
  
  // New: explicit timing
  openRegistrationAtIso: z.string().min(1),
  closeRegistrationAtIso: z.string().min(1),
  openGateAtIso: z.string().min(1),
  kickOffAtIso: z.string().min(1),
  
  // New: mandatory menu selection
  mandatoryMenuItemIds: z.array(z.string().min(1)).min(1),
  
  // Updated: pricing required
  ticketMemberPrice: idrSchema,
  ticketNonMemberPrice: idrSchema,
  
  registrationCapacity: z.union([idrSchema, z.literal(null)]).optional(),
  registrationManualClosed: z.boolean(),
  status: z.nativeEnum(EventStatus),
  pricingSource: z.nativeEnum(PricingSource),
  picAdminProfileId: z.string().min(1),
  bankAccountId: z.string().min(1),
  helperAdminProfileIds: z.array(z.string().min(1)),
}).superRefine((v, ctx) => {
  // Validate timing order
  const openReg = Date.parse(v.openRegistrationAtIso);
  const closeReg = Date.parse(v.closeRegistrationAtIso);
  const openGate = Date.parse(v.openGateAtIso);
  const kickOff = Date.parse(v.kickOffAtIso);
  
  if (closeReg <= openReg) {
    ctx.addIssue({
      code: "custom",
      path: ["closeRegistrationAtIso"],
      message: "Registrasi harus ditutup setelah dibuka.",
    });
  }
  if (kickOff <= openGate) {
    ctx.addIssue({
      code: "custom",
      path: ["kickOffAtIso"],
      message: "Event harus dimulai setelah gates buka.",
    });
  }
  
  // Validate pricing
  if (v.ticketMemberPrice <= 0 || v.ticketNonMemberPrice <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["ticketMemberPrice"],
      message: "Harga tiket harus lebih dari 0.",
    });
  }
  
  // Validate mandatory menu
  if (v.mandatoryMenuItemIds.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["mandatoryMenuItemIds"],
      message: "Pilih minimal 1 menu wajib.",
    });
  }
});
```

---

## 3. Public Registration Form

### User Flow

1. **Primary registrant info**
   - Full name (text)
   - WhatsApp (phone, optional)
   - Member number (text, optional)
2. **Primary's mandatory menu** (radio buttons, required)
   - Label: "Pilih 1 menu (wajib):"
   - Each option shows: name + price
   - Only options in `event.mandatoryMenuItemIds` available
3. **Include partner?** (checkbox toggle)
4. **If partner:**
   - Partner full name (text)
   - Partner WhatsApp (phone, optional)
   - Partner member number (text, optional)
   - **Partner's mandatory menu** (radio buttons, required)
     - Same options as primary
     - Can select same or different menu
5. **Payment proof** (file upload, required, single file)
   - Covers both primary & partner
   - Converted to WebP, stored in Blob
6. **Submit button**

### Validation

**Availability:**
```
Form only shown if: now() >= event.openRegistrationAt AND now() < event.closeRegistrationAt
Otherwise: "Registrasi ditutup" / "Registrasi belum dibuka"
```

**Fields:**
```
contactName: required, min 1 char
contactWhatsapp: optional
claimedMemberNumber: optional
primaryMandatoryMenuId: required (one of event.mandatoryMenuItemIds)

If includePartner:
  partnerName: required
  partnerWhatsapp: optional
  partnerMemberNumber: optional
  partnerMandatoryMenuId: required

proof: required, image file (allowed: jpg, png, webp)
```

### On Submit (Server Action)

**Creates:**
```
1 Registration (primary)
  ticketRole: "primary"
  mandatoryMenuItemId: [selected]
  computedTotalAtSubmit: ticketPrice + menuPrice
  status: "submitted"
  attendanceStatus: "unknown"

[Optional] 1 Registration (partner)
  primaryRegistrationId: primary.id
  ticketRole: "partner"
  mandatoryMenuItemId: [selected]
  computedTotalAtSubmit: ticketPrice + menuPrice
  status: "submitted"
  attendanceStatus: "unknown"

1 Upload (linked to primary registration)
  purpose: "transfer_proof"
  blobUrl, blobPath
```

**Pricing calculation:**
```
Primary total = ticketMemberPrice + menuItem.price
Partner total = ticketMemberPrice + partnerMenuItem.price
Grand total = primary + partner (if present)
```

---

## 4. Pricing & Margin

### Pricing Fields

Each `Registration` snapshot stores:
```
ticketPriceApplied: Int        // ticket only
mandatoryMenuPriceApplied: Int  // menu only
computedTotalAtSubmit: Int      // ticket + menu
```

### computeSubmitTotal()

**Simplified signature:**
```typescript
type SubmitPricingInput = {
  event: {
    ticketMemberPrice: number
    ticketNonMemberPrice: number
    mandatoryMenuItems: { id, name, price }[]
  }
  primaryTicketType: "member" | "non_member"
  primaryMandatoryMenuId: string
  partnerTicketType?: "member" | "non_member"
  partnerMandatoryMenuId?: string
}

type SubmitPricingResult = {
  primaryTicketPrice: Int
  primaryMenuPrice: Int
  primaryTotal: Int
  
  partnerTicketPrice?: Int
  partnerMenuPrice?: Int
  partnerTotal?: Int
  
  grandTotal: Int
  lines: PricingLine[] // for UI display
}

function computeSubmitTotal(input: SubmitPricingInput): SubmitPricingResult
```

**Removed:** voucher logic, optional menu pricing.

### Margin Calculation

```
Primary margin = ticketPriceApplied - mandatoryMenuPriceApplied
Partner margin = ticketPriceApplied - mandatoryMenuPriceApplied
Total margin = sum of individual margins
```

Used in reports for financial tracking.

---

## 5. Admin Inbox & Registration Detail

### List View

**Columns:**
```
Registrant Name | Event | Ticket Role | Status | Attendance
John Doe        | Gala  | Primary     | Approved | Attended
Jane Doe        | Gala  | Partner     | Approved | No-show
```

**Behaviors:**
- Each registrant is one row (primary & partner separate)
- Can filter/sort by status, attendance
- Partner rows visually linked to primary (UI cue)

### Detail View

**For primary:**
- Registrant info (name, member number, validation)
- Ticket role: Primary
- Mandatory menu selected
- Pricing breakdown
- Upload(s)
- Status controls: approve/reject/payment issue
- Attendance controls: attended/no-show/unknown
- Linked partners: list of partner registrations with link

**For partner:**
- Same layout as primary
- Shows: "Partner of [Primary Name]" (link to primary)
- Upload(s) inherited from primary (show link to primary's upload)
- Independent status/attendance controls
- Can edit registrant info independently

### Actions

Each registrant (primary or partner) can be:
- Approved / Rejected / Payment Issue (independent)
- Marked attended / no-show / unknown (independent)
- Member validation toggled (valid / invalid / overridden)
- Invoiced for underpayment (independent)

---

## 6. Reporting

### Event Report Page

**Summary stats:**
```
Total registrants: 150 (includes partners as separate rows)
  - Primary: 100
  - Partner: 50
Attended: 145
No-show: 5

Revenue breakdown:
  Ticket revenue: Rp 500M (sum of all ticketPriceApplied)
  Menu revenue: Rp 100M (sum of all mandatoryMenuPriceApplied)
  Total: Rp 600M

Cost & Margin:
  Menu cost: Rp 50M
  Margin: Rp 550M (ticket + menu - cost)
```

### CSV Export

**Columns (per registrant row):**
```
Registrant Name | Role | Member Status | Ticket Price | Menu Item | Menu Price | Total | Status | Attendance
John Doe        | Primary | Valid | 500000 | Nasi Kuning | 150000 | 650000 | Approved | Attended
Jane Doe        | Partner | Unknown | 500000 | Lumpia | 100000 | 600000 | Approved | No-show
```

**Row count:** Total registrants (includes partners as separate rows)

---

## 7. Timeline & Registration Window

### Registration Availability

User can submit form if:
```
now() >= event.openRegistrationAt
AND
now() < event.closeRegistrationAt
```

Public display:
```
If now() < openRegistrationAt: "Registrasi dibuka [date/time]"
If openRegistrationAt ≤ now() < closeRegistrationAt: "Daftar sekarang" (form enabled)
If now() ≥ closeRegistrationAt: "Registrasi ditutup"
```

### Event Phases

```
Phase 1: Registration open
  Time: openRegistrationAt → closeRegistrationAt
  User: Can register

Phase 2: Gates open (may overlap Phase 1 or 3)
  Time: openGateAt → kickOffAt
  Admin: Check-in attendees

Phase 3: Event running (may overlap Phase 1)
  Time: kickOffAt → closeRegistrationAt (can overlap!)
  User: Might still register after event starts
  Admin: Manage attendance

Phase 4: Event finished
  Time: closeRegistrationAt onward
  User: Cannot register
  Admin: Final reporting
```

**Note:** Design allows closeRegistrationAt > kickOffAt (registration can stay open after event starts). This accommodates last-minute registrations.

---

## 8. Database Migration

### Order of Operations

```sql
-- 1. Add new columns
ALTER TABLE Event
ADD COLUMN openRegistrationAt TIMESTAMP NOT NULL DEFAULT now(),
ADD COLUMN closeRegistrationAt TIMESTAMP NOT NULL DEFAULT now() + interval '7 days',
ADD COLUMN openGateAt TIMESTAMP NOT NULL DEFAULT now(),
ADD COLUMN kickOffAt TIMESTAMP NOT NULL DEFAULT now() + interval '1 hour';

ALTER TABLE Event
ADD COLUMN mandatoryMenuItemIds JSONB DEFAULT '[]'::jsonb;

ALTER TABLE Registration
ADD COLUMN primaryRegistrationId UUID REFERENCES Registration(id) ON DELETE CASCADE,
ADD COLUMN ticketRole VARCHAR(10) NOT NULL DEFAULT 'primary',
ADD COLUMN mandatoryMenuItemId UUID NOT NULL REFERENCES VenueMenuItem(id),
ADD COLUMN ticketPriceApplied INT NOT NULL DEFAULT 0,
ADD COLUMN mandatoryMenuPriceApplied INT NOT NULL DEFAULT 0;

-- 2. Data migration (if keeping existing events)
-- Map Ticket.role → Registration.ticketRole
-- Map Ticket.ticketPriceType → Registration.ticketPriceType
-- (Can be skipped if deleting all dummy data)

-- 3. Remove old columns
ALTER TABLE Event
DROP COLUMN startAt,
DROP COLUMN endAt,
DROP COLUMN menuMode,
DROP COLUMN menuSelection,
DROP COLUMN voucherPrice;

-- 4. Enforce NOT NULL on pricing
ALTER TABLE Event
ALTER COLUMN ticketMemberPrice SET NOT NULL,
ALTER COLUMN ticketNonMemberPrice SET NOT NULL;

-- 5. Drop old models
DROP TABLE CommitteeTicketDefaults;

-- 6. Index for partner lookups
CREATE INDEX idx_registration_primary ON Registration(primaryRegistrationId);
CREATE INDEX idx_registration_attendance ON Registration(attendanceStatus);
```

---

## 9. Implementation Considerations

### Backward Compatibility

- **Ticket model:** Can be deprecated (or kept as legacy if needed)
- **Removed fields:** menuMode, menuSelection, voucherPrice, CommitteeTicketDefaults
- **Breaking:** Event timing completely replaced; migration is one-way

### Future: Optional Add-ons

This design defers optional menu add-ons. When implemented later:
- Keep `EventVenueMenuItem` & `TicketMenuSelection` tables (already in schema)
- Add new fields: `optionalMenuItemIds`, `optionalMenuSelection` to Event
- Extend Registration/Ticket to store optional menu choices
- Pricing will be: ticket + mandatory menu + optional menus (if chosen)

### Edge Cases

**Question:** What if `closeRegistrationAt` > `kickOffAt`?
- **Answer:** Allowed intentionally. Accommodates late registrations during/after event.

**Question:** Can primary & partner select the same mandatory menu?
- **Answer:** Yes, no constraint. User chooses independently.

**Question:** Can mandatory menu be removed from event after creation?
- **Answer:** Via edit form, if no registrations exist. After first registration, locked.

**Question:** What if no menu items exist for event?
- **Answer:** Admin must select ≥1 when creating event (validation prevents empty).

---

## 10. CISC.md Documentation Updates

After implementation, update CLAUDE.md:
- New "Event Timeline" section
- Update "Data Model" (Event, Registration, removed Ticket/CommitteeTicketDefaults)
- Update "Route layout" if registration timeline affects any routes
- Update "Role permission model" if margin/financial tracking changes access
- Update "Commands" if any Prisma migrations are needed

---

## Glossary

| Term | Definition |
|------|-----------|
| **Mandatory menu** | One menu item (selected by admin) that every registrant must choose; price is part of ticket |
| **Primary** | Main registrant in a registration pair |
| **Partner** | Secondary registrant linked to primary; separate Registration record |
| **Margin** | ticket price - menu price (financial tracking) |
| **Registration window** | Period between openRegistrationAt and closeRegistrationAt when form is open |
| **Timeline** | 4-field structure: openReg, closeReg, openGate, kickOff |

---

## Sign-off Checklist

- [x] Data model is clear and unambiguous
- [x] Event timing validation specified
- [x] Edit locking rules defined
- [x] Form fields in order; validation rules listed
- [x] Pricing calculation simplified (no vouchers, no optional menus yet)
- [x] Partner as separate Registration (not paired Ticket)
- [x] Admin inbox layout specified
- [x] Report structure defined (per-registrant rows)
- [x] CSV export columns match reporting logic
- [x] Migration order specified (safe, no data loss if resetting)
- [x] Future add-ons deferred but kept in schema
- [x] Edge cases addressed
