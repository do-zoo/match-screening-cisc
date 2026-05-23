import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

export type CountryEntry = {
  iso: string
  dialCode: string
  name: string
  flag: string
}

export function isoToFlag(iso: string): string {
  return [...iso.toUpperCase()].map(c => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join('')
}

const displayNames = new Intl.DisplayNames(['id'], { type: 'region' })

export const COUNTRIES: CountryEntry[] = getCountries()
  .map(iso => ({
    iso,
    dialCode: `+${getCountryCallingCode(iso)}`,
    name: displayNames.of(iso) ?? iso,
    flag: isoToFlag(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'id'))
