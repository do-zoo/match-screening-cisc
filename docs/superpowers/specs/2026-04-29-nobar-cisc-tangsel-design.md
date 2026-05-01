# Nobar CISC Tangsel — Registration + Admin Panel (Design Spec)

Date: 2026-04-29  
Project: `match-screening` (Next.js)  
Context: Registration system for CISC Tangerang Selatan watch parties + admin panel (operations & reporting) + no-cost WhatsApp notifications (click-to-chat).

## 1) Goals & Non-Goals

### Goals
- Participants can register for **one event** and upload **transfer payment proof**.
- The system supports **members and non-members**.
- The payable total is computed automatically from:
  - **ticket fee** (member/non-member)
  - **menu** (mandatory) or a **menu voucher** (fixed price; menu selected later).
- Admin panel supports:
  - event management
  - registration verification inbox (approve/reject/payment issue)
  - per-event reports (recap & export)
  - master data management (members, PIC/bank accounts, admins)
- A comprehensive status workflow (including attendance, cancel/refund).
- WhatsApp notifications (phase 1): **`wa.me` click-to-chat** + text templates (no paid API).

### Non-Goals (phase 1)
- Official WhatsApp API/provider integration (Cloud API, Qontak, etc).
- Automated payments (VA/QRIS) and bank reconciliation.
- Automatic membership validation against external systems (master members are managed by admins).

## 2) Primary Entities (Conceptual Data Model)

> Note: this is a conceptual model for design. The physical schema/ORM details are defined in the implementation plan.

### 2.1 Event
- **Identity**: `id`, event `slug`/code, `title`, `startAt`, `venueName`, `venueAddress`
- **Lifecycle**: `status = draft | active | finished`
- **Pricing**:
  - `ticketMemberPrice`
  - `ticketNonMemberPrice`
  - `pricingSource = global_default | overridden` (for auditability)
- **Menu configuration**:
  - `menuMode = PRESELECT | VOUCHER`
  - `menuSelection = SINGLE | MULTI`
  - If `VOUCHER`:
    - `voucherPrice` (fixed voucher price per ticket)
    - Menu items have `voucherEligible = true/false`
- **PIC assignment**:
  - `picMasterMemberId` (required)
  - `picHelperMemberIds[]` (optional, can be >1)
  - `bankAccountId` (required; 1 bank account per event; belongs to PIC Master)

### 2.2 Master Member
- **Member identity**: `memberNumber` (unique membership ID), `fullName`
- **Status**: `isActive`
- **Privileges**:
  - `isPengurus` (committee/board)
  - `canBePIC` (subset of `isPengurus`; eligible to be PIC Master)

### 2.3 PIC Bank Account
Bank accounts selectable when creating an event (owned by PIC Master).
- `id`, `ownerMemberId` (PIC master)
- `bankName`, `accountNumber`, `accountName`
- `isActive`

### 2.4 Registration (Order)
Each registration belongs to **one event** and can contain 1–2 people (tickets).
- **Identity**: `id`, `eventId`, `createdAt`
- **Primary contact**:
  - `contactName`
  - `contactWhatsapp`
- **Member claim**:
  - `claimedMemberNumber` (optional)
  - `memberCardPhoto` (required *only* if claiming member/committee; not required for non-members)
  - `memberValidation = unknown | valid | invalid | overridden`
  - `memberId` (optional) once validated/mapped
- **Uploads**:
  - `transferProof` (required)
- **Snapshot pricing (locked at submission)**:
  - `ticketMemberPriceApplied`
  - `ticketNonMemberPriceApplied`
  - `voucherPriceApplied` (voucher mode only)
  - `computedTotalAtSubmit`
  - Rationale: event prices may change, but existing registrations must remain consistent to avoid disputes.
- **Operational status (S3)**:
  - `status = submitted | pending_review | payment_issue | approved | rejected | cancelled | refunded`
  - `attendanceStatus = unknown | attended | no_show` (set after the event day)
- **Reason fields**:
  - `rejectionReason` (optional)
  - `paymentIssueReason` (optional)

### 2.5 Ticket (Person under a Registration)
A registration has 1–2 tickets.
- `id`, `registrationId`, `role = primary | partner`
- `fullName`
- `whatsapp` (optional for partner; if empty, notifications go to the primary contact only)
- `memberNumber` (optional; partner may fill it too)
- `ticketPriceType = member | non_member | privilege_partner_member_price`

### 2.6 Menu / Voucher Redemption
Each ticket has a menu entitlement:
- If `PRESELECT`:
  - `selectedMenuItemIds[]` (1 atau banyak tergantung `menuSelection`)
