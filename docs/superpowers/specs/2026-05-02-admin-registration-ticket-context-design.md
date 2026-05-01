---
title: Admin registration detail — ticket & seat context (informational)
date: 2026-05-02
project: match-screening
status: approved-in-chat
---

## 1) Purpose

On the **admin registration detail** page, give verifiers **read-only context** about:

- **Partner ticket** presence and key fields already stored on tickets.
- **Pengurus** status of the **primary** member (directory lookup), explaining why a partner ticket may exist under current club rules.
- **Member-number conflicts** across the **same event**: any **other registration** whose tickets reuse a non-null `memberNumber` appearing on **this** registration’s tickets.

**Verifier policy (locked):** this is **informational only**. **No** confirmation modal before approve/reject, **no** server-side blocking in `approveRegistration` (or related actions) based on these signals.

## 2) Scope

### 2.1 In scope

- Route: `src/app/admin/events/[eventId]/inbox/[registrationId]/page.tsx` — extend data assembly and pass structured props into `RegistrationDetail`.
- Component: `src/components/admin/registration-detail.tsx` — add a compact panel/section (“Konteks tiket & kursi” or equivalent label) consuming the new props.

### 2.2 Out of scope (YAGNI for this spec)

- Inbox **list** row badges/indicators (`/admin/events/[eventId]/inbox`).
- Changing **pricing**, **ticket rows**, **member validation** actions, or **approve/reject** contracts.
- New Prisma migrations or persisted “warning” entities.

## 3) Locked product decisions

| Topic | Decision |
|--------|-----------|
| Approve/reject UX | No extra gates (user chose **inform-only**). |
| Conflict detection | Consider **every** `Ticket` row on **other** registrations for the same `eventId` that shares the same non-null `memberNumber`, **without** filtering by parent `Registration.status`. |
| Rationale | Rejected/cancelled/refunded rows can still reveal **data inconsistency** worth surfacing; hiding them would miss orphan or historical collisions. |

## 4) Behaviour

### 4.1 Partner summary

- Derive from existing `registration.tickets` (e.g. `role === partner`).
- Show: whether a partner row exists; **fullName**; **whatsapp** if present; **memberNumber** if present; **ticketPriceType** (labelled for human reading, reusing or mirroring existing admin copy patterns).

### 4.2 Pengurus (directory)

- **Read-only** lookup on `MasterMember` using the **canonical primary** member number:
  - Prefer `memberNumber` on the ticket with `role === primary` when non-null.
  - Otherwise fall back to `registration.claimedMemberNumber` when non-null.
- Display **boolean** `isPengurus` (or equivalent label: Ya/Tidak). If no row in directory: show explicit “tidak ditemukan di direktori” (distinct from “bukan pengurus”).

### 4.3 Cross-registration member-number conflicts

- Collect distinct **non-null** `memberNumber` values from **all** tickets belonging to **this** registration.
- For each such number, find tickets where `eventId` matches, `memberNumber` matches, and `registrationId` is **not** this registration’s id.
- For each conflicting **registration** (dedupe by `registrationId`), expose at minimum: `registrationId`, and a short label for the link (e.g. `contactName` from that registration).
- UI: warning list with **links** to `/admin/events/{eventId}/inbox/{otherRegistrationId}`.
- If no conflicts: show neutral state (no warning).

### 4.4 Failure handling

- If the supplemental Prisma query or lookup throws: the main page must still render; the context panel may show a single **non-blocking** line such as “Tidak dapat memuat konteks kursi” and omit detailed subsections.

## 5) Technical design

### 5.1 Data flow

1. `page.tsx` loads the registration (existing query unchanged in spirit; may add `select` fields needed for links, e.g. `tickets.role`, `tickets.memberNumber` — already largely present).
2. `page.tsx` runs **one** focused query (or small set) to resolve:
   - `MasterMember` row for primary number (pengurus flag).
   - Other registrations / tickets for conflict list (see §4.3).
3. Build a **view-model** object (e.g. `TicketContextVm`) passed as a prop to `RegistrationDetail`.

### 5.2 Code organisation

- Prefer a **pure helper** for shaping conflict output from query results (easy to unit test).
- Prefer a thin Prisma-backed function in `src/lib/registrations/` (or sibling) exported for use from the server page — **no** `'use client'` in data layer.

### 5.3 Types

- Extend or wrap the existing `DetailRegistration` typing in `registration-detail.tsx`: either widen the props type with an optional/discriminated `ticketContext`, or compose a wrapper prop; avoid duplicating large inline types unnecessarily.

### 5.4 Performance

- One round-trip batch pattern is enough: single query with `IN` over member numbers, `where registrationId <> current`, `distinct`/`groupBy` as appropriate.
- Typical cardinality: ≤2 member numbers per registration (primary + partner); query cost is negligible for admin detail.

## 6) Testing

- **Unit tests** for the pure “conflict aggregation” logic (fixtures: no overlap, single overlap, multiple others, duplicate tickets same reg).
- Optional: extend existing admin component tests only if there is already a harness; **not** required to add browser E2E in this spec.

## 7) Success criteria

- Verifier opening a registration with a partner ticket sees **partner** and **pengurus** context without opening the public form.
- If the database contains two different registrations in the same event sharing a `memberNumber` on tickets, the detail page shows a **visible warning** and **deep links** to the other registration(s).
- Approve/reject behaviour is **unchanged**.

## 8) Follow-ups (not in this spec)

- Inbox-level indicator column for “possible seat conflict”.
- Filter/sort inbox by “has conflict” (requires defining stable conflict rules and possibly caching).
