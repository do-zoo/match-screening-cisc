# Phone Input Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared `PhoneInput` component dengan country code dropdown (+250 negara) yang bekerja dengan react-hook-form via `<Controller>`, menyimpan `{ countryCode, countryIso, nationalNumber }`.

**Architecture:** Tiga unit terpisah — (1) static country list dari `libphonenumber-js`, (2) zod schema + `PhoneValue` type, (3) `PhoneInput` React component yang menggabungkan keduanya. Component menggunakan `InputGroup` + `Popover` yang sudah ada di project, fully controlled via `value`/`onChange` props.

**Tech Stack:** `libphonenumber-js`, `zod` v4, `react-hook-form` v7, `@base-ui/react` Popover, shadcn InputGroup primitives, Vitest (node env)

---

## File Map

| File | Status | Tanggung Jawab |
|------|--------|----------------|
| `src/components/ui/phone-input-countries.ts` | Create | Static country list: `{ iso, dialCode, name, flag }[]` |
| `src/lib/forms/phone-schema.ts` | Create | `PhoneValue` type + `phoneValueSchema` zod schema |
| `src/components/ui/phone-input.tsx` | Create | `PhoneInput` React component (UI + country search) |
| `src/tests/unit/phone-schema.test.ts` | Create | Unit tests untuk zod schema |
| `src/tests/unit/phone-input-countries.test.ts` | Create | Unit tests untuk country list |

---

## Task 1: Install `libphonenumber-js`

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install package**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /path/to/match-screening && nvm use
pnpm add libphonenumber-js
```

Expected output: `+ libphonenumber-js@...` — verifikasi versi 1.11+

- [ ] **Step 2: Verify install**

```bash
node -e "const { getCountries } = require('libphonenumber-js'); console.log(getCountries().length)"
```

Expected output: angka >= 240

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): install libphonenumber-js"
```

---

## Task 2: Country Data

**Files:**
- Create: `src/components/ui/phone-input-countries.ts`
- Create: `src/tests/unit/phone-input-countries.test.ts`

- [ ] **Step 1: Write failing test**

Buat file `src/tests/unit/phone-input-countries.test.ts`:

```ts
import { describe, expect, test } from "vitest"
import { COUNTRIES, isoToFlag } from "@/components/ui/phone-input-countries"

describe("phone-input-countries", () => {
  test("isoToFlag converts ISO to flag emoji", () => {
    expect(isoToFlag("ID")).toBe("🇮🇩")
    expect(isoToFlag("SG")).toBe("🇸🇬")
    expect(isoToFlag("US")).toBe("🇺🇸")
  })

  test("COUNTRIES contains Indonesia with correct data", () => {
    const id = COUNTRIES.find((c) => c.iso === "ID")
    expect(id).toBeDefined()
    expect(id!.dialCode).toBe("+62")
    expect(id!.flag).toBe("🇮🇩")
    expect(id!.name).toBeTruthy()
  })

  test("COUNTRIES has 200+ entries", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200)
  })

  test("every entry has required fields", () => {
    for (const c of COUNTRIES) {
      expect(c.iso).toBeTruthy()
      expect(c.dialCode).toMatch(/^\+\d+$/)
      expect(c.flag).toBeTruthy()
      expect(c.name).toBeTruthy()
    }
  })

  test("COUNTRIES is sorted by name", () => {
    const names = COUNTRIES.map((c) => c.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "id"))
    expect(names).toEqual(sorted)
  })
})
```

- [ ] **Step 2: Run test — verify fails**

```bash
pnpm vitest run src/tests/unit/phone-input-countries.test.ts
```

Expected: FAIL dengan "Cannot find module"

- [ ] **Step 3: Implement country data file**

Buat file `src/components/ui/phone-input-countries.ts`:

```ts
import { getCountries, getCountryCallingCode } from "libphonenumber-js"

export type CountryEntry = {
  iso: string
  dialCode: string
  name: string
  flag: string
}

export function isoToFlag(iso: string): string {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("")
}

const displayNames = new Intl.DisplayNames(["id"], { type: "region" })

export const COUNTRIES: CountryEntry[] = getCountries()
  .map((iso) => ({
    iso,
    dialCode: `+${getCountryCallingCode(iso)}`,
    name: displayNames.of(iso) ?? iso,
    flag: isoToFlag(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "id"))
```

- [ ] **Step 4: Run test — verify passes**

```bash
pnpm vitest run src/tests/unit/phone-input-countries.test.ts
```

