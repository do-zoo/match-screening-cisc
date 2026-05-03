# Venue management — menu & voucher (live link) — design spec

Date: 2026-05-04  
Project: `match-screening` (Next.js + Prisma)  
Related: [`2026-05-02-event-management-admin-design.md`](./2026-05-02-event-management-admin-design.md) (event form & tiered locks); current Prisma `Event`, `EventMenuItem`, `Ticket`, `TicketMenuSelection`.

## 1) Goals

- Introduce **first-class `Venue`** master data (replace free-text `Event.venueName` / `Event.venueAddress` with a foreign key for new modeling).
- Move **canonical menu rows** to the venue: **`VenueMenuItem`** holds `name`, `price` (IDR integer, smallest unit), `sortOrder`, `voucherEligible`.
- Keep **per-event menu configuration** as a **subset + ordering** of venue items via a join model (**`EventVenueMenuItem`**: `eventId`, `venueMenuItemId`, optional `sortOrder` override for display on that event only).
- Preserve **live reference** (no copy-on-write for name/price): consumers always resolve menu fields from `VenueMenuItem` through the join.
- Wire **voucher redemption** to the same canonical rows: selections and redemption reference **`VenueMenuItem`** (with server-side checks that the item is in the event’s subset).
- Apply **strict freeze** once an event has **any** `Registration` row: no mutable financial/menu topology that could contradict existing or future snapshots without versioning (see §6).

## 2) Non-goals (this spec)

- **Venue menu versioning** (`VenueMenuVersion` / pinned snapshots) — out of scope; strict freeze substitutes for legal/finance stability.
- **`voucherPrice` default at venue level** — keep **`Event.voucherPrice`** only (existing shape); revisit only if product asks for venue-level defaults later.
- **Public UI redesign** beyond using resolved menu data from the new sources.
- **Automated WhatsApp / payment** changes.

## 3) Data model (Prisma-oriented)

### 3.1 `Venue`

- `id`, `name` (display), `address` (text), optional future fields (`notes`, `isActive`).
- Relation: `menuItems VenueMenuItem[]`, `events Event[]`.

### 3.2 `VenueMenuItem`

- `venueId` → `Venue`, `name`, `price`, `sortOrder`, `voucherEligible`, timestamps.
- Unique constraint recommendation: none on `name` per venue unless product demands it (avoid blocking legitimate duplicates).

### 3.3 `Event` changes

- Add **`venueId`** (FK → `Venue`, `onDelete: Restrict`).
- **Migration:** populate `Venue` + `VenueMenuItem` from existing `Event.venueName` / `venueAddress` / `EventMenuItem` rows per rollout strategy (§8).
- Remove or deprecate **`venueName`** / **`venueAddress`** after backfill — implementation plan chooses single cutover vs temporary nullable FK + legacy strings.

### 3.4 `EventVenueMenuItem` (join)

- Composite primary key `(eventId, venueMenuItemId)` or surrogate `id` with **`@@unique([eventId, venueMenuItemId])`**.
- `eventId` → `Event` (`Cascade` delete when event deleted).
- `venueMenuItemId` → `VenueMenuItem` (`Restrict`: cannot delete venue item if still referenced by any join row).
- `sortOrder Int?` — optional **event-only** ordering; fallback to `VenueMenuItem.sortOrder` when null.

**Invariant:** `Event.venueId` must equal `VenueMenuItem.venueId` for every joined `venueMenuItemId`. Enforced in mutations (server).

### 3.5 Replace `EventMenuItem` usage

- **Remove `EventMenuItem`** (and migrate data) once join + ticket paths are rewired — **preferred end state:** single canonical menu entity at venue.
- **`TicketMenuSelection`:** point to **`VenueMenuItem`** (via `menuItemId` renamed or new column) instead of `EventMenuItem`; FK `Restrict` aligned with venue item lifecycle rules.
- **`Ticket.voucherRedeemedMenuItemId`:** reference **`VenueMenuItem`**; validate redemption target is **`voucherEligible`** and appears in **`EventVenueMenuItem`** for `ticket.eventId`.

### 3.6 Registration snapshots

