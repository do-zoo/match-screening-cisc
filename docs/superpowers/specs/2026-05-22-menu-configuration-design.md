# Menu Configuration

**Date:** 2026-05-22
**Status:** Approved
**Depends on:** ticket-categories-redesign
**Blocks:** invoice-generation

## Overview

Make menu selection configurable per event. Currently menu selection is always mandatory (one item from `mandatoryMenuItemIds`). With this change, admin can toggle whether menu is required and set a minimum number of selections. `RegistrationHolder.mandatoryMenuItemId` becomes nullable when menu is not required.

## Data Model

### `Event` — new fields

```prisma
menuRequired       Boolean @default(true)   // true = registrant must pick menu
menuMinSelections  Int     @default(1)       // minimum menu items per holder when menuRequired = true
```

`mandatoryMenuItemIds` on `Event` (the existing array of fixed mandatory item IDs) is **removed** — replaced by the new settings. Available menu items are determined by `EventVenueMenuItem` rows as before; the new settings only control whether selection is required.

### `RegistrationHolder` — menu fields (from ticket-categories-redesign spec)

```prisma
mandatoryMenuItemId       String?   // null allowed when menuRequired = false
mandatoryMenuPriceApplied Int?      // null when no menu selected
```

## Admin Event Editor — Venue & Menu Tab

Combines venue selection and menu configuration in one tab (merged from two tabs).

### Layout

**Venue**

- Dropdown/search to select venue (existing behaviour)
- Map preview (existing)

**Menu**

- Toggle: `menuRequired` — "Pilihan menu wajib diisi"
  - When OFF: menu section hidden on public form; `mandatoryMenuItemId` stored as null on all holders
- Number input: `menuMinSelections` (visible only when `menuRequired = true`)
  - Label: "Minimum pilihan menu per peserta"
  - Default: 1, min: 1
- Menu item list from `EventVenueMenuItem` (existing admin-venue-menu-panel pattern)

### Guard

After the first registration exists: `menuRequired` and `menuMinSelections` are locked (same guard pattern as category price lock in ticket-categories-redesign).

## Public Registration Form

Within each expandable holder card (from ticket-categories-redesign spec):

- If `menuRequired = false`: no menu field shown for any holder
- If `menuRequired = true`: show menu selector per holder
  - Minimum `menuMinSelections` items must be chosen before card is considered complete
  - If only 1 menu item available for the event, auto-select it (no choice needed)

Currently `Registration` stores a single `mandatoryMenuItemId` per row. With `RegistrationHolder`, each holder gets their own menu selection — `menuMinSelections` controls how many they must pick. For `menuMinSelections = 1`, the UX is a radio group (single select). For `menuMinSelections > 1`, it becomes a checkbox group with a minimum count enforced.

## Pricing

`mandatoryMenuPriceApplied` on `RegistrationHolder` stores the snapshot price of the selected item(s). When `menuRequired = false`, this is null and not added to `computedTotalAtSubmit` (menu price is a reporting artifact for venue payout, not a separate charge to the registrant — consistent with current system behaviour).

## Out of Scope

- Different menu options per ticket category
- Menu quota / sold-out tracking
- Menu changes after approval
