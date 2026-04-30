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

# Database migrations (requires prisma.config.ts to pick up DATABASE_URL)
pnpm prisma migrate dev    # apply + generate after schema changes
pnpm prisma migrate deploy # apply in CI/prod
pnpm prisma studio         # GUI browser
```

All commands need Node 24 active. See AGENTS.md for the `nvm use` bootstrap pattern.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Min 32-char secret for Better Auth |
| `BETTER_AUTH_URL` | App origin (e.g. `http://localhost:3000`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for file uploads |

## Architecture

### What this app is

An event registration system for a members-only social club (CISC). Members and non-members register for club events via a public form, upload payment proof, and an admin team reviews/approves each registration.

### Route layout (`src/app/`)

- `(public)/` — unauthenticated public routes
  - `/` — homepage listing active events
  - `/e/[slug]` — event registration page (public form)
  - `/e/[slug]/r/[registrationId]` — post-submission confirmation
- `(auth)/admin/sign-in` — magic-link + email/password sign-in
- `admin/` — authenticated admin dashboard
  - `admin/events/[eventId]/inbox` — registrations list
  - `admin/events/[eventId]/inbox/[registrationId]` — registration detail + actions
- `api/auth/[...all]` — Better Auth catch-all handler

### Data model (`prisma/schema.prisma`)

Key entities:

- **`MasterMember`** — the club member directory; `isPengurus` flag gates partner ticket eligibility
- **`Event`** — has a slug, pricing, menu config (`MenuMode`: `PRESELECT` | `VOUCHER`), and PIC assignment
- **`Registration`** — one per submission; prices are snapshotted at submit time (`*Applied` fields); status flows: `submitted → pending_review → approved / rejected / payment_issue`
- **`Ticket`** — one `primary` + optional `partner` per registration; unique constraint on `(eventId, memberNumber)` prevents double-booking
- **`Upload`** — Vercel Blob metadata for transfer proofs and member card photos; converted to WebP before storage
- **`AdminProfile`** — links a Better Auth `authUserId` to an `AdminRole` (`Owner` | `Verifier` | `Viewer`) and optionally to a `MasterMember`

Better Auth manages its own tables (users, sessions) directly via `pg.Pool` — they are **not** in `prisma/schema.prisma`.

### Key library modules (`src/lib/`)

- `lib/auth/auth.ts` — Better Auth config (magic-link + email/password, `nextCookies` plugin)
- `lib/auth/session.ts` — `getAdminSession()` / `requireAdminSession()` — reads session from Next.js request headers
- `lib/db/prisma.ts` — singleton `PrismaClient` using `PrismaPg` adapter (pg pool, dev HMR-safe via `globalThis`)
- `lib/actions/submit-registration.ts` — the main Server Action; validates form, computes pricing, runs a Prisma transaction, then uploads files to Vercel Blob; rolls back blob uploads on failure
- `lib/pricing/compute-submit-total.ts` — pure function for total calculation; tested in isolation
- `lib/uploads/upload-image.ts` — converts any allowed image to WebP via Sharp, uploads to Blob with retry, saves metadata to DB
- `lib/permissions/guards.ts` — `canVerifyEvent(ctx, eventId)` — role-based access for admin actions
- `lib/wa-templates/messages.ts` — WhatsApp message templates (Indonesian); used by admin to send status updates

### UI components

- `src/components/ui/` — shadcn/ui primitives (auto-generated; edit with caution)
- `src/components/public/` — public-facing: `RegistrationForm`, `EventCard`, `PriceBreakdown`
- `src/components/admin/` — admin-facing: `InboxTable`, `RegistrationDetail`, `RegistrationStatusBadge`

### Forms pattern

Forms use `react-hook-form` + `zod` + shadcn `Form` wrappers. File inputs (`transferProof`, `memberCardPhoto`) are handled outside RHF (read from `e.currentTarget.elements`) because RHF doesn't manage `File` objects — they are appended to `FormData` manually before calling the Server Action.

### Pricing

All monetary values are stored as integers in IDR smallest unit (i.e., whole rupiah). `computeSubmitTotal` is the single source of truth; it runs both client-side (live preview) and server-side (authoritative snapshot).

### Uploads

Images are converted to WebP (max 1600px, quality 80) via Sharp before being put to Vercel Blob. The blob path is `registrations/{registrationId}/{purpose}.webp`. DB row is written after the blob PUT; if the DB write fails, the blob is deleted as cleanup.

### Testing

Tests live in two places:
- Co-located `.test.ts` files next to the module (e.g., `compute-submit-total.test.ts`)
- `src/tests/unit/` for cross-cutting unit tests

Vitest runs in `node` environment. No browser/DOM tests. Test setup file: `src/tests/vitest.setup.ts`.
