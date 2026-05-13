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
