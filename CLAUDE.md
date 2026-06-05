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

Do **not** document ephemeral implementation details (local variable names, internal function bodies). Document only things that a future agent needs to understand _before_ reading the code — cross-file invariants, non-obvious constraints, and conventions that would take multiple file reads to discover.

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
pnpm normalize:member-numbers    # dry-run uppercase nomor member lama; `-- --apply` untuk menulis

# Equivalent without helpers (MATCH_DB_PROFILE optional; omit = development):
# MATCH_DB_PROFILE=development pnpm prisma migrate dev

# Deploy on Vercel still uses Dashboard env vars; `scripts/vercel-migrate.mjs` runs migrate deploy there (not `.env.prod` files).
```

All commands need Node 24 active. See AGENTS.md for the `nvm use` bootstrap pattern.

## Environment variables

Copy `.env.example` to `.env.local` and fill in for local development. Optionally keep `.env.prod` on your machine **only** for operator commands targeting production Postgres (never commit; `.env*` is gitignored):

| Variable                           | Purpose                                                                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATCH_DB_PROFILE`                 | Optional for **local CLI only**: unset / `development` / `dev` → load `.env` then `.env.local`; `production` / `prod` → `.env` then `.env.prod`. Ignored on Vercel.                                                   |
| `DATABASE_URL`                     | **Pooled** PostgreSQL URL for the app (Neon: hostname includes `-pooler`; also used by Prisma Client via `@prisma/adapter-neon`). Optional: add `connect_timeout=10` (seconds) if cold starts time out.               |
| `DATABASE_URL_UNPOOLED`            | **Direct** PostgreSQL URL for Prisma CLI (`migrate`, `db push`, Studio). Neon: hostname **without** `-pooler`. On local Postgres, set the same value as `DATABASE_URL` or omit (config falls back to `DATABASE_URL`). |
| `BETTER_AUTH_SECRET`               | Min 32-char secret for Better Auth; juga dipakai untuk menandatangani token unggah gambar deskripsi acara bila `DESCRIPTION_ASSET_SIGNING_SECRET` tidak diatur                                                        |
| `DESCRIPTION_ASSET_SIGNING_SECRET` | Opsional: secret terpisah untuk HMAC token unggah gambar di editor deskripsi (`signDescriptionAssetEventId`); jika kosong dipakai `BETTER_AUTH_SECRET`.                                                               |
| `BETTER_AUTH_URL`                  | App origin (e.g. `http://localhost:3000`)                                                                                                                                                                             |
| `BLOB_READ_WRITE_TOKEN`            | Vercel Blob token for file uploads                                                                                                                                                                                    |

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
  - `admin/` (root) — hub ringkas komunitas (pintasan ke modul + agregat registrasi menunggu tinjauan); bukan daftar acara utama
  - `admin/events/` — indeks acara: header (judul + Buat acara untuk Owner/Admin), toolbar filter (`?tab=`, `?q=` judul/slug/venue, pencarian debounce) + toggle kartu/tabel (`?view=tabel`) + ringkasan menunggu tinjauan; paginasi (`?page=`); tabel memakai filter status + teks yang sama; Verifier/Viewer hanya kartu; `tab` kosong → redirect ke `tab=active` (pertahankan `q` bila ada); `layout.tsx` cabang memuat `AdminEventsIndexFlashHandler` (Suspense) agar toast sukses hapus acara tampil setelah `deleteAdminEvent` mengarahkan ke `?flash=hapus-acara` (mencegah 404 karena refresh RSC halaman edit pasca-hapus)
  - `admin/events/[eventId]/registrants` — daftar peserta (toolbar: `?q=`, `?tab=` status pendaftaran, `?view=tabel` vs kartu, `?page=`); label nav **Peserta Acara**; URL lama `/admin/events/[eventId]/inbox` dialihkan permanen lewat `next.config.ts`
  - `admin/events/[eventId]/registrants/[registrationId]` — detail registrasi + tab (`?tab=ringkasan|verifikasi|operasi`, redirect kanonikal bila `tab` hilang/invalid); tab **verifikasi** = keputusan + dialog WA opsional pasca-simpan; tab **operasi** = email tagihan kekurangan + dialog reminder WA, cancel/refund + dialog WA
  - `admin/events/[eventId]/report` — aggregated report + CSV export; panel **bukti rekapitulasi penutupan** (transfer venue, nota venue, margin bendahara) untuk PIC acara / Owner / Admin dengan riwayat append-only
  - `admin/events/[eventId]/edit` — event editor (venue, menu, pricing, hero cover)
  - `admin/members/` — direktori anggota: toolbar debounce + chip status, tabel kontak (WA/email), paginasi server; CSV impor/ekspor
 - `admin/management/` — kepengurusan hub
 - `admin/management/members` — daftar pengurus (`ManagementMember`): toolbar debounce + Select tautan direktori, tabel kontak WA + kode publik
 - `admin/management/roles` — jabatan (`BoardRole`): toolbar debounce + Select status
 - `admin/management/[periodId]` — board period detail (roles, assignments, PDF/CSV export)
  - `admin/venues/` — indeks venue (toolbar mirip acara: `?tab=all|active|inactive`, `?q=` nama/alamat, `?view=tabel` vs kartu, `?page=`); `admin/venues/new`; cabang `admin/venues/[venueId]/` memakai layout breadcrumb + sub-nav (mobile) dan blok sidebar (desktop) seperti acara: `edit` (info dasar), `menu` (menu kanonik: judul + **Tambah item** di `admin-venue-menu-panel`; query `?q=` teks, `?view=tabel` untuk tabel vs kartu, `?page=` paginasi, `?filter=locked|unlocked` status kunci nama/harga — pola mirip indeks acara)
  - `admin/settings/` — committee settings (Owner-only sub-pages: branding, committee, notifications, operations, security, **templates**)
  - `admin/settings/templates` — hub template pesan (Owner)
  - `admin/settings/templates/whatsapp` — indeks template WA (kartu/tabel) + `[key]/edit` editor Tiptap
  - `admin/settings/templates/email` — indeks template email (tabel)
 - `admin/settings/templates/email/[key]/edit` — editor blok + Tiptap paragraf + pratinjau React Email
  - `admin/account/` — personal account page (display name, 2FA)
