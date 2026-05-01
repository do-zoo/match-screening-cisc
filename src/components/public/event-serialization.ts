import type { MenuMode, MenuSelection } from "@prisma/client";

export type SerializedEventMenuItem = {
  id: string;
  name: string;
  price: number;
  voucherEligible: boolean;
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
  startAtIso: string;
  endAtIso: string;
  registrationOpen: boolean;
  registrationClosedMessage: string | null;
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  voucherPrice: number | null;
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  bankAccount: SerializedBankAccount;
  menuItems: SerializedEventMenuItem[];
};