- If `VOUCHER`:
  - `voucherRedeemedMenuItemId` (selected later; must be `voucherEligible`)
  - `voucherRedeemedAt` (optional)

### 2.7 Invoice Adjustment (Underpayment / Total Adjustments)
Used when admins override member/non-member status or correct pricing/quantity resulting in a delta.
- `id`, `registrationId`
- `type = underpayment | other_adjustment`
- `amount`
- `status = unpaid | paid`
- `paymentProof` (optional; can be uploaded by the participant or attached by an admin)
- `paidAt` (optional)

## 3) Business Rules (Must-Haves)

### 3.1 Member vs Non-member
- If a participant fills `claimedMemberNumber`, the system treats it as a **member claim** (pending validation).
- Admin validates against **Master Member**.
- If **invalid**, admin may:
  - override to non-member and create an **underpayment invoice adjustment**
  - or override to member (manual decision) when operationally needed.

### 3.2 One Ticket per Member per Event
- Each `memberNumber` may have **at most one ticket per event**.
  - Applies to both primary and partner if partner also provides a `memberNumber`.
  - Goal: prevent double booking / multiple tickets under one member.

### 3.3 Committee Privilege: Optional Partner Ticket
- If the primary ticket is **committee/board** (`isPengurus`), the system provides `qtyPartner = 0 | 1` (default 0).
- If `qtyPartner = 1`:
  - `partnerName` is required
  - `partnerWhatsapp` is optional
  - partner gets **member price** via `ticketPriceType = privilege_partner_member_price`
  - partner `memberNumber` is optional; if provided, it still counts towards the one-ticket-per-member rule.

### 3.4 Mandatory Menu and Voucher Mode
- Each ticket must include a menu entitlement:
  - `PRESELECT`: menu selected during registration (single/multi based on event config)
  - `VOUCHER`: participant pays a fixed-price voucher during registration, then selects the menu **later** (on event day / attendance confirmation)
- In `VOUCHER` mode, redemption can only select menu items marked `voucherEligible`.
- No top-up/delta is supported in voucher mode (all voucher-eligible items are treated as equivalent for that voucher).

### 3.5 Pricing Formula (Locked)
For each registration, the total is computed and **locked** at submission:
- Ticket cost:
  - primary: member/non-member (based on claim and verification/override result)
  - partner (if any): `privilege_partner_member_price` (member price)
- Menu/voucher cost: per ticket (1 or 2 tickets)
- `computedTotalAtSubmit` menjadi baseline.
- If admin overrides change the total, use **Invoice Adjustment** for the delta (do not silently rewrite historical totals).

### 3.6 Event Payment Account
- Each event must select **exactly one** bank account for payments.
- The bank account must belong to the event's **PIC Master**.

## 4) Admin & Permissions

### 4.1 Admin authentication methods
- Admin login supports:
  - Email + password
  - Magic link (email)

### 4.2 Roles (Global)
- `Owner`: manage admins, master members, global defaults (pricing), PIC & bank accounts, WA templates, and all data.
- `Admin`: same verification scope as `Verifier` for all events (inbox/actions/exports tied to verifier abilities); excluded from Owner-only committee settings unless extended in product docs.
- `Verifier`: event operations (inbox), registration verification, underpayment adjustments, attendance, cancel/refund.
- `Viewer`: view dashboard/reports/exports without verification actions.

### 4.3 PIC Assignments (Per Event) + Hybrid Permission
Each event has:
- **PIC Master** (required, exactly 1): finance owner for bank account selection and payment accountability.
- **PIC Helper** (optional, can be >1): operations backup when PIC Master is unavailable.

Access rules (hybrid):
- Global roles still apply.
- However, if an admin is assigned as **PIC Helper** for event X, they gain **Verifier capabilities** *only for event X*, even if their global role is `Viewer`.
- PIC assignment does not affect other events.

## 5) Admin Panel: Information Architecture (Menus)

### 5.1 Dashboard
- Per-event summary:
  - total registrations
  - counts per status: pending_review, payment_issue, approved, rejected, cancelled, refunded
  - attendance: attended/no_show
  - total revenue (baseline) + total adjustments (paid underpayments)

### 5.2 Events (CRUD)
- Create/edit event:
  - event info (title, time, venue, status)
  - pricing (global default → may override per event)
  - menu settings: PRESELECT/VOUCHER + SINGLE/MULTI + voucherPrice + voucherEligible flags
  - choose PIC Master, PIC Helpers
  - choose 1 bank account (owned by PIC Master)

