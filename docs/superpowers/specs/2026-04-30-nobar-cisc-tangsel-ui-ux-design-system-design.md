# Nobar CISC Tangsel — UI/UX Design System (Design)

Date: 2026-04-30  
Project: `match-screening` (Next.js)  
References:
- `docs/superpowers/specs/2026-04-29-nobar-cisc-tangsel-design.md`
- `docs/superpowers/specs/2026-04-30-nobar-cisc-tangsel-tech-stack-architecture-design.md`

## 1) Purpose

Define a single design system that covers:
- **Public (participant) surface**: event discovery + registration + upload transfer proof + receipt.
- **Admin surface**: operational inbox (verification), event CRUD, master data, reports, WA template helpers.

Primary UX constraint: flows contain **payment proof uploads** and **status review**, so the UI must optimize for **trust, clarity, and error recovery** while still enabling **fast admin operations**.

## 2) Design Direction (Locked)

### 2.1 North star
- **Direction**: **Warm Service** (friendly, trust-first, calm surfaces, clear guidance).
- **Brand**: Chelsea FC Indonesia community — **blue-first identity**.
- **Theme**: **Dual theme toggle** (light + dark are first-class).

### 2.2 Brand palette (locked inputs)
- **Primary (Chelsea Royal Blue)**: `#001489`
- **Accent (Gold Crest)**: `#DBA111` (use sparingly)

**Rules**
- Gold is **not** an error/destructive color.  
- Red is reserved for **destructive / rejected** only.

### 2.3 Typography (locked)
- **Display / Headlines**: **Fraunces** (warm editorial character; used selectively)
- **Body / UI**: **Source Sans 3** (form/table readability)
- **Mono**: **JetBrains Mono** (IDs, totals, timestamps, codes)

Usage rules:
- Fraunces for: event title, page hero heading, section headline only.
- Source Sans 3 for: everything interactive (forms, admin UI, tables).
- JetBrains Mono for: member numbers, registration IDs, currency totals, timestamps, statuses/codes.

## 3) Theme Strategy (Light + Dark)

### 3.1 Goals
- **Light**: maximize trust for payment-related flows (receipt-like clarity).
- **Dark**: reduce eye strain for admin operations, keep “Chelsea-night” feel (ink-navy, not pure black).

### 3.2 Token semantics (not exact values)
We define semantic tokens (shadcn-compatible naming):
- Surfaces: `background`, `card`, `popover`
- Text: `foreground`, `muted-foreground`
- Chrome: `border`, `input`, `ring`
- Actions: `primary`, `primary-foreground`, `secondary`, `secondary-foreground`
- States: `destructive`, `destructive-foreground`

Implementation will map these to Tailwind/shadcn CSS variables.

## 4) Status & Workflow Semantics (Admin + Public)

### 4.1 Registration statuses
Status mapping must be consistent in **badges**, **filters**, **counts**, and **reports**.

- `pending_review`: neutral / blue-gray (informational, queued)
- `payment_issue`: amber (needs follow-up, not “failed”)
- `approved`: green (success)
- `rejected`: red (destructive; reason required)
- `cancelled`: neutral gray (final, non-destructive)
- `refunded`: muted purple/indigo (finance semantic; visually distinct)

### 4.2 Attendance statuses
- `attended`: green/teal (positive confirmation)
- `no_show`: gray/stone (avoid red; not a “failure” state)

### 4.3 Action semantics
Buttons and actions follow predictable intent:
- **Primary CTA** (public): submit / save → **Primary Blue**
- **Approve**: success (green) variant (not primary)
- **Payment issue**: warning (amber) variant (not destructive)
- **Reject / delete / refund**: destructive (red) variant + confirmation

Gold usage: highlight/count/section-marker only (never “approve/reject”).

## 5) Layout, Density, and Composition

### 5.1 Spacing system
- Base rhythm: **8px scale** (8/16/24/32/48)
- One density per screen:
  - Public: comfortable (more breathing room)
  - Admin: compact-but-readable (no cramped tap targets)