Expected: PASS semua 5 test

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/phone-input-countries.ts src/tests/unit/phone-input-countries.test.ts
git commit -m "feat(ui): phone input country list dari libphonenumber-js"
```

---

## Task 3: Zod Schema

**Files:**
- Create: `src/lib/forms/phone-schema.ts`
- Create: `src/tests/unit/phone-schema.test.ts`

- [ ] **Step 1: Write failing test**

Buat file `src/tests/unit/phone-schema.test.ts`:

```ts
import { describe, expect, test } from "vitest"
import { phoneValueSchema } from "@/lib/forms/phone-schema"

describe("phoneValueSchema", () => {
  test("valid Indonesian number passes", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(true)
  })

  test("valid Singapore number passes", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+65",
      countryIso: "SG",
      nationalNumber: "91234567",
    })
    expect(result.success).toBe(true)
  })

  test("empty nationalNumber fails with required message", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon wajib diisi")
  })

  test("invalid number format fails with invalid message", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "ID",
      nationalNumber: "123",
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const msgs = result.error.issues.map((i) => i.message)
    expect(msgs).toContain("Nomor telepon tidak valid")
  })

  test("empty countryCode fails", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "",
      countryIso: "ID",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(false)
  })

  test("missing countryIso fails", () => {
    const result = phoneValueSchema.safeParse({
      countryCode: "+62",
      countryIso: "",
      nationalNumber: "81234567890",
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — verify fails**

```bash
pnpm vitest run src/tests/unit/phone-schema.test.ts
```

Expected: FAIL dengan "Cannot find module"

- [ ] **Step 3: Implement schema**

Buat file `src/lib/forms/phone-schema.ts`:

```ts
import { isValidPhoneNumber, type CountryCode } from "libphonenumber-js"
import { z } from "zod"

export const phoneValueSchema = z
  .object({
    countryCode: z.string().min(1, "Pilih kode negara"),
    countryIso: z.string().min(1, "Pilih kode negara"),
    nationalNumber: z.string().trim().min(1, "Nomor telepon wajib diisi"),
  })
  .superRefine((val, ctx) => {
    if (!val.nationalNumber.trim()) return
    try {
      const valid = isValidPhoneNumber(
        val.nationalNumber,
        val.countryIso as CountryCode
      )
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nomor telepon tidak valid",
          path: ["nationalNumber"],
        })
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nomor telepon tidak valid",
        path: ["nationalNumber"],
      })
    }
  })

export type PhoneValue = z.infer<typeof phoneValueSchema>
```

- [ ] **Step 4: Run test — verify passes**

```bash
pnpm vitest run src/tests/unit/phone-schema.test.ts
```

Expected: PASS semua 6 test

- [ ] **Step 5: Commit**

```bash
git add src/lib/forms/phone-schema.ts src/tests/unit/phone-schema.test.ts
git commit -m "feat(forms): phone value zod schema + PhoneValue type"
```

---

## Task 4: PhoneInput Component

**Files:**
- Create: `src/components/ui/phone-input.tsx`

> Note: Vitest berjalan di `node` environment tanpa DOM — React component tidak bisa ditest di sini. Correctness dijamin oleh type safety + schema tests di Task 3.

- [ ] **Step 1: Buat component**

Buat file `src/components/ui/phone-input.tsx`:

```tsx
"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  COUNTRIES,
  type CountryEntry,
} from "@/components/ui/phone-input-countries"
import type { PhoneValue } from "@/lib/forms/phone-schema"

const DEFAULT_COUNTRY: CountryEntry = COUNTRIES.find((c) => c.iso === "ID")!

interface PhoneInputProps {
  value?: PhoneValue | null
  onChange?: (val: PhoneValue) => void
  disabled?: boolean
  placeholder?: string
  "aria-invalid"?: boolean
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Nomor telepon",
  "aria-invalid": ariaInvalid,
}: PhoneInputProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)

  const selected: CountryEntry =
    COUNTRIES.find((c) => c.iso === value?.countryIso) ?? DEFAULT_COUNTRY

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.iso.toLowerCase().includes(q)
    )
  }, [search])

  function handleCountrySelect(country: CountryEntry) {
    onChange?.({
      countryCode: country.dialCode,
      countryIso: country.iso,
      nationalNumber: value?.nationalNumber ?? "",
    })
    setOpen(false)
    setSearch("")
  }

  function handleNationalNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.({
      countryCode: selected.dialCode,
      countryIso: selected.iso,
      nationalNumber: e.target.value,
    })
  }

  return (
    <InputGroup aria-invalid={ariaInvalid}>
      <InputGroupAddon align="inline-start" className="p-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled}
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-full gap-1 rounded-r-none border-r border-input px-2 font-mono text-xs"
              />
            }
          >
            <span>{selected.flag}</span>
            <span>{selected.dialCode}</span>
            <ChevronDownIcon className="size-3 opacity-50" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            className="w-64 p-0"
          >
            <div className="border-b p-2">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari negara atau kode..."
                className="w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Negara tidak ditemukan
                </div>
              ) : (
                filtered.map((country) => (
                  <button
                    key={country.iso}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted",
                      selected.iso === country.iso && "bg-muted font-medium"
                    )}
                  >
                    <span className="shrink-0">{country.flag}</span>
                    <span className="flex-1 truncate text-left">
                      {country.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {country.dialCode}
                    </span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
      <InputGroupInput
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        value={value?.nationalNumber ?? ""}
        onChange={handleNationalNumberChange}
        aria-invalid={ariaInvalid}
      />
    </InputGroup>
  )
}
```

- [ ] **Step 2: Run lint & type check**

```bash
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /path/to/match-screening && nvm use
pnpm lint
```

Perbaiki error yang muncul sebelum lanjut.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: semua test pass (termasuk Task 2 & 3)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/phone-input.tsx
git commit -m "feat(ui): PhoneInput component dengan country dropdown"
```

---

## Task 5: Contoh Integrasi ke Form

> Task ini menunjukkan cara pakai — tidak mengubah schema DB atau server action yang ada. Ini contoh minimal untuk verifikasi end-to-end di browser.

**Files:**
- Tidak ada file baru — ini hanya panduan cara pakai

**Cara pakai dengan react-hook-form:**

```tsx
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PhoneInput } from "@/components/ui/phone-input"
import { phoneValueSchema, type PhoneValue } from "@/lib/forms/phone-schema"

const schema = z.object({
  phone: phoneValueSchema,
})

type FormValues = z.infer<typeof schema>

export function ExampleForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: { countryCode: "+62", countryIso: "ID", nationalNumber: "" },
    },
  })

  return (
    <form onSubmit={form.handleSubmit(console.log)}>
      <Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneInput
            value={field.value}
            onChange={field.onChange}
            aria-invalid={Boolean(fieldState.error)}
          />
        )}
      />
      {form.formState.errors.phone?.nationalNumber?.message && (
        <p className="text-sm text-destructive">
          {form.formState.errors.phone.nationalNumber.message}
        </p>
      )}
    </form>
  )
}
```

**Untuk form yang sudah ada** (misal field `whatsapp: String` di DB):
Di server action, gabungkan:
```ts
whatsapp: `${input.phone.countryCode}${input.phone.nationalNumber}`
// contoh hasil: "+6281234567890"
```

- [ ] **Step 1: Verifikasi manual di browser**

Jalankan dev server dan buka halaman yang menggunakan `PhoneInput`. Cek:
- Default country Indonesia (+62) tampil
- Klik flag/dial code membuka popover
- Search "sing" memunculkan Singapore
- Pilih negara lain → dial code terupdate, nationalNumber tetap
- Ketik nomor → value berubah
- Form submit dengan nomor valid → tidak ada error
- Form submit dengan nomor terlalu pendek → muncul error "Nomor telepon tidak valid"

```bash
pnpm dev
```

---

## Checklist Self-Review

- [x] **Country data** — Task 2 cover `COUNTRIES` + `isoToFlag`, sort by name, Intl.DisplayNames ID
- [x] **PhoneValue type** — didefinisikan di Task 3, dipakai konsisten di Task 4
- [x] **Zod schema** — Task 3 cover valid + invalid + empty cases
- [x] **Component API** — `value`, `onChange`, `disabled`, `placeholder`, `aria-invalid`
- [x] **Default Indonesia** — `DEFAULT_COUNTRY` di Task 4 fallback ke `ID`
- [x] **Country search** — filter by name, dialCode, iso di `filtered` useMemo
- [x] **Popover close on select** — `setOpen(false)` di `handleCountrySelect`
- [x] **RHF integration** — Task 5 menunjukkan pola `<Controller>`
- [x] **Type consistency** — `PhoneValue` konsisten dari Task 3 → Task 4 → Task 5