- `api/auth/[...all]` — Better Auth catch-all handler
- `api/admin/events/[eventId]/title` — judul acara + `canManageEventSettings` untuk breadcrumb/sidebar
- `api/admin/venues/[venueId]/label` — nama venue untuk breadcrumb/sidebar cabang venue (Owner/Admin operasional)

### Role permission model

| Capability                                                     | Owner | Admin | Verifier | Viewer                   |
| -------------------------------------------------------------- | ----- | ----- | -------- | ------------------------ |
| Verify/edit registrations on all events                        | ✓     | ✓     | ✓        | —                        |
| Verify/edit registrations on assigned events                   | ✓     | ✓     | ✓        | ✓ (via `EventPicHelper`) |
| Operational management (members, events, venues, management)   | ✓     | ✓     | —        | —                        |
| Committee advanced settings (WA templates, branding, security) | ✓     | —     | —        | —                        |

`lib/permissions/roles.ts` exports `hasGlobalVerifierAccess`, `hasOperationalOwnerParity`, and `canManageCommitteeAdvancedSettings`. Use these functions rather than comparing role strings directly. Guard functions in `lib/actions/guard.ts` wrap these for server actions.

`EventPicHelper` rows grant a `Viewer` account access to specific events; `AdminContext.helperEventIds` carries the list and is checked by `canVerifyEvent`.

### Data model (`prisma/schema.prisma`)

Key entities:

