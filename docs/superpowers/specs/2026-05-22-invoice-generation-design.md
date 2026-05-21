# Invoice Generation

**Date:** 2026-05-22
**Status:** Approved
**Depends on:** ticket-categories-redesign, menu-configuration

## Overview

Add an "Invoice" tab to the existing registrant detail page. The tab shows a web preview of the invoice for that registration and a button to download it as PDF. The invoice is generated on-demand from registration data already in the database — no separate invoice table needed.

## Where It Lives

Route: `admin/events/[eventId]/registrants/[registrationId]?tab=invoice`

Added as the 4th tab alongside the existing Ringkasan · Verifikasi · Operasi tabs.

Access control: same as registrant detail — `guardEvent(eventId)` (Verifier+ on assigned events, or Owner/Admin globally).

## Invoice Number

Format: `INV-{YYYY}-{registrationId.slice(-6).toUpperCase()}`

Example: `INV-2026-A3F9C2`

No separate sequence table — derived from `registrationId` (cuid). Deterministic so it can be regenerated without storing state.

## PDF Route

```
GET /api/admin/events/[eventId]/registrants/[registrationId]/invoice.pdf
```

- Auth: `requireAdminSession` + `guardEvent` check
- Generates PDF via `@react-pdf/renderer`, `renderToBuffer`
- Response: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="invoice-{invoiceNumber}.pdf"`
- No caching — always fresh from DB

## Invoice Content

### Header

- Left: **INVOICE** (large, bold) + invoice number + issued date
- Right: Club name from `ClubBranding` (name, logo if available)

### Info block (2 columns)

| Kepada | Event |
|---|---|
| Holder 1 name (primary buyer) | Event title |
| No. Member (if any) | Event date (kickOffAt) |
| Contact WA | Venue name |

### Holder table

| # | Nama Pemegang | Kategori | Status | Harga |
|---|---|---|---|---|
| 1 | Budi Santoso | Cat 1 | Member | Rp 650.000 |
| 2 | Rina Santoso | Cat 1 | Reguler | Rp 800.000 |
| — | **TOTAL** | | | **Rp 1.450.000** |

- Status badge: "Member" (blue) or "Reguler" (grey)
- Prices from `RegistrationHolder.ticketPriceApplied` (snapshot — never recalculated)
- Menu selection shown as a note per holder if `mandatoryMenuItemId` is set

### Payment info box

Bank account from `Event.bankAccountId → PicBankAccount`. Shows: bank name, account number, account holder name. If no bank account configured on event, show placeholder "Hubungi panitia untuk informasi pembayaran."

### Footer

- Registration ID (for panitia reference)
- Generated timestamp

## Web Preview (Tab UI)

The tab renders the same data as the PDF but as React/HTML — not an iframe of the PDF. Two separate renderers: one for the web preview component, one for the `@react-pdf/renderer` PDF document. They share a data-fetching layer (`getInvoiceData(registrationId)`) but render independently.

```
lib/invoices/get-invoice-data.ts   — query Registration + Holders + Event + Category + Bank
lib/invoices/invoice-pdf.tsx       — @react-pdf Document component
components/admin/invoice-tab/invoice-preview.tsx — HTML preview component
```

### Tab layout

```
[Invoice tab content]
┌─────────────────────────────────────────┐
│  Download PDF button (top right)        │
│─────────────────────────────────────────│
│                                         │
│  Invoice preview (HTML, styled to       │
│  resemble the PDF output)               │
│                                         │
└─────────────────────────────────────────┘
```

Download button: `<a href="/api/admin/.../invoice.pdf" download>Download PDF</a>` — native browser download, no JS needed.

## Data Query

`getInvoiceData(registrationId)` fetches in one Prisma query with includes:

```ts
registration {
  id, computedTotalAtSubmit, createdAt,
  event { title, kickOffAt, venue { name }, bankAccount { ... } },
  ticketCategory { name },
  holders (orderBy sortOrder asc) {
    sortOrder, holderName, claimedMemberNumber, memberValidation,
    ticketPriceApplied, mandatoryMenuItemId, mandatoryMenuItem { name }
  }
}
```

## Edge Cases

- **Registration not yet approved** — invoice still shown (draft state). Tab visible regardless of status. PDF shows current prices which may change after admin verification.
- **No holders** — should not happen (submitRegistration always creates at least 1 holder), but if it does: show empty table with total Rp 0.
- **No bank account on event** — show placeholder text (see above).
- **Club branding not set** — fall back to plain "CISC" text for the header logo.

## Out of Scope

- Sending invoice via email or WhatsApp
- Invoice list page (access is always through registrant detail)
- Invoice versioning / revision history
- Invoice status (paid/unpaid tracking separate from registration status)
