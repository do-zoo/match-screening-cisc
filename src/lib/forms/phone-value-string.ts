import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

import type { PhoneValue } from '@/lib/forms/phone-schema'

const DEFAULT_COUNTRY: CountryCode = 'ID'

export const EMPTY_PHONE_VALUE: PhoneValue = {
  countryCode: '+62',
  countryIso: 'ID',
  nationalNumber: '',
}

/**
 * Maps stored string (e.g. from DB, FormData, or prefilled directory)
 * to `PhoneValue` for `PhoneInput`.
 */
export function stringToPhoneValue(raw: string): PhoneValue {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ...EMPTY_PHONE_VALUE }
  }

  // Stored strings from phoneValueToStoredString are digits-only (e.g. "628123456789").
  // parsePhoneNumberFromString("628...", "ID") incorrectly returns the full stored string
  // as nationalNumber for sub-10-digit numbers. Prepending "+" forces E.164 parsing,
  // which correctly strips the country calling code digits.
  const isStoredFormat = /^\d+$/.test(trimmed)
  const parsed = isStoredFormat
    ? parsePhoneNumberFromString(`+${trimmed}`)
    : (parsePhoneNumberFromString(trimmed) ?? parsePhoneNumberFromString(trimmed, DEFAULT_COUNTRY))

  if (parsed) {
    return {
      countryCode: `+${parsed.countryCallingCode}`,
      countryIso: parsed.country ?? DEFAULT_COUNTRY,
      nationalNumber: parsed.nationalNumber,
    }
  }

  const d = trimmed.replace(/\D/g, '')
  if (d.startsWith('62') && d.length > 2) {
    return {
      countryCode: '+62',
      countryIso: 'ID',
      nationalNumber: d.slice(2),
    }
  }
  if (d.startsWith('0')) {
    return {
      countryCode: '+62',
      countryIso: 'ID',
      nationalNumber: d.slice(1),
    }
  }
  return {
    ...EMPTY_PHONE_VALUE,
    nationalNumber: d,
  }
}

export function phoneValueToStoredString(val: PhoneValue): string {
  const cc = val.countryCode.replace(/\D/g, '')
  const nat = val.nationalNumber.replace(/\D/g, '')
  if (!nat) return ''
  return `${cc}${nat}`
}

export function whatsappDigitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

export function toE164PlusForValidation(storedOrRaw: string): string | null {
  const digits = whatsappDigitsOnly(phoneValueToStoredString(stringToPhoneValue(storedOrRaw)))
  if (digits.length < 8) return null
  return `+${digits}`
}