- **`MasterMember`** — the club member directory; optional `email`; `isManagementMember` is **derived from kepengurusan** (`BoardAssignment` for the active `BoardPeriod` when the pengurus row links via `ManagementMember.masterMemberId`), not edited manually in the directory UI
- **`Event`** — slug, timeline **`openRegistrationAt` / `closeRegistrationAt` / `openGateAt` / `kickOffAt`**, **`mandatoryMenuItemIds`** (subset of the event’s **`EventVenueMenuItem`** rows), linked menu via **`EventVenueMenuItem`**; `multiCategoryPurchase Boolean` — izinkan beli lintas kategori; `requireAllHolderData Boolean` — jika `false`, form publik hanya tampilkan 1 holder card (primary-only mode); server mengkloning data holder utama ke slot 2+ saat submit; dikunci setelah registrasi pertama; **`memberAccessMode MemberAccessMode`** — `open` (umum) / `tangsel_only` / `cisc_members` (acara khusus member; form publik tanpa jalur non-member); `ticketCategories EventTicketCategory[]` — kategori tiket per acara; financial PIC is **`picAdminProfileId`** (`AdminProfile`); pembayaran via **`bankAccountId`** → **`PicBankAccount`**
- **`Venue`** / **`VenueMenuItem`** — venues carry `name`, `address`, optional `mapUrl` (tautan peta), plus a reusable menu item catalogue (`name`, `price` IDR, `sortOrder`, optional public `description` + `imageBlobUrl`/`imageBlobPath`); **`EventVenueMenuItem`** snapshots which catalogue rows an event uses (with **no** registrations the admin editor links **all** venue items; after the first registration, join rows and order are frozen — see `lib/venues/venue-menu-frozen-item-ids.ts` and `lib/events/event-edit-guards.ts`). Menu `description`/image metadata stays editable even when name/price are locked, because it only affects presentation.
- **`Registration`** — **satu baris per transaksi**; `ticketCategoryId` → `EventTicketCategory`; `ticketQty` = total tiket; `holderDataMode` (`all_holders` | `primary_only`) snapshot saat submit dari `Event.requireAllHolderData`; `computedTotalAtSubmit` = jumlah `RegistrationTicket.ticketPriceApplied`; `contactEmail` (wajib pada submit publik baru; legacy boleh null); status flows: `submitted → pending_review → approved / rejected / payment_issue`
- **`RegistrationTicket`** — satu baris per tiket; `sortOrder`, `ticketPriceApplied`, `mandatoryMenuItemId` / `mandatoryMenuPriceApplied`, `assignedHolderId` → `RegistrationHolder`; invariant: `ticketQty === count(tickets)`
- **`RegistrationHolder`** — satu baris per **orang** (bukan per tiket klon); `sortOrder=1` = pemesan utama; `holderName`, `holderWhatsapp`, optional `holderEmail`, `claimedMemberNumber`, `memberValidation`, `memberType`; mode `primary_only` → satu holder + N tiket mengacu ke holder yang sama; mode `all_holders` → N holder + N tiket (1:1)
- **`EventTicketCategory`** — kategori tiket per acara: `name`, `regularPrice`, `memberPrice` (IDR whole rupiah), `maxQtyPerPerson` (null=tak terbatas), `capacity` (null=tak terbatas; batas total registrasi per kategori — dicek optimistik sebelum tx dan ulang di dalam tx), `isActive`, `sortOrder`; admin dapat tambah/edit/hapus lewat tab Harga & Tiket; harga terkunci setelah ada registrasi pertama; `capacity` selalu dapat diubah
- **`Upload`** — Vercel Blob metadata for transfer proofs, member card photos, invoice adjustment proofs, and **event settlement** proofs (`UploadPurpose.event_settlement_*`); converted to WebP before storage; `registrationHolderId` pada `Upload` mengaitkan upload `member_card_photo` ke `RegistrationHolder` spesifik (untuk klaim member regional dengan beberapa holder)
- **`EventSettlementArtifact`** — append-only bukti penutupan keuangan per acara (`venue_transfer`, `venue_receipt`, `treasurer_margin`); satu baris per unggahan dengan snapshot acuan nominal + selisih; diunggah oleh PIC acara (`Event.picAdminProfileId`) atau Owner/Admin operasional (`hasOperationalOwnerParity`)
- **`AdminProfile`** — links a Better Auth `authUserId` to an `AdminRole` (`Owner` | `Admin` | `Verifier` | `Viewer`) and optionally to a `MasterMember`; **`Admin`** mirrors **`Owner`** operationally but not committee advanced settings (`canManageCommitteeAdvancedSettings`)
- **`AdminInvitation`** — Owner-issued onboarding invite (`emailNormalized`, `role`, hashed token); consumed when the recipient completes `signUpEmail` and gets an `AdminProfile`. Existing app users without an admin profile cannot be onboarded via invite (different email or operator tooling).
- **`BoardPeriod`** / **`BoardRole`** / **`ManagementMember`** / **`BoardAssignment`** — kepengurusan (committee) structure; `recompute-directory-flags.ts` syncs `MasterMember.isManagementMember` from `BoardAssignment`
- **`ClubWaTemplate`** — per-`WaTemplateKey` body overrides stored in DB; loaded by `lib/wa-templates/load-club-wa-templates.ts` and merged with hardcoded defaults in `lib/wa-templates/render-wa-from-db.ts`
- **`ClubEmailTemplate`** — per-`EmailTemplateKey` (`invoice`, `invoice_underpayment`, `registration_approved`, `receipt`, `rejected`, `payment_issue`, `cancelled`, `refunded`, `magic_link`, `admin_invite`, `otp`) subject + `body` (JSON `{"v":1,"blocks":[...]}` dengan paragraf Tiptap); loaded by `lib/email-templates/load-club-email-templates.ts`; render via `render-email-from-blocks.ts`
- **`EmailDeliveryLog`** — append-only log pengiriman email transaksional (invoice blast / kirim tunggal); `templateKey`, `toEmail`, `success`, `actorAdminProfileId`
- **`ClubBranding`** — `clubNameNav`, logo, `contactEmail`, `websiteUrl`, `locationText`, `socialLinks` (JSON max 3); footer publik + shell email transaksional; mutations Owner-only + audit
- **`ClubOperationalSettings`** / **`ClubNotificationPreferences`** — singleton (`singletonKey = "default"`); prefs: `outboundMode` + auto-email (`emailAutoOnApprove` … `emailAutoOnRefund`, default hanya approve); read via `lib/public/load-club-*.ts`; mutations Owner-only + audit
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
- `lib/utils/idr-input.ts` — `parseIdrDigitsToInt` mengambil digit dari teks terformat Rupiah; dipakai bersama `format-idr.ts` dan `components/ui/idr-amount-input.tsx`
- `lib/audit/append-club-audit-log.ts` — `appendClubAuditLog(db, row)` — call this inside any Owner mutation that touches club-level configuration; use constants from `lib/audit/club-audit-actions.ts` for the `action` field
- `lib/actions/submit-registration.ts` — the main public Server Action; validates form (holder array schema), merges kontak Tangsel dari direktori bila form kosong, computes pricing via `computeSubmitTotal`, creates `Registration` + `RegistrationHolder[]` in one Prisma transaction, uploads payment proof; rolls back blob on failure
- `lib/actions/lookup-member-for-registration.ts` — lookup nomor member Tangsel untuk form publik; **WA/email di-mask** sebelum serialisasi ke klien
- `lib/members/resolve-master-member-registration-lookup.ts` — resolve plaintext `MasterMember` + cek duplikat registrasi (server-only; dipakai lookup + submit)
- `lib/members/mask-member-contact-display.ts` — `maskDisplayWhatsapp` / `maskDisplayEmail` (shared server + kartu profil)
- `lib/members/merge-tangsel-holder-contact.ts` — gabung field form dengan direktori saat submit Tangsel
- `lib/pricing/compute-submit-total.ts` — pure function for total calculation; accepts `SubmitPricingInput { holders: HolderInput[] }` — each holder has `memberValidation` + category prices; `grandTotal` = sum of ticket prices (menu excluded); tested in isolation
- `lib/tickets/get-event-ticket-categories.ts` — `getEventTicketCategories` (all categories + registration count, for admin) / `getActiveEventTicketCategories` (active only, for public form)
- `lib/actions/admin-ticket-categories.ts` — CRUD server actions untuk `EventTicketCategory`: `createTicketCategory`, `updateTicketCategory` (locks price after first registration), `deleteTicketCategory` (guard if registrations exist), `toggleTicketCategoryActive`
- `lib/forms/ticket-category-schema.ts` — Zod schema `ticketCategorySchema` untuk form kategori tiket; `TicketCategoryInput` type
- `lib/uploads/upload-image.ts` — converts any allowed image to WebP via Sharp, uploads to Blob with retry, saves metadata to DB
- `lib/uploads/upload-event-description-image.ts` — gambar isi deskripsi acara ke Blob (`events/{eventId}/description/{uuid}.webp`, WebP)
- `lib/uploads/delete-blobs-by-prefix.ts` — `deleteAllBlobsWithPrefix` untuk penghapusan massal Blob (paginasi `list` + `del` berkelompok)
- `lib/actions/upload-event-description-image.ts` — server action `uploadEventDescriptionImage(eventId, _prev, formData)`; `guardOwnerOrAdmin` + token HMAC di `FormData` (`file`, `token`); dipanggil dari `components/ui/rich-text-editor.tsx`
- `lib/actions/abandon-draft-event-description-images.ts` — `abandonDraftEventDescriptionImages(draftEventId, token)`; bila belum ada `Event` dengan ID draf, hapus semua blob di `events/{draftEventId}/description/`; dipanggil dari `event-admin-form.tsx` saat meninggalkan halaman **Buat acara** tanpa simpan sukses (aman di React Strict Mode + guard DB)
- `lib/permissions/guards.ts` — `canVerifyEvent(ctx, eventId)` — role-based access check (used by `guardEvent`)
- `lib/reports/queries.ts` — `getEventReport(eventId)` — parallel queries for attendance, finance (`baselineTotal`, pendapatan tiket approved, alokasi menu wajib ke venue `menuVenuePayoutApproved`, penyesuaian, refund), dan agregasi menu wajib per item (`MenuStats.byItem`)
- `lib/reports/settlement-expected-amounts.ts` — acuan nominal bukti penutupan vs `getEventReport.finance` (venue menu payout, margin bendahara v1 = tiket approved + penyesuaian lunas) + toleransi selisih
- `lib/actions/guard-event-settlement.ts` — `assertCanManageEventSettlement` (PIC acara atau Owner/Admin) dipanggil setelah `guardEvent` pada unggah bukti penutupan
- `lib/maps/map-embed-preview.ts` — `resolveMapEmbedSearchQuery`, `buildGoogleMapsEmbedSrc`, `mapEmbedPreviewCaption` untuk iframe Google Maps (`output=embed`); dipakai `components/map-embed-preview.tsx` (admin venue + halaman publik)
- `lib/actions/admin-venues.ts` — `saveVenueBasics` / `saveVenueMenu` / `saveVenueCatalog` (payload penuh, dipakai uji); unggah gambar menu venue; item terkunci pendaftar mengikuti `venueMenuItemIdsFrozenByExistingRegistrations`
- `lib/uploads/upload-venue-menu-image.ts` — helper unggah gambar menu venue ke Blob (`venues/{venueId}/menu/{menuItemId}.webp`) untuk metadata katalog menu; tidak memakai tabel `Upload`
- `lib/reports/csv.ts` — `generateRegistrationsCsv(eventId)` — CSV UTF-8 satu baris per `Registration`; kolom tiket dinamis (Tiket N ID · Holder ID · Nama · Member · Status · Harga) sesuai `ticketQty` maksimal; plus Registration ID, kategori, status, penyesuaian
- `lib/events/event-timing.ts` — helper fase/waktu pendaftaran dan gate (`isRegistrationTimeWindowOpen`, `isRegistrationOpen`, `canEditEventBeforeRegistrationClose`, `canEditEvent`, `getEventPhase`, dll.)
- `lib/events/member-access-mode.ts` — `MemberAccessMode` labels/banners, `assertHolderEligibleForMemberAccessMode`, `allowedMemberTypesForMode`, `isMemberOnlyAccessMode`
- `lib/events/event-registration-window.ts` — re-export dari `registration-window.ts` (nama modul selaras dokumen rencana)
- `lib/wa-templates/wa-template-catalog.ts` — metadata + default body + token wajib/opsional per `WaTemplateKey` (sumber seeder)
- `lib/wa-templates/wa-markdown-serializer.ts` — round-trip WA markdown ↔ Tiptap JSON
- `lib/wa-templates/wa-template-vars.ts` — `buildWaTemplateVars` dari konteks registrasi/acara
- `lib/wa-templates/wa-placeholder-extension.ts` — Tiptap inline atom `{token}` untuk editor template WA
- `lib/admin/admin-wa-templates-list-url.ts` — parse/build query indeks template WA
- `lib/wa-templates/messages.ts` — hardcoded WhatsApp message template functions (Indonesian); `lib/wa-templates/render-wa-from-db.ts` merges DB overrides (`ClubWaTemplate`) on top of these defaults before use
- `lib/wa-templates/build-registration-notify.ts` — `buildRegistrationWaNotify` / `RegistrationNotifyKind` — preview + `wa.me` href untuk dialog admin pasca-keputusan verifikasi atau reminder operasi
- `lib/email/normalize-email.ts` — `normalizeStoredEmail`, `optionalStoredEmail`, `requiredStoredEmail` (lowercase + trim)
- `lib/email-templates/email-template-catalog.ts` — metadata + default blok + token per `EmailTemplateKey`
- `lib/email-templates/build-email-template-index-rows.ts` — `buildEmailTemplateIndexRows` untuk indeks admin template email
- `lib/email-templates/email-doc-serializer.ts` — Tiptap JSON ↔ plain text; `email-doc-react.tsx` → React Email nodes
- `lib/email-templates/render-email-from-blocks.ts` — HTML + text Resend dari susunan blok
- `lib/email-templates/email-design-tokens.ts` — hex token layout email (selaras theme light)
- `lib/email-templates/emails/club-email-layout.tsx` — header band + footer kontak global dari branding
- `lib/branding/club-social-links.ts` — parse/validasi `socialLinks` JSON
- `components/branding/club-contact-display.tsx` — footer kontak terstruktur (web)
- `lib/email-templates/render-invoice-email.ts` / `render-registration-approved-email.ts` / `render-magic-link-email.ts` — wrapper runtime
- `lib/email-templates/load-club-email-templates.ts` — parse/migrasi body legacy
- `lib/email-templates/load-email-template-preview-vars.ts` — variabel pratinjau editor template email dari registrasi/acara terbaru di DB (fallback katalog)
- `lib/email-templates/email-transaction-line-items.ts` — rincian per tiket (holder, menu, harga) untuk tabel ringkasan email via `transaction_line_items_json`
- `lib/email-templates/load-registration-email-line-items.ts` — muat baris tiket registrasi untuk render email
- `components/ui/email-paragraph-editor.tsx` — Tiptap paragraf template email
- `lib/actions/admin-club-email-templates.ts` — save/reset/preview template email (Owner + audit)
- `lib/email/invoice-email-eligibility.ts` — filter registrasi eligible blast invoice (unpaid adjustment + `contactEmail`)
- `lib/email/registration-email-eligibility.ts` — eligibility per `EmailTemplateKey` (email kontak, status, underpayment untuk blast/kirim)
- `lib/email/send-registration-email.ts` — `sendRegistrationEmailByKey`, `maybeAutoSendRegistrationEmail`, `trySendReceiptEmailAfterSubmit`, pratinjau dialog
- `lib/email-templates/render-lifecycle-email.ts` — render receipt/rejected/payment_issue/cancelled/refunded dari blok DB
- `lib/email-templates/render-auth-template-email.ts` — OTP & undangan admin dari blok DB (`magic_link` tetap lewat `render-magic-link-email.ts`)
- `lib/email/send-invoice-email.ts` — kirim tagihan **kekurangan** tunggal (`invoice_underpayment`)
- `lib/email/send-registration-invoice-email.ts` — kirim tagihan **pendaftaran awal** (`invoice`)
- `lib/email/send-registration-approved-email.ts` — bukti pembayaran (`registration_approved`)
- `lib/actions/admin-registration-invoice-email.ts` — blast/kirim tunggal tagihan pendaftaran
- `lib/actions/admin-registration-lifecycle-email.ts` — pratinjau + kirim manual dari dialog komunikasi
- `lib/actions/admin-registration-approved-email.ts` — `sendRegistrationApprovedEmailToRegistration`
- `lib/actions/admin-invoice-email-blast.ts` — preview, blast batch, `sendInvoiceEmailToRegistration`
- `lib/notifications/notification-outbound-mode.ts` — resolves `NotificationOutboundMode` (`off` / `log_only` / `live`) from `ClubNotificationPreferences` to a behaviour struct
- `lib/public/club-operational-policy.ts` — `mergeGlobalRegistrationClosure` / `effectiveMaintenanceBanner` — merges per-event and global registration closure settings for the public registration page
- `lib/public/sanitize-event-description.ts` — sanitasi HTML deskripsi acara publik (tag termasuk `img` dengan `src` HTTPS host `*.public.blob.vercel-storage.com` saja, `hr`, tautan `http`/`https`/`mailto`/`tel`, dll.)
- `lib/public/description-asset-token.ts` — `signDescriptionAssetEventId` / `verifyDescriptionAssetEventId` (HMAC) untuk token unggah gambar di editor deskripsi dan penyelarisan `Event.id` pada **Buat acara**
- `lib/public/event-description-image-src.ts` — `isAllowedEventDescriptionImageSrc` untuk validasi host `src` gambar
- `lib/events/registration-window.ts` — `RegistrationNotAcceptableError`; quota counting that excludes `rejected`, `cancelled`, `refunded` statuses; kapasitas `null` atau ≤ 0 = tak terbatas (sama seperti form admin kosong)
- `lib/registrations/admin-ticket-context.ts` — `RegistrationHolderContext` type + `aggregateCrossRegistrationConflicts`; konflik nomor member lintas registrasi
- `lib/registrations/holder-data-mode.ts` — label UI + badge ringkasan (`registrantsSectionBadge`) untuk mode `all_holders` vs `primary_only`
- `lib/registrations/registration-primary-contact.ts` — `getPrimaryHolder`, `resolveRegistrationContactDisplay` (kontak UI/WA/email dari holder #1)
- `lib/actions/admin-update-primary-registrant.ts` — `updatePrimaryRegistrant` (dialog Edit pendaftar: sinkron `Registration.contact*` + holder #1; Tangsel lookup + reset `memberValidation` bila nomor member berubah)
- `lib/admin/admin-events-delete-flash.ts` — konstanta nilai query `flash` setelah redirect sukses hapus acara (`deleteAdminEvent` → indeks + toast klien)
- `lib/admin/events-index-view.ts` — parse mode kartu vs tabel (`view`), parse `q`, dan `buildAdminEventsIndexUrl` untuk query indeks acara
- `lib/admin/event-registrants-paths.ts` — `eventRegistrantsListPath` / `eventRegistrationDetailPath` untuk URL daftar & detail peserta acara
- `lib/admin/event-registrants-list-url.ts` — parse/build query daftar peserta (`tab`, `view`, `q`, `page`) + `registrationListWhere` untuk Prisma
- `lib/admin/event-registration-detail-tab.ts` — `parseRegistrationDetailTab`, `defaultRegistrationDetailTab`, `buildRegistrationDetailPath` untuk query tab halaman detail registrasi
- `lib/admin/admin-venues-index.ts` — parse `tab` / `q` / `view` / `page` indeks venue dan `buildAdminVenuesIndexUrl`
- `lib/admin/admin-members-list-url.ts` — parse `filter` / `q` / `page` direktori anggota dan `buildAdminMembersListUrl`
- `lib/admin/admin-management-members-list-url.ts` — parse `filter` / `q` / `page` daftar pengurus dan `buildAdminManagementMembersListUrl`
- `lib/admin/admin-management-roles-list-url.ts` — parse `filter` / `q` / `page` jabatan kepengurusan dan `buildAdminManagementRolesListUrl`
- `lib/admin/admin-period-assignments-list-url.ts` — parse filter/q/view/page penugasan periode dan `buildAdminPeriodAssignmentsListUrl`
- `lib/admin/admin-venue-menu-list.ts` — parse `searchParams` menu venue (`q`, `view`, `page`, `filter`) dan `buildAdminVenueMenuListUrl`
- `lib/admin/filter-venue-menu-list.ts` — `venueMenuRowMatchesSearch` / `venueMenuRowMatchesLockFilter` untuk penyaringan klien daftar item menu
- `lib/admin/events-index-view-model.ts` — tab status (`?tab=`), sort/filter agregat registrasi per acara untuk indeks admin
- `lib/admin/load-admin-events-index.ts` — `loadAdminEventsIndex` memuat acara yang boleh diverifikasi + KPI + paginasi tampilan kartu
- `lib/admin/pending-review-total-for-context.ts` — agregat registrasi `pending_review` pada acara yang boleh diverifikasi konteks admin (halaman beranda)
- `lib/admin/` — admin-domain helpers: invite crypto, email, committee invariants, nav flags, PIC bank permissions, path helpers

### UI components

- **Header halaman admin (aksi di samping judul)** — baris pertama `flex` dengan `h1` + satu kontrol utama (`shrink-0 sm:self-center`); deskripsi di baris berikutnya. Contoh: `admin-events-index-header.tsx` (Buat acara), `venues/admin-venue-menu-panel.tsx` (Tambah item di samping "Menu kanonik"). Toolbar daftar (`admin-list-toolbar`) memuat cari/filter/toggle bentuk daftar, bukan menggandakan aksi utama header kecuali memang khusus konteks toolbar.
- `src/components/ui/` — shadcn/ui primitives (auto-generated; edit with caution); tambahan: `file-field.tsx` (pemilih berkas seragam: registrasi publik, sampul acara admin, CSV anggota, bukti admin, logo komite), `idr-amount-input.tsx` (harga IDR terformat)
- `src/components/map-embed-preview.tsx` — pratinjau embed Google Maps (`output=embed`); dipakai bersama `lib/maps/map-embed-preview.ts` di admin venue dan halaman publik
- `src/components/public/` — public-facing: `RegistrationForm` (category picker + holder cards), `EventCard`; `registration-form/` subdir contains `category-picker.tsx`, `holder-card.tsx`
- `src/components/admin/` — admin-facing panels and layout; `admin-settings-breadcrumb.tsx` — breadcrumb `Pengaturan / …` di halaman pengaturan komite (`mb-3` sebelum judul); `admin-list-toolbar.tsx` + `admin-filter-select.tsx` — pola toolbar daftar (cari debounce, Select filter, toggle tabel/kartu); tabel `*-admin-table.tsx` untuk anggota, pengurus, jabatan, penugasan periode, acara, venue, peserta acara; indeks acara/venue memakai toolbar yang sama `registration-detail-panels/registration-detail-shell.tsx` + `registration-detail-header.tsx` + `registration-detail-tabs.tsx` + folder `tab-summary/` / `tab-verification/` / `tab-operations/` — halaman detail peserta (Ringkasan, Verifikasi & Komunikasi, Operasi); `registration-comms-dialog.tsx` (WA + pratinjau/kirim email); `decision-section.tsx` / `operations-tab-client.tsx` memicu dialog setelah keputusan/operasi; `registration-invoice-blast-dialog.tsx` + `invoice-email-blast-dialog.tsx` di toolbar peserta acara; memakai `AttendancePanel`, `CancelRefundPanel`, `InvoiceAdjustmentPanel`, `SendInvoiceEmailButton`, `SendRegistrationInvoiceEmailButton`; `event-settlement-proofs-panel.tsx` — bukti rekapitulasi penutupan di halaman laporan acara; `admin-list-toolbar.tsx` — toolbar daftar generik (cari debounce ke URL, toggle tabel/kartu, slot filter, opsional `endSlot`); `admin-event-registrants-toolbar.tsx` + `event-registrants-table.tsx` + `admin-event-registrants-cards-view.tsx` — daftar peserta per acara (`/admin/events/[eventId]/registrants`); `venues/admin-venue-menu-panel.tsx` — menu kanonik venue: header judul + **Tambah item**, dialog CRUD, toolbar + paginasi URL; `admin-events-index-header.tsx` — judul indeks acara + tautan Buat acara; `admin-events-index-toolbar.tsx` — cari (debounce) + status + toggle kartu/tabel untuk `/admin/events`; `admin-events-pending-review-alert.tsx` — ringkasan registrasi menunggu tinjauan (kartu & tabel); `admin-events-cards-view.tsx` — grid kartu ringkasan acara + paginasi; `admin-venues-index-header.tsx` / `admin-venues-index-toolbar.tsx` / `admin-venues-cards-view.tsx` / `admin-venues-table.tsx` — indeks `/admin/venues` (pola mirip indeks acara)

**`@base-ui/react` Dialog pattern** (not Radix UI — APIs differ): use the `render` prop, not `asChild`. To disable a trigger while a transition is pending, put `disabled` on `<DialogTrigger>`, not on the inner element:

```tsx
<DialogTrigger disabled={isPending} render={<Button variant='outline' />}>
  Open
</DialogTrigger>
```

Notable third-party UI libraries: `@tanstack/react-table` for data tables; `@tiptap/react` (`starter-kit`, `link`, `underline`, `image`, `placeholder`) untuk editor deskripsi acara; `react-day-picker` for date pickers; `@react-pdf/renderer` for PDF export (management period).

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

All monetary values are stored as integers in IDR smallest unit (i.e., whole rupiah). `computeSubmitTotal` is the single source of truth; it runs both client-side (live preview) and server-side (authoritative snapshot). **Total yang dibayar peserta** (`primaryTotal` / `partnerTotal` / `grandTotal` dan `computedTotalAtSubmit` di DB) = **nominal tiket** saja — harga tiket acara sudah diasumsikan **inklusif** menu wajib. `mandatoryMenuPriceApplied` menyimpan **harga acuan** item menu dari katalog untuk laporan alokasi venue (`menuVenuePayoutApproved`), bukan ditambahkan ke total transfer. Snapshot lama dengan `tiket + menu = computed` tetap didukung di UI admin.

Acuan bukti penutupan: `getSettlementExpectedAmounts` memakai `baselineTotalApproved − menuVenuePayoutApproved + adjustmentsPaidTotal` untuk margin bendahara (konsisten untuk snapshot lama dan baru).

### Uploads

Images are converted to WebP (max 1600px for most uploads; menu images use max 1200px, quality 80) via Sharp before being put to Vercel Blob with **`access: "public"`** so the CDN can serve them directly (`next/image` and browser fetches bill mostly to Blob storage, not through app functions). Anyone with the full blob URL can download the object—treat URLs as confidential. Paths are deterministic (e.g. `registrations/{registrationId}/{purpose}.webp`; event cover under `events/{eventId}/cover.webp`; **gambar di HTML deskripsi acara** under `events/{eventId}/description/{uuid}.webp` (unggah dari editor admin dengan token HMAC; pada **Buat acara** ID draf = `Event.id` setelah simpan; batal navigasi memicu `abandonDraftEventDescriptionImages` agar blob draf tidak tertinggal); venue menu image under `venues/{venueId}/menu/{menuItemId}.webp`). DB row is written after the blob PUT; if the DB write fails, the blob is deleted as cleanup. Objects uploaded earlier as **private** stay private until re-upload or a deliberate migration replaces them.

### Testing

Tests are co-located next to their module as `.test.ts` files, with cross-cutting unit tests in `src/tests/unit/`. Uji alur server action berat (Prisma + mock) ada di `src/lib/actions/__tests__/*.integration.test.ts`. Vitest runs in `node` environment — no browser/DOM tests. Test setup file: `src/tests/vitest.setup.ts`. Action tests (e.g. `admin-events.test.ts`) mock Prisma and blob calls; pure logic tests (e.g. `compute-submit-total.test.ts`) have no mocks.
