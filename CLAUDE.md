# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Documentation maintenance

**Agents must keep this file up to date.** Whenever you change code that affects anything documented here, update the relevant section in the same task — not as a follow-up. Specifically:

- **New route or API endpoint** → add to "Route layout"
- **New or renamed lib module** → add to "Key library modules"
- **New Prisma model or enum** → add to "Data model"
- **New convention, pattern, or mandatory step** → add to the relevant section (server actions, forms, uploads, etc.)
- **Role permission change** → update the permission table
- **New environment variable** → add to the environment variable table
- **New CLI command or script** → add to "Commands"

Do **not** document ephemeral implementation details (local variable names, internal function bodies). Document only things that a future agent needs to understand *before* reading the code — cross-file invariants, non-obvious constraints, and conventions that would take multiple file reads to discover.

## Commands

```bash
# Development
pnpm dev          # Next.js dev server (http://localhost:3000)
pnpm build        # runs vercel-migrate.mjs + prisma generate + next build
pnpm lint         # ESLint
pnpm test         # Vitest (run once)
pnpm test:watch   # Vitest watch mode

# Run a single test file
pnpm vitest run src/lib/pricing/compute-submit-total.test.ts

# Database migrations (Prisma reads `.env` + overlay by MATCH_DB_PROFILE; default dev = `.env.local`, prod = `.env.prod`)
pnpm db:migrate:dev              # prisma migrate dev (development profile)
pnpm db:migrate:deploy:prod       # prisma migrate deploy against URLs in .env.prod (local operator)
pnpm db:studio:dev               # prisma studio (dev)
pnpm auth:migrate                 # Better Auth CLI migrate (.env.local overlay)
pnpm auth:migrate:prod            # Same, production profile (.env.prod)
pnpm bootstrap:admin ...        # default development profile / .env.local
pnpm bootstrap:admin:prod ...    # production profile / .env.prod

# Equivalent without helpers (MATCH_DB_PROFILE optional; omit = development):
# MATCH_DB_PROFILE=development pnpm prisma migrate dev

# Deploy on Vercel still uses Dashboard env vars; `scripts/vercel-migrate.mjs` runs migrate deploy there (not `.env.prod` files).
```

All commands need Node 24 active. See AGENTS.md for the `nvm use` bootstrap pattern.

## Environment variables

Copy `.env.example` to `.env.local` and fill in for local development. Optionally keep `.env.prod` on your machine **only** for operator commands targeting production Postgres (never commit; `.env*` is gitignored):

| Variable                | Purpose                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATCH_DB_PROFILE`      | Optional for **local CLI only**: unset / `development` / `dev` → load `.env` then `.env.local`; `production` / `prod` → `.env` then `.env.prod`. Ignored on Vercel.                                                   |
| `DATABASE_URL`          | **Pooled** PostgreSQL URL for the app (Neon: hostname includes `-pooler`; also used by Prisma Client via `@prisma/adapter-neon`). Optional: add `connect_timeout=10` (seconds) if cold starts time out.               |
| `DATABASE_URL_UNPOOLED` | **Direct** PostgreSQL URL for Prisma CLI (`migrate`, `db push`, Studio). Neon: hostname **without** `-pooler`. On local Postgres, set the same value as `DATABASE_URL` or omit (config falls back to `DATABASE_URL`). |
| `BETTER_AUTH_SECRET`    | Min 32-char secret for Better Auth                                                                                                                                                                                    |
| `BETTER_AUTH_URL`       | App origin (e.g. `http://localhost:3000`)                                                                                                                                                                             |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for file uploads                                                                                                                                                                                    |

On **Vercel**, add **`DATABASE_URL_UNPOOLED`** (Neon non-pooler connection string) for Production and Preview so `scripts/vercel-migrate.mjs` runs `prisma migrate deploy` against a direct endpoint.

## Architecture

### What this app is

An event registration system for a members-only social club (CISC). Members and non-members register for club events via a public form, upload payment proof, and an admin team reviews/approves each registration.

### Route layout (`src/app/`)

- `(public)/` — unauthenticated public routes
  - `/` — homepage listing active events
  - `/events/[slug]` — event registration page (public form)
  - `/events/[slug]/register/[registrationId]` — post-submission confirmation
