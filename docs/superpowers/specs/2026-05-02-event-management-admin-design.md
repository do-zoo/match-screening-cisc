# Event management (admin) — design spec

Date: 2026-05-02  
Project: `match-screening` (Next.js)  
Parent context: [`2026-04-29-nobar-cisc-tangsel-design.md`](./2026-04-29-nobar-cisc-tangsel-design.md) §4–5.2; Prisma `Event`, `EventMenuItem`, `EventPicHelper`.

## 1) Goals

- Deliver **full admin CRUD for events** aligned with the nobar spec: event metadata, status, pricing (global default vs overridden), menu mode/selection, voucher price, **menu items**, **PIC master**, **PIC helpers**, **bank account** (must belong to PIC master), **cover image** (Blob).
- Replace the placeholder at `/admin/events` with a real **list + create + edit** flow.
- When an event already has **at least one registration** (any `RegistrationStatus`), apply **tier B** product rule: **some fields are hard-locked**, **some require explicit confirmation**, the rest remain editable with normal validation.

## 2) Non-goals (this spec)

- Changing how **registration snapshots** work (`computedTotalAtSubmit`, applied prices, ticket menu selections) — existing rows stay authoritative.
- Public participant UX beyond what already exists (listing, register form).
- New payment automation or WhatsApp API.

## 3) Authorization

- **Create / update / list (management screens):** `Owner` and `Admin` only — operational parity per nobar §4.1 (`hasOperationalOwnerParity`).
- **Verifier / Viewer:** no access to event CRUD routes; PIC helpers keep **per-event inbox** access only (unchanged).

## 4) Information architecture

| Route | Purpose |
|-------|---------|
| `/admin/events` | Table of events: status, date range, slug, PIC title; search/filter; **Create event**. |
| `/admin/events/new` | Creation form → redirect to `/admin/events/[id]/…` after success (e.g. inbox or edit). |
| `/admin/events/[eventId]/edit` | Edit form (distinct from inbox to avoid mixing operations and verification). |

Links to existing per-event areas (inbox, report) stay as they are; optional cross-links from list rows.

## 5) Form scope (fields)

Mirror Prisma + nobar §5.2:

- **Identity & copy:** `title`, `summary`, `description` (HTML; **sanitize on save** for public render path already documented).
- **Schedule & venue:** `startAt`, `endAt`, `venueName`, `venueAddress`.
- **Media:** `coverBlobUrl`, `coverBlobPath` via upload (WebP pipeline consistent with other admin uploads where applicable).
- **Registration controls:** `status` (`EventStatus`), `registrationCapacity`, `registrationManualClosed`.
- **Pricing:** `ticketMemberPrice`, `ticketNonMemberPrice`, `pricingSource` (`global_default` \| `overridden`), `voucherPrice` when `menuMode === VOUCHER`.
- **Menu config:** `menuMode` (`PRESELECT` \| `VOUCHER`), `menuSelection` (`SINGLE` \| `MULTI`).
- **Menu items:** `EventMenuItem` list — `name`, `price`, `sortOrder`, `voucherEligible`.
- **People & finance:** `picMasterMemberId` (member with `canBePIC` or existing validation rules), `bankAccountId` **must** be a `PicBankAccount` owned by that PIC master, `EventPicHelper` rows (optional many).

**New events:** seed ticket prices from **committee global defaults** when UI exists (Owner-only settings per nobar §5.5). If that store is not yet implemented, implementation plan may use a minimal read path or documented placeholder — not blocked by this spec.

**Slug:** server-generated from title for create; unique constraint; **immutable** once `registrationCount > 0`.

## 6) Tiered edit rules (`registrationCount > 0`)

Let `registrationCount = count(Registration where eventId = …)`.

### 6.1 Hard lock (server rejects; disable in UI)

| Field | Rationale |
|-------|-----------|
| `slug` | Public URLs and bookmarks; changing breaks links. |
| `menuMode` | Switches PRESELECT vs VOUCHER — incompatible participant semantics. |
| `menuSelection` | SINGLE vs MULTI changes selection rules for existing and new flows. |

### 6.2 Confirmation required (server + UI)

User must complete a dedicated acknowledgment (e.g. modal with checkbox and short warning). Server accepts only if an explicit `acknowledgeSensitiveChange` (or per-domain flags) is present **and** the operation is allowed.

| Field | Rationale |
|-------|-----------|
| `ticketMemberPrice`, `ticketNonMemberPrice`, `voucherPrice`, `pricingSource` | Operational risk; does not rewrite past snapshots but misleads operators if changed carelessly. |
| `picMasterMemberId`, `bankAccountId` | Payment context for **new** registrants; historical registrations keep their own financial snapshot but instructions for new users change. |

### 6.3 Free edit (normal validation)

`title`, `summary`, `description`, `startAt`, `endAt`, `venueName`, `venueAddress`, cover, `status`, `registrationCapacity`, `registrationManualClosed`, **PIC helpers** list.

**Decision (2026-05-02):** `startAt` / `endAt` remain in **free** tier unless product later chooses to elevate to confirmation; document as reversible without schema change.

### 6.4 Menu items

- **Create** new items: always allowed.
- **Update** existing item `name`, `price`, `sortOrder`, `voucherEligible`: allowed (historic registration totals unaffected).
- **Delete** item: allowed **only if** no `TicketMenuSelection` references it and no `Ticket` uses it as `voucherRedeemedMenuItemId` (Prisma `onDelete: Restrict` already enforces; server returns clear error).

## 7) Deletion policy

- **No hard delete of `Event`** when `registrationCount > 0`.
- Prefer **omit delete** for MVP **or** `draft`-only soft strategy; implementation plan picks one consistently with existing routes.

## 8) Implementation shape (recommended)

1. **Server Actions** guarded by operational admin check; **Prisma transactions** for `Event` + menu items sync + PIC helpers sync.
2. **Client form:** React Hook Form + Zod aligned with existing admin forms; sections for readability (metadata, venue, pricing, menu, PIC & bank, helpers, cover upload outside RHF if matching file patterns).
3. **Validation helpers:** pure functions unit-tested for tier classification (“locked field”, “needs acknowledgment”) independently of JSX.

## 9) Errors & UX

- Indonesian messages; distinguish: forbidden role, slug/menu lock, missing acknowledgment, menu item blocked by FK, invalid bank ownership, upload failure.
- List empty state links to **Create**.

## 10) Testing

- Unit: tier + acknowledgment contracts; slug immutability when count > 0; delete-menu guard.
- Targeted integration or action-level tests where the repo already patterns them for Server Actions.

## 11) Approaches considered

| # | Approach | Notes |
|---|------------|-------|
| 1 | Server-enforced tiers + mirror in UI (**chosen**) | Single source of truth; testable; optional modals only for tier 6.2. |
| 2 | Draft-diff “review screen” before apply | Transparent but heavier UX/state; defer. |
| 3 | Fork/version events for structural edits | Too heavy for current scope. |

## 12) Open items for implementation plan only

- Exact committee **global default** read API (if missing).
- Whether **after create** redirect lands on **edit** or **inbox** (preference: **edit** to finish menu/PIC).
