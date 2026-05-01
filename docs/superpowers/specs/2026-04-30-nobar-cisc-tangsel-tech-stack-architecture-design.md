# Nobar CISC Tangsel — Tech Stack & Architecture (Design)

Date: 2026-04-30  
Project: `match-screening` (Next.js)  
Scope: MVP architecture & tech stack derived from `docs/superpowers/specs/2026-04-29-nobar-cisc-tangsel-design.md`.

## 1) Decisions (Locked)

### 1.1 Product boundaries

- **Participant flow**: **no participant accounts** (participants submit the form once per registration).
- **Admin flow**: authenticated admin panel with roles + per-event PIC hybrid permissions.

### 1.2 Hosting & runtime

- **Hosting**: Vercel
- **App**: single full-stack **Next.js App Router** application
- **Rendering**:
  - Public pages: RSC (default) + Server Actions for submit
  - Admin pages: RSC + Server Actions for all mutations

### 1.3 AuthN/AuthZ

- **Auth provider**: **Better Auth** (admin only)
- **Admin sign-in methods**:
  - Email + password
  - Magic link (email)
- **Authorization model** (defense in depth):
  - **Middleware per-route (coarse gate)**: `/admin/**` requires authenticated admin session (redirect to login if not).
  - **Guard per-action (precise)**: every server action that reads sensitive data or mutates state enforces:
    - Global role: `Owner | Verifier | Viewer`
    - Hybrid rule: `PIC Helper` gets verifier capabilities **only** for assigned event(s)

### 1.4 Database & ORM

- **Database**: Postgres managed (**Neon**)
- **ORM/migrations**: **Prisma**

### 1.5 File storage (uploads)

- **Storage**: **Vercel Blob** (selected: **Option A**)
- **Files**:
  - `transferProof` (required)
  - `memberCardPhoto` (required only when claiming member/committee)
- **Storage rule**: store files in Blob; store only metadata + URL in Postgres (never store base64 blobs in DB).
- **Size optimization**: uploaded images are converted to **WebP** (optionally AVIF if later needed) with resize + size limits.

### 1.6 Notifications

- WhatsApp notifications are **no-budget** via **click-to-chat** (`wa.me`) with templates in admin UI.

## 2) High-level Architecture

### 2.1 Single-app component map

**Next.js app** contains two surfaces:

- **Public (participants)**:
  - `/` list active events
  - `/events/[slug]` registration form (+ receipt page/section after submit)
- **Admin (authenticated)**:
  - `/admin` dashboard, events CRUD, registration inbox, reports, master data

### 2.2 Data flows (core)

#### Registration submit (participant)

1. Participant selects event (`/events/[slug]`) and fills form.
2. Server Action validates:
   - event is `active`
   - duplicate `memberNumber` per event constraint (for any provided memberNumber on primary/partner)
3. Upload files to Blob (transfer proof; member card photo if required).
4. Compute and lock snapshot pricing:
   - `computedTotalAtSubmit` + applied prices
5. Persist:
   - `Registration` + `Ticket(s)` + menu entitlement (PRESELECT or VOUCHER)
   - file metadata/URLs
6. Set status to `pending_review` (after internal `submitted`).

#### Verification + status changes (admin)

1. Admin opens `/admin/events/[id]/inbox`.
2. Admin actions are Server Actions guarded by:
   - role checks (`Owner/Verifier`) OR PIC helper assignment for the event
3. Actions:
   - approve / reject (reason) / payment issue (reason)
   - member validation override
   - create invoice adjustment (delta) + mark paid/unpaid + attach additional proof
   - attendance marking
   - cancel/refund

#### WhatsApp click-to-chat

Admin UI renders `wa.me` buttons with:

- templated message body (URL encoded)
- destination = participant WhatsApp (partner fallback → primary contact)

## 3) Key Implementation Boundaries (to keep code maintainable)

### 3.1 Modules (suggested)

- `app/(public)/...`: public routes
- `app/admin/...`: admin routes
- `lib/auth/*`: Better Auth config + session helpers
- `lib/db/*`: Prisma client + query helpers
- `lib/permissions/*`: centralized guards (role + PIC assignment)
- `lib/uploads/*`: Blob upload + image conversion pipeline
- `lib/pricing/*`: pricing computation + snapshot locking
- `lib/wa-templates/*`: WhatsApp template rendering + encoding

### 3.2 Guarding pattern

- Middleware handles **authentication presence** and redirects.
- Server Actions enforce **authorization** (role + per-event assignment) and return typed errors suitable for admin UI.

## 4) Vercel Blob Cost Expectation (MVP)

Based on the Hobby tier screenshot shared:

- Includes **1 GB storage / month**; then **$0.025 per GB-month**
- Includes **10 GB data transfer**; then **$0.053 per GB**
- Ops limits are far above expected MVP usage.

With **~30 registrations / event** and images converted to WebP/AVIF (typical 100–600KB per image), expected usage per event is usually **tens of MB**, which stays comfortably within the included free tier for storage and transfer.

## 5) Open Items (Defer to implementation plan)

- Exact Prisma schema and indexes derived from the conceptual ERD.
- Exact image conversion settings (max dimension, target quality, max bytes).
- Rate limiting / abuse protections for public form submission.
- Backups/retention policy for uploaded proofs (delete after N months vs keep).