- `(auth)/admin/sign-in` — magic-link + email/password sign-in (plus two-factor, magic-link-sent sub-pages)
- `(auth)/admin/invite/[token]` — onboarding for invited admins; excluded from the admin auth redirect via `src/proxy.ts`
- `admin/` — authenticated admin area (all routes require a session; redirect enforced in `src/proxy.ts` + `admin/layout.tsx`)
  - `admin/events/` — event list + new event
  - `admin/events/[eventId]/inbox` — registrations list
  - `admin/events/[eventId]/inbox/[registrationId]` — registration detail + action panels
  - `admin/events/[eventId]/report` — aggregated report + CSV export
  - `admin/events/[eventId]/edit` — event editor (venue, menu, pricing, hero cover)
  - `admin/members/` — master member directory (CSV import/export)
  - `admin/management/` — kepengurusan hub
  - `admin/management/[periodId]` — board period detail (roles, assignments, PDF/CSV export)
  - `admin/venues/` — venue list; `admin/venues/[venueId]/edit`, `admin/venues/new`
  - `admin/settings/` — committee settings (Owner-only sub-pages: branding, committee, notifications, operations, pricing, security, whatsapp-templates)
  - `admin/account/` — personal account page (display name, 2FA)
- `api/auth/[...all]` — Better Auth catch-all handler
- `api/admin/events/[eventId]/title` — lightweight title lookup for breadcrumbs
- `api/admin/pic-banks/[adminProfileId]` — PIC bank accounts for the event form

### Role permission model

| Capability | Owner | Admin | Verifier | Viewer |
| --- | --- | --- | --- | --- |
| Verify/edit registrations on all events | ✓ | ✓ | ✓ | — |
| Verify/edit registrations on assigned events | ✓ | ✓ | ✓ | ✓ (via `EventPicHelper`) |
| Operational management (members, events, venues, management) | ✓ | ✓ | — | — |
| Committee advanced settings (pricing, WA templates, branding, security) | ✓ | — | — | — |

`lib/permissions/roles.ts` exports `hasGlobalVerifierAccess`, `hasOperationalOwnerParity`, and `canManageCommitteeAdvancedSettings`. Use these functions rather than comparing role strings directly. Guard functions in `lib/actions/guard.ts` wrap these for server actions.

`EventPicHelper` rows grant a `Viewer` account access to specific events; `AdminContext.helperEventIds` carries the list and is checked by `canVerifyEvent`.

### Data model (`prisma/schema.prisma`)

Key entities:

- **`MasterMember`** — the club member directory; `isManagementMember` gates partner ticket eligibility and is **derived from kepengurusan** (`BoardAssignment` for the active `BoardPeriod` when the pengurus row links via `ManagementMember.masterMemberId`), not edited manually in the directory UI
- **`Event`** — slug, per-event ticket pricing, timeline **`openRegistrationAt` / `closeRegistrationAt` / `openGateAt` / `kickOffAt`**, **`mandatoryMenuItemIds`** (subset of linked venue menu items), linked menu via **`EventVenueMenuItem`**; financial PIC is **`picAdminProfileId`** (`AdminProfile`); pembayaran via **`bankAccountId`** → **`PicBankAccount`**
- **`Venue`** / **`VenueMenuItem`** — venues carry a reusable menu item catalogue; when creating/editing an event the selected venue menu items are copied into **`EventVenueMenuItem`** rows (snapshotted at event creation; frozen after first registration — see `lib/venues/venue-menu-frozen-item-ids.ts` and `lib/events/event-edit-guards.ts`)
- **`Registration`** — **satu baris per tiket** (utama dan/atau partner sebagai baris terpisah); partner menaut ke pembeli utama lewat **`primaryRegistrationId`**; **`ticketRole`**, **`ticketPriceType`**, **`mandatoryMenuItemId`**, **`ticketPriceApplied`**, **`mandatoryMenuPriceApplied`**, **`computedTotalAtSubmit`**; status flows: `submitted → pending_review → approved / rejected / payment_issue`
- **`Ticket`** — **legacy** (deprecated); pendaftaran baru tidak membuat baris `Ticket`; unik `(eventId, memberNumber)` tetap relevan untuk data lama / migrasi
- **`Upload`** — Vercel Blob metadata for transfer proofs and member card photos; converted to WebP before storage
- **`AdminProfile`** — links a Better Auth `authUserId` to an `AdminRole` (`Owner` | `Admin` | `Verifier` | `Viewer`) and optionally to a `MasterMember`; **`Admin`** mirrors **`Owner`** operationally but not committee advanced settings (`canManageCommitteeAdvancedSettings`)
- **`AdminInvitation`** — Owner-issued onboarding invite (`emailNormalized`, `role`, hashed token); consumed when the recipient completes `signUpEmail` and gets an `AdminProfile`. Existing app users without an admin profile cannot be onboarded via invite (different email or operator tooling).
- **`BoardPeriod`** / **`BoardRole`** / **`ManagementMember`** / **`BoardAssignment`** — kepengurusan (committee) structure; `recompute-directory-flags.ts` syncs `MasterMember.isManagementMember` from `BoardAssignment`
- **`ClubWaTemplate`** — per-`WaTemplateKey` body overrides stored in DB; loaded by `lib/wa-templates/load-club-wa-templates.ts` and merged with hardcoded defaults in `lib/wa-templates/render-wa-from-db.ts`
- **`ClubBranding`** / **`ClubOperationalSettings`** / **`ClubNotificationPreferences`** — singleton rows (always `singletonKey = "default"`); read via `lib/public/load-club-*.ts` helpers; mutations are Owner-only and append to `ClubAuditLog`
- **`ClubAuditLog`** — append-only log of sensitive Owner-level mutations; written via `lib/audit/append-club-audit-log.ts` using action constants from `lib/audit/club-audit-actions.ts`

