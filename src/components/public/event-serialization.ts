export type SerializedEventMenuItem = {
  id: string;
  name: string;
  description: string | null;
  imageBlobUrl: string | null;
  price: number;
};

export type SerializedBankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type SerializedEventForRegistration = {
  slug: string;
  title: string;
  summary: string;
  descriptionHtml: string;
  coverBlobUrl: string;
  venueName: string;
  openRegistrationAtIso: string;
  closeRegistrationAtIso: string;
  openGateAtIso: string;
  kickOffAtIso: string;
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
  mandatoryMenuItemIds: string[];
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  bankAccount: SerializedBankAccount;
  /** Semua item menu acara (dari `EventVenueMenuItem`). */
  menuItems: SerializedEventMenuItem[];
  /** Item menu acara (`EventVenueMenuItem`) yang menjadi pilihan menu wajib. */
  mandatoryMenuItems: SerializedEventMenuItem[];
};
