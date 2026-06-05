import type { DetailRegistration } from '@/components/admin/registration-detail-panels/shared/registration-detail-types'

type HolderLike = {
  id: string
  sortOrder: number
  holderName: string
  holderWhatsapp: string | null
  holderEmail: string | null
}

type RegistrationContactSource = {
  contactName: string
  contactWhatsapp: string
  contactEmail: string | null
  holders: HolderLike[]
}

/** Pemesan utama: holder dengan sortOrder terkecil (biasanya 1). */
export function getPrimaryHolder<T extends HolderLike>(holders: T[]): T | undefined {
  if (holders.length === 0) return undefined
  return holders.toSorted((a, b) => a.sortOrder - b.sortOrder)[0]
}

/** Kontak transaksi mengikuti pemesan (holder #1); fallback ke kolom Registration jika data lama tidak sinkron. */
export function resolveRegistrationContactDisplay(source: RegistrationContactSource) {
  const primary = getPrimaryHolder(source.holders)
  return {
    primaryHolderId: primary?.id ?? null,
    name: primary?.holderName ?? source.contactName,
    whatsapp: primary?.holderWhatsapp ?? source.contactWhatsapp,
    email: primary?.holderEmail ?? source.contactEmail,
  }
}

export function resolveDetailRegistrationContact(registration: DetailRegistration) {
  return resolveRegistrationContactDisplay(registration)
}