### 5.3 Registration Inbox (Per Event)
List + filters + details drawer/page:
- Registration data: contact, claimed member, transfer proof, total snapshot
- Tickets: primary + partner (if any) + attendance status
- Menu/voucher: selected menus or voucher redemption
- Actions:
  - set status: approve / reject (with reason) / payment_issue (with reason)
  - override member validation (valid/invalid/overridden) and `ticketPriceType` if needed
  - create underpayment invoice adjustment (auto from total delta), set unpaid/paid, upload payment proof (admin)
  - set attendance: attended / no_show
  - cancel / refund
- WhatsApp helpers:
  - `wa.me` buttons for message templates (receipt, approve, payment issue, underpayment invoice, etc)

### 5.4 Master Members
- CRUD members (`memberNumber`, `fullName`, `isActive`)
- Privilege flags: `isPengurus`, `canBePIC`

### 5.5 Committee Settings (Owner-only)
- Admin management:
  - create admins
  - assign global roles
- PIC bank accounts:
  - create/edit bank accounts per PIC Master
  - activate/deactivate
- Global defaults:
  - default `ticketMemberPrice` & `ticketNonMemberPrice` for new events
- WhatsApp templates (text)

### 5.6 Reports
Per event + date range filter:
- Participant recap:
  - member vs non-member
  - committee+partner usage
- Finance recap:
  - baseline totals (`computedTotalAtSubmit`)
  - adjustments (paid/unpaid)
  - refunds
- Menu/voucher recap:
  - count per menu item
  - voucher redeemed vs not redeemed
- Attendance:
  - attended/no_show
- CSV export

## 6) Participant UX (Front Office)

### 6.1 Browse & Select Event
- Landing page / list of active events
- Select event → go to registration page

### 6.2 Registration Form (per event)
Fields:
- Full name (contact)
- WhatsApp number (contact)
- Member number (optional)
- Upload transfer proof (required)
- Upload member card photo (required if claiming member/committee; not required for non-members)
- Partner option:
  - `qtyPartner = 0/1`
  - if 1: partner name required, WhatsApp optional, `memberNumber` optional
- Menu/voucher:
  - PRESELECT: select menu (single/multi)
  - VOUCHER: do not select menu during registration; only record voucher entitlement per ticket
- Total payable:
  - computed automatically and displayed as a breakdown

Submission result:
- initial status: `submitted` then `pending_review`
- show payment instructions based on the event bank account (from PIC Master)

## 7) Notifications (WhatsApp, No-budget Mode)

### 7.1 Mechanism
- The system does not send WhatsApp messages automatically.
- The system provides `wa.me/<number>?text=<encoded_template>` buttons in the admin panel and (optionally) on the post-submit page.

### 7.2 Minimum Templates
- Receipt (after submit)
- Request clarification (payment issue)
- Underpayment invoice (request for additional payment)
- Approved (confirmation + event details + voucher/menu rules)
- Cancelled / Refunded (if used)
- Attendance reminder (optional)

## 8) Status Machine (S3) — Operational Semantics

### 8.1 Registration status
- `submitted`: form submitted successfully (internal)
- `pending_review`: waiting for admin verification
- `payment_issue`: missing/incorrect proof or underpayment, awaiting participant/admin action
- `approved`: eligible to attend the event
- `rejected`: rejected (reason required)
- `cancelled`: cancelled (by admin or policy)
- `refunded`: funds returned (if any)

### 8.2 Attendance status
- `unknown`: default
- `attended`: hadir
- `no_show`: tidak hadir

Rules:
- Attendance is only meaningful when status is `approved` (it may still be logged for audit, but UI should typically restrict it).

## 9) Edge Cases & Validation

- Partner WhatsApp empty → all WA templates default to `contactWhatsapp`.
- If `claimedMemberNumber` is invalid:
  - admin may override
  - if totals change, create an underpayment invoice adjustment and request additional payment proof
- Voucher redemption:
  - can only choose `voucherEligible` menu items
  - log redemption timestamp
- Duplicate member per event:
  - the system prevents saving a second ticket with the same `memberNumber` within the same event (must show a clear admin UI error).

## 10) Success Criteria (MVP Acceptance)
- Admin can create events, set default/override prices, configure voucher/preselect mode, set PIC Master+Helpers, and pick 1 bank account.
- Participants can register, upload transfer proof, total is computed automatically, and the snapshot is stored.
- Admin can verify registrations, change statuses, record attendance, and handle cancel/refund.
- Admin can override invalid member claims → generate an underpayment invoice adjustment → attach proof of additional payment.
- Per-event reports can be exported.
- WhatsApp click-to-chat works from the admin panel with templates matching the current status.