- **No change to principle:** `computedTotalAtSubmit`, applied ticket prices, and stored selections remain authoritative at submit time.
- New submissions persist **`VenueMenuItem` ids** in `TicketMenuSelection` / redemption fields; historical rows migrated to equivalent ids during schema migration.

## 4) Authorization

- Align with committee admin conventions: **`guardOwner`** / **`guardOwnerOrAdmin`** (or existing event guard) for venue CRUD and for linking venue menu rows to events — exact guard matches implementation plan (`guard.ts` parity with event/settings modules).

## 5) Admin information architecture

| Area | Purpose |
|------|---------|
| **Venues** (new) | CRUD venues; CRUD **`VenueMenuItem`** ordered list per venue. |
| **Event edit** (existing) | Select **`venueId`**; configure **`EventVenueMenuItem`** subset (pick rows + reorder). Menu mode (`PRESELECT` / `VOUCHER`), `menuSelection`, **`voucherPrice`** unchanged semantically. |

Deep-link patterns and nav placement follow existing admin IA patterns (committee settings vs event-scoped routes — implementation plan).

## 6) Strict freeze rules

Let **`registrationCount`** = `count(Registration where eventId = …)` (any status).

When **`registrationCount > 0`** for an event:

1. **`Event.venueId`** — **hard lock** (same class as immutable slug / menu mode in event spec).
2. **`EventVenueMenuItem`** — **no insert, update, delete** for that `eventId` (subset and order frozen).
3. **`VenueMenuItem`** rows that appear in **`EventVenueMenuItem`** for **any** event with **`registrationCount > 0`**: **no update** to `name`, `price`, or `voucherEligible`, and **no delete** (`Restrict` + application guard).

When **`registrationCount === 0`**, organizer may freely adjust join rows and (subject only to §6.4) mutate venue menu items that are **not** covered by freeze in (3).

### 6.1 Venue-level deletes

- **`Venue` delete:** disallow if referenced by any **`Event`** (or soft-delete venue only — product default: **Restrict**).

### 6.2 Overlap with existing event-edit tiers

- Tier B / confirmation rules in [`2026-05-02-event-management-admin-design.md`](./2026-05-02-event-management-admin-design.md) **still apply** for pricing fields independent of venue.
- **`menuMode`** / **`menuSelection`** locks remain **unchanged** relative to existing spec once registrations exist — this venue spec **extends** freezes to venue linkage and canonical menu rows as above.

## 7) Server validation & errors

- **Invariant breach** (subset item from wrong venue → event): reject with **`ActionResult` root error** — Indonesian messaging consistent with codebase.
- **Submit registration / compute total:** only allow **`TicketMenuSelection`** entries contained in **`EventVenueMenuItem`** for `event.id`; **`voucherRedeemedMenuItemId`** must be eligible and in subset for `VOUCHER` mode.
- **Administrative mutations** on frozen graphs: deterministic error (do not silently no-op).

## 8) Migration strategy

1. Create **`Venue`**, **`VenueMenuItem`**, **`EventVenueMenuItem`**; add nullable **`Event.venueId`**.
2. Backfill: for each `Event`, create or dedupe **`Venue`** from `venueName` + `venueAddress`; move **`EventMenuItem`** rows to **`VenueMenuItem`** attached to that venue; recreate subset as **`EventVenueMenuItem`** one-to-one.
3. Rewrite **`TicketMenuSelection`** FKs / redemption FKs from old `EventMenuItem.id` → new **`VenueMenuItem.id`** using mapping created in step 2.
4. Drop **`EventMenuItem`**; set **`venueId`** non-null policy per environment; drop **`venueName`** / **`venueAddress`** columns when safe.

Deduping policy for identical venue strings (merge vs duplicate venues) is an **implementation plan** decision with ops input.

## 9) Testing

- **Unit:** join invariant (venue mismatch), freeze predicates, pricing helper inputs with **`VenueMenuItem`** ids.
- **Integration (server actions):** create event subset; assert blocked mutations after seeded `Registration`.

## 10) Risks / trade-offs

- **Operational coupling:** typo fixes require either pre-registration correction or heavier future versioning — accepted by **strict freeze** decision (2026-05-04).
- **Venue-wide impact:** editing a `VenueMenuItem` freezes for **every** downstream event that has registrations and includes that row — ops must coordinate.
