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
  const listRef = React.useRef<HTMLDivElement>(null)

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
    <InputGroup>
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
            <ChevronDownIcon className="size-3 opacity-50" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            className="w-64 p-0"
          >
            <div className="border-b p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari negara atau kode..."
                aria-label="Cari negara"
                className="w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    const first = listRef.current?.querySelector<HTMLElement>('[role="option"]')
                    first?.focus()
                  }
                }}
              />
            </div>
            <div
              ref={listRef}
              role="listbox"
              aria-label="Pilih negara"
              className="max-h-60 overflow-y-auto"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Negara tidak ditemukan
                </div>
              ) : (
                filtered.map((country) => (
                  <div
                    key={country.iso}
                    role="option"
                    aria-selected={selected.iso === country.iso}
                    tabIndex={0}
                    onClick={() => handleCountrySelect(country)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleCountrySelect(country)
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault()
                        const next = e.currentTarget.nextElementSibling as HTMLElement | null
                        next?.focus()
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault()
                        const prev = e.currentTarget.previousElementSibling as HTMLElement | null
                        if (prev && prev.getAttribute("role") === "option") {
                          prev.focus()
                        } else {
                          // Back to search input when ArrowUp on first item
                          listRef.current?.closest("[data-slot=popover-content]")
                            ?.querySelector<HTMLElement>("input")
                            ?.focus()
                        }
                      }
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted focus:bg-muted focus:outline-none",
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
                  </div>
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
