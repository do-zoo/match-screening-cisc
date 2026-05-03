# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

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
- `(auth)/admin/sign-in` — magic-link + email/password sign-in
- `admin/` — authenticated admin dashboard (plus `(auth)/admin/invite/[token]` — onboarding for invited admins; excluded from dashboard auth redirect via `proxy.ts`)
  - `admin/events/[eventId]/inbox` — registrations list
  - `admin/events/[eventId]/inbox/[registrationId]` — registration detail + actions
  - `admin/events/[eventId]/report` — per-event aggregated report + CSV export
  - `admin/events/[eventId]/edit` — event editor
- `api/auth/[...all]` — Better Auth catch-all handler

### Data model (`prisma/schema.prisma`)

Key entities:

- **`MasterMember`** — the club member directory; `isManagementMember` gates partner ticket eligibility and is **derived from kepengurusan** (`BoardAssignment` for the active `BoardPeriod` when the pengurus row links via `ManagementMember.masterMemberId`), not edited manually in the directory UI
- **`Event`** — slug, pricing, menu config (`MenuMode`: `PRESELECT` | `VOUCHER`); financial PIC is **`picAdminProfileId`** (`AdminProfile`), not a directory flag; **`PicBankAccount`** is owned by **`ownerAdminProfileId`**
- **`Registration`** — one per submission; prices are snapshotted at submit time (`*Applied` fields); status flows: `submitted → pending_review → approved / rejected / payment_issue`
- **`Ticket`** — one `primary` + optional `partner` per registration; unique constraint on `(eventId, memberNumber)` prevents double-booking
- **`Upload`** — Vercel Blob metadata for transfer proofs and member card photos; converted to WebP before storage
- **`AdminProfile`** — links a Better Auth `authUserId` to an `AdminRole` (`Owner` | `Admin` | `Verifier` | `Viewer`) and optionally to a `MasterMember`; **`Admin`** mirrors **`Owner`** operationally but not committee advanced settings (`canManageCommitteeAdvancedSettings`)
- **`AdminInvitation`** — Owner-issued onboarding invite (`emailNormalized`, `role`, hashed token); consumed when the recipient completes `signUpEmail` and gets an `AdminProfile`. Linking an **existing** auth user to a profile stays on **Komite** via “Tautkan akun ada”, not this flow.

Better Auth manages its own tables (users, sessions) directly via `pg.Pool` — they are **not** in `prisma/schema.prisma`.

Registration status flows: `submitted → pending_review → approved / rejected / payment_issue`. Once approved, further state is tracked via `AttendanceStatus` (separate from `RegistrationStatus`) and `InvoiceAdjustment` rows (for underpayments). Cancel and refund are terminal states set directly on `Registration.status`.

### Key library modules (`src/lib/`)

- `lib/auth/auth.ts` — Better Auth config (magic-link + email/password, `nextCookies` plugin)
- `lib/auth/session.ts` — `getAdminSession()` / `requireAdminSession()` — reads session from Next.js request headers
- `lib/db/prisma.ts` — singleton `PrismaClient` with `PrismaNeon` adapter (pooled `DATABASE_URL`, Neon-recommended; HMR-safe via `globalThis`)
- `lib/actions/guard.ts` — **all admin server actions must start here**: `guardEvent(eventId)`, `guardOwner()`, `guardOwnerOrAdmin()`, `isAuthError(e)`. Throws `"NO_PROFILE"` / `"FORBIDDEN"` / `"UNAUTHENTICATED"` strings; catch with `isAuthError` to surface as "Tidak diizinkan."
- `lib/forms/action-result.ts` — `ActionResult<T>` discriminated union (`{ ok: true; data }` / `{ ok: false; fieldErrors?, rootError? }`); helpers `ok()`, `rootError()`, `fieldError()`. All admin server actions return this type.
- `lib/actions/submit-registration.ts` — the main public Server Action; validates form, computes pricing, runs a Prisma transaction, then uploads files to Vercel Blob; rolls back blob uploads on failure
- `lib/pricing/compute-submit-total.ts` — pure function for total calculation; tested in isolation
- `lib/uploads/upload-image.ts` — converts any allowed image to WebP via Sharp, uploads to Blob with retry, saves metadata to DB
- `lib/permissions/guards.ts` — `canVerifyEvent(ctx, eventId)` — role-based access check (used by `guardEvent`)
- `lib/reports/queries.ts` — `getEventReport(eventId)` — 10 parallel queries for attendance, finance, menu/voucher aggregations
- `lib/reports/csv.ts` — `generateRegistrationsCsv(eventId)` — 14-column RFC 4180 CSV
- `lib/wa-templates/messages.ts` — WhatsApp message templates (Indonesian); covers approval, rejection, payment issue, cancellation, refund, underpayment invoice

### UI components

- `src/components/ui/` — shadcn/ui primitives (auto-generated; edit with caution)
- `src/components/public/` — public-facing: `RegistrationForm`, `EventCard`, `PriceBreakdown`
- `src/components/admin/` — admin-facing panels and layout; `RegistrationDetail` composes the action panels: `AttendancePanel`, `CancelRefundPanel`, `MemberValidationPanel`, `InvoiceAdjustmentPanel`, `VoucherRedemptionPanel`

**`@base-ui/react` Dialog pattern** (not Radix UI — APIs differ): use the `render` prop, not `asChild`. To disable a trigger while a transition is pending, put `disabled` on `<DialogTrigger>`, not on the inner element:

```tsx
<DialogTrigger disabled={isPending} render={<Button variant="outline" />}>
  Open
</DialogTrigger>
```

### Server action conventions

Every admin server action must:

1. Start with `"use server"`
2. Call `guardEvent(eventId)` or `guardOwner()` / `guardOwnerOrAdmin()` from `lib/actions/guard.ts` — never roll your own auth check
3. Return `ActionResult<T>` from `lib/forms/action-result.ts`
4. Use Prisma enum values (e.g. `RegistrationStatus.approved`), not raw strings
5. Write error messages in Indonesian (consistent with the rest of the codebase)

### Forms pattern

Forms use `react-hook-form` + `zod` + shadcn `Form` wrappers. File inputs (`transferProof`, `memberCardPhoto`) are handled outside RHF (read from `e.currentTarget.elements`) because RHF doesn't manage `File` objects — they are appended to `FormData` manually before calling the Server Action.

### Pricing

All monetary values are stored as integers in IDR smallest unit (i.e., whole rupiah). `computeSubmitTotal` is the single source of truth; it runs both client-side (live preview) and server-side (authoritative snapshot).

### Uploads

Images are converted to WebP (max 1600px, quality 80) via Sharp before being put to Vercel Blob with **`access: "public"`** so the CDN can serve them directly (`next/image` and browser fetches bill mostly to Blob storage, not through app functions). Anyone with the full blob URL can download the object—treat URLs as confidential. Paths are deterministic (e.g. `registrations/{registrationId}/{purpose}.webp`; event cover under `events/{eventId}/cover.webp`). DB row is written after the blob PUT; if the DB write fails, the blob is deleted as cleanup. Objects uploaded earlier as **private** stay private until re-upload or a deliberate migration replaces them.

### Testing

Tests live in two places:

- Co-located `.test.ts` files next to the module (e.g., `compute-submit-total.test.ts`)
- `src/tests/unit/` for cross-cutting unit tests

Vitest runs in `node` environment. No browser/DOM tests. Test setup file: `src/tests/vitest.setup.ts`.
