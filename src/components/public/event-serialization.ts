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
  venueName: string;
  startAtIso: string;
  menuMode: MenuMode;
  menuSelection: MenuSelection;
  voucherPrice: number | null;
  ticketMemberPrice: number;
  ticketNonMemberPrice: number;
  bankAccount: SerializedBankAccount;
  menuItems: SerializedEventMenuItem[];
};
