# Phone Input Component

**Date:** 2026-05-13
**Status:** Approved

## Overview

Shared `PhoneInput` component untuk dipakai di seluruh codebase (admin forms dan public registration form). Menampilkan country code dropdown + national number input dalam satu unit visual.

## Value Type

```ts
type PhoneValue = {
  countryCode: string    // dial code dengan +, misal "+62"
  countryIso: string     // ISO 3166-1 alpha-2, misal "ID"
  nationalNumber: string // angka yang user ketik, misal "81234567890"
}
```

`countryIso` disimpan bersama `countryCode` karena beberapa negara berbagi dial code yang sama (misal `+1` untuk US dan CA), sehingga validasi `isValidPhoneNumber` dari `libphonenumber-js` tetap akurat.

## Component API

```tsx
<PhoneInput
  value={PhoneValue}
  onChange={(val: PhoneValue) => void}
  disabled?: boolean
  placeholder?: string       // default "Nomor telepon"
  aria-invalid?: boolean
/>
```

Integrasi ke react-hook-form via `<Controller>`:

```tsx
<Controller
  control={control}
  name="phone"
  render={({ field }) => (
    <PhoneInput value={field.value} onChange={field.onChange} />
  )}
/>
```

## File Structure

```
src/
  components/ui/
    phone-input.tsx              # komponen utama
    phone-input-countries.ts     # static country list dari libphonenumber-js
  lib/forms/
    phone-schema.ts              # zod schema + PhoneValue type
```

## Layout Visual

Menggunakan `InputGroup` + `InputGroupAddon` + `InputGroupInput` yang sudah ada:

```
┌──────────────────────────────────┐
│ 🇮🇩 +62 │ 812-3456-7890          │
└──────────────────────────────────┘
```

- Kiri: trigger button (flag emoji + dial code) yang membuka `Popover`
- Kanan: `InputGroupInput` untuk national number
- Keduanya dalam satu `InputGroup` — satu focus ring, satu `aria-invalid` state

## Country Dropdown

- Komponen: `Popover` (sudah ada di project), bukan `Select` native
- Di dalam popover: search input + daftar negara
- Search: filter by nama negara atau dial code (misal "indo" atau "62" keduanya memunculkan Indonesia)
- Format list item: `🇮🇩  Indonesia  +62`
- ~250 negara, render semua tanpa virtual scroll (cukup ringan)
- Default: Indonesia (`ID`) saat `value` kosong/undefined
- Keyboard: arrow up/down navigasi, Enter pilih, Escape tutup

## Country Data

Generate sekali dari `libphonenumber-js`:

```ts
import { getCountries, getCountryCallingCode } from "libphonenumber-js"

// di phone-input-countries.ts
export const COUNTRIES = getCountries().map((iso) => ({
  iso,
  dialCode: `+${getCountryCallingCode(iso)}`,
  name: new Intl.DisplayNames(["id"], { type: "region" }).of(iso) ?? iso,
  flag: isoToFlag(iso),  // konversi "ID" → "🇮🇩" via regional indicator codepoints
})).sort((a, b) => a.name.localeCompare(b.name, "id"))

// helper:
function isoToFlag(iso: string) {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join("")
}
```

Nama negara ditampilkan dalam Bahasa Indonesia via `Intl.DisplayNames`.

## Validasi (Zod)

File `src/lib/forms/phone-schema.ts`:

```ts
import { isValidPhoneNumber } from "libphonenumber-js"
import { z } from "zod"

export const phoneValueSchema = z.object({
  countryCode: z.string().min(1, "Pilih kode negara"),
  countryIso: z.string().min(1),
  nationalNumber: z.string().trim().min(1, "Nomor telepon wajib diisi"),
}).refine(
  (val) => isValidPhoneNumber(val.nationalNumber, val.countryIso as CountryCode),
  { message: "Nomor telepon tidak valid", path: ["nationalNumber"] }
)

export type PhoneValue = z.infer<typeof phoneValueSchema>
```

Validasi format per-negara dijalankan oleh `isValidPhoneNumber`. Error message tetap dari zod/RHF, bukan dari component.

## Integrasi ke Form Yang Ada

Component ini tidak mengubah DB schema atau server actions yang sudah ada. Untuk field yang sudah ada (misal `whatsapp: String` di Prisma), gabungkan di server action:

```ts
whatsapp: `${input.phone.countryCode}${input.phone.nationalNumber}`
// hasil: "+6281234567890"
```

Format yang tersimpan di DB adalah keputusan per-form, bukan per-component.

## Dependencies

- `libphonenumber-js` — validasi format nomor per negara dan generate country list