### 5.2 Container widths
- Public forms: single-column, readable measure; avoid edge-to-edge paragraphs on desktop.
- Admin tables: allow density but enforce truncation rules (`min-w-0` in flex rows; `truncate/line-clamp` where needed).

### 5.3 Radius and elevation
- Radius: medium for “warm service” feel (cards/forms).
- Use borders as primary separation; shadows reserved for overlays (dialog/popover/sheet).

## 6) Component System (shadcn)

### 6.1 Must-have components (MVP)
- Inputs: `Button`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`
- Structure: `Card`, `Separator`, `Tabs`, `Breadcrumb`
- Feedback: `Alert`, `Toast/Sonner`, `Skeleton`
- Overlays: `Dialog`, `Sheet`, `Popover`, `Tooltip`
- Data: `Table`, `DropdownMenu`, `Badge`, (optional) `Pagination`

### 6.2 Composition recipes (high-level)
- **Participant registration**: hero/event summary → form sections (contact, member claim, partner, upload, menu/voucher) → price breakdown card → submit + receipt state.
- **Admin inbox**: filters + count chips → table/list rows → detail drawer/page → action strip (approve/payment issue/reject) → WA template shortcuts.
- **Settings/Master data**: `Tabs` + `Card` groups, single primary save action.

## 7) Accent Layer (reactbits.dev)

Reactbits is used only where it increases clarity/brand without harming operations:
- Public landing/event header: subtle background texture/mesh or gentle motion.
- Highlights: gold “crest” stripes, count emphasis, micro-interaction on primary CTA hover/focus.

Do not use reactbits for:
- Data-dense tables/inbox rows
- Critical form validation states
- Heavy/continuous animations

## 8) Accessibility & Interaction (Web Interface Guidelines aligned)

This system follows Vercel Web Interface Guidelines as constraints (selected highlights):

- **Semantics**: use `<button>` for actions, `<a>/<Link>` for navigation.
- **Icon buttons**: always include `aria-label`; decorative icons are `aria-hidden="true"`.
- **Forms**:
  - visible labels (`htmlFor`), meaningful `name`, correct `type` + `autocomplete`
  - errors inline near fields; focus first error on submit
  - show loading “Saving…/Loading…” (ellipsis char `…`), and keep submit enabled until request starts
- **Focus**: visible `:focus-visible` rings; never remove outline without replacement.
- **Motion**: respect `prefers-reduced-motion`; avoid `transition: all`; animate transform/opacity only.
- **Long text**: ensure truncation/wrapping (`min-w-0`, `break-words`, `truncate`).
- **Destructive actions**: require confirmation modal or undo window.

## 9) Form UX: Upload Transfer Proof (Critical)

### 9.1 Progressive disclosure
Default flow:
1) user completes identity/contact  
2) user uploads transfer proof  
3) UI shows computed total breakdown (locked snapshot)  
4) user submits and sees receipt + `pending_review`

### 9.2 Upload affordances
- Mobile-friendly (camera/gallery)
- Preview thumbnail + replace/remove
- Clear constraints: allowed format, max size, and a short “what counts as valid proof”
- Retry path for upload failures; errors include the next action (retry/choose different file/compress)

## 10) Quality Bar (Do / Don’t)

### Do
- Primary CTA uses Chelsea Blue `#001489`
- Gold `#DBA111` only for highlights/counts
- Status colors are consistent everywhere (badges, filters, reports)
- Use tabular numbers for totals (mono or `tabular-nums`) to avoid jitter

### Don’t
- Use gold as destructive/error
- Use continuous/heavy motion in admin
- Rely on color alone for meaning (always pair with text/icon)

## 11) Cross-check notes (ui-ux-pro-max)

The `ui-ux-pro-max` generator strongly recommends:
- **Data-dense dashboard** style for admin ops (fits the inbox/reports surfaces)
- Full light+dark support

We intentionally override its default color/font suggestions to match:
- Chelsea blue-first branding
- Warm Service trust-first UX
- Fraunces/Source Sans 3/JetBrains Mono typography system

