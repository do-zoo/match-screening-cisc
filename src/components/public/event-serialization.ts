export type SerializedEventMenuItem = {
  id: string
  name: string
  description: string | null
  imageBlobUrl: string | null
  price: number
}

export type SerializedBankAccount = {
  bankName: string
  accountNumber: string
  accountName: string
}

export type SerializedTicketCategory = {
  id: string
  name: string
  regularPrice: number
  memberPrice: number
  maxQtyPerPerson: number | null
}

export type SerializedEventForRegistration = {
  id: string
  slug: string
  title: string
  summary: string
  descriptionHtml: string
  coverBlobUrl: string
  venueName: string
  venueAddress: string
  venueMapUrl: string | null
  openRegistrationAtIso: string
  closeRegistrationAtIso: string
  openGateAtIso: string
  kickOffAtIso: string
  registrationOpen: boolean
  registrationClosedMessage: string | null
  mandatoryMenuItemIds: string[]
  ticketCategories: SerializedTicketCategory[]
  menuRequired: boolean
  bankAccount: SerializedBankAccount
  /** Semua item menu acara (dari `EventVenueMenuItem`). */
  menuItems: SerializedEventMenuItem[]
  /** Item menu acara (`EventVenueMenuItem`) yang menjadi pilihan menu wajib. */
  mandatoryMenuItems: SerializedEventMenuItem[]
  /** Jika false, form publik hanya tampilkan 1 holder card (pemesan utama). */
  requireAllHolderData: boolean
}