Better Auth manages its own tables (users, sessions) directly via `pg.Pool` — they are **not** in `prisma/schema.prisma`.

Registration status flows: `submitted → pending_review → approved / rejected / payment_issue`. Once approved, further state is tracked via `AttendanceStatus` (separate from `RegistrationStatus`) and `InvoiceAdjustment` rows (for underpayments). Cancel and refund are terminal states set directly on `Registration.status`.

### Key library modules (`src/lib/`)

- `lib/auth/auth.ts` — Better Auth config (magic-link + email/password, `nextCookies` plugin)
- `lib/auth/session.ts` — `getAdminSession()` / `requireAdminSession()` — reads session from Next.js request headers
- `lib/db/prisma.ts` — singleton `PrismaClient` with `PrismaNeon` adapter (pooled `DATABASE_URL`, Neon-recommended; HMR-safe via `globalThis`)
- `lib/actions/guard.ts` — **all admin server actions must start here**: `guardEvent(eventId)`, `guardOwner()`, `guardOwnerOrAdmin()`, `isAuthError(e)`. Throws `"NO_PROFILE"` / `"FORBIDDEN"` / `"UNAUTHENTICATED"` strings; catch with `isAuthError` to surface as "Tidak diizinkan."
- `lib/forms/action-result.ts` — `ActionResult<T>` discriminated union (`{ ok: true; data }` / `{ ok: false; fieldErrors?, rootError? }`); helpers `ok()`, `rootError()`, `fieldError()`. All admin server actions return this type.
- `lib/client/cud-notify.ts` — client-side toast helpers: `toastCudSuccess(operation, message?)` and `toastActionErr(err, fallback?)`. Use these after calling a server action on the client instead of calling `toast` directly.
- `lib/audit/append-club-audit-log.ts` — `appendClubAuditLog(db, row)` — call this inside any Owner mutation that touches club-level configuration; use constants from `lib/audit/club-audit-actions.ts` for the `action` field
- `lib/actions/submit-registration.ts` — the main public Server Action; validates form, computes pricing, runs a Prisma transaction, then uploads files to Vercel Blob; rolls back blob uploads on failure
- `lib/pricing/compute-submit-total.ts` — pure function for total calculation; tested in isolation
- `lib/uploads/upload-image.ts` — converts any allowed image to WebP via Sharp, uploads to Blob with retry, saves metadata to DB
- `lib/permissions/guards.ts` — `canVerifyEvent(ctx, eventId)` — role-based access check (used by `guardEvent`)
- `lib/reports/queries.ts` — `getEventReport(eventId)` — parallel queries for attendance, finance (`baselineTotal`, agregat tiket/menu approved, penyesuaian, refund), dan agregasi menu wajib per item (`MenuStats.byItem`)
- `lib/reports/csv.ts` — `generateRegistrationsCsv(eventId)` — CSV UTF-8 satu baris per `Registration` (peran, pembeli utama untuk partner, menu wajib, harga snapshot, kolom legacy tiket, penyesuaian)
- `lib/events/event-timing.ts` — helper fase/waktu pendaftaran dan gate (`isRegistrationTimeWindowOpen`, `getEventPhase`, dll.)
- `lib/registrations/partner-registration.ts` — helper baris utama/partner (`getPrimaryRegistration`, `getRegistrationPair`, dll.)
- `lib/wa-templates/messages.ts` — hardcoded WhatsApp message template functions (Indonesian); `lib/wa-templates/render-wa-from-db.ts` merges DB overrides (`ClubWaTemplate`) on top of these defaults before use
- `lib/notifications/notification-outbound-mode.ts` — resolves `NotificationOutboundMode` (`off` / `log_only` / `live`) from `ClubNotificationPreferences` to a behaviour struct
- `lib/public/club-operational-policy.ts` — `mergeGlobalRegistrationClosure` / `effectiveMaintenanceBanner` — merges per-event and global registration closure settings for the public registration page
- `lib/events/registration-window.ts` — `RegistrationNotAcceptableError`; quota counting that excludes `rejected`, `cancelled`, `refunded` statuses
- `lib/events/event-admin-defaults.ts` — saran harga tiket dari env `MATCH_DEFAULT_TICKET_*_IDR` (`resolveCommitteeTicketDefaults()` tanpa query DB; tabel komite lama dihapus)
- `lib/registrations/admin-ticket-context.ts` — builds the full ticket context used by the admin registration detail page
- `lib/admin/` — admin-domain helpers: invite crypto, email, dashboard view model, committee invariants, nav flags, PIC bank permissions, path helpers

### UI components

- `src/components/ui/` — shadcn/ui primitives (auto-generated; edit with caution)
- `src/components/public/` — public-facing: `RegistrationForm`, `EventCard`, `PriceBreakdown`
- `src/components/admin/` — admin-facing panels and layout; `RegistrationDetail` memakai `registration-detail-panels/RegistrationRelationsCard` dan `RegistrationStatusPanel`, serta `AttendancePanel`, `CancelRefundPanel`, `MemberValidationPanel`, `InvoiceAdjustmentPanel`, `VoucherRedemptionPanel`

**`@base-ui/react` Dialog pattern** (not Radix UI — APIs differ): use the `render` prop, not `asChild`. To disable a trigger while a transition is pending, put `disabled` on `<DialogTrigger>`, not on the inner element:

```tsx
<DialogTrigger disabled={isPending} render={<Button variant="outline" />}>
  Open
</DialogTrigger>
```

Notable third-party UI libraries: `@tanstack/react-table` for data tables; `@tiptap/react` (with `starter-kit`, `link`, `underline` extensions) for the event description rich-text editor; `react-day-picker` for date pickers; `@react-pdf/renderer` for PDF export (management period).

### Server action conventions

Every admin server action must:

1. Start with `"use server"`
2. Call `guardEvent(eventId)` or `guardOwner()` / `guardOwnerOrAdmin()` from `lib/actions/guard.ts` — never roll your own auth check
3. Return `ActionResult<T>` from `lib/forms/action-result.ts`
4. Use Prisma enum values (e.g. `RegistrationStatus.approved`), not raw strings
5. Write error messages in Indonesian (consistent with the rest of the codebase)
6. Call `appendClubAuditLog` for any Owner-only mutation that changes club configuration

### Forms pattern

Forms use `react-hook-form` + `zod` + shadcn `Form` wrappers. File inputs (`transferProof`, `memberCardPhoto`) are handled outside RHF (read from `e.currentTarget.elements`) because RHF doesn't manage `File` objects — they are appended to `FormData` manually before calling the Server Action.

### Pricing

All monetary values are stored as integers in IDR smallest unit (i.e., whole rupiah). `computeSubmitTotal` is the single source of truth; it runs both client-side (live preview) and server-side (authoritative snapshot).

### Uploads

Images are converted to WebP (max 1600px, quality 80) via Sharp before being put to Vercel Blob with **`access: "public"`** so the CDN can serve them directly (`next/image` and browser fetches bill mostly to Blob storage, not through app functions). Anyone with the full blob URL can download the object—treat URLs as confidential. Paths are deterministic (e.g. `registrations/{registrationId}/{purpose}.webp`; event cover under `events/{eventId}/cover.webp`). DB row is written after the blob PUT; if the DB write fails, the blob is deleted as cleanup. Objects uploaded earlier as **private** stay private until re-upload or a deliberate migration replaces them.

### Testing

Tests are co-located next to their module as `.test.ts` files, with cross-cutting unit tests in `src/tests/unit/`. Vitest runs in `node` environment — no browser/DOM tests. Test setup file: `src/tests/vitest.setup.ts`. Action tests (e.g. `admin-events.test.ts`) mock Prisma and blob calls; pure logic tests (e.g. `compute-submit-total.test.ts`) have no mocks.
