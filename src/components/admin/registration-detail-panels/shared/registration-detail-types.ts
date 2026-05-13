import type {
  AttendanceStatus,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  MemberValidation,
  RegistrationStatus,
  TicketPriceType,
  TicketRole,
  UploadPurpose,
} from "@prisma/client";

export type DetailRegistration = {
  id: string;
  createdAt: Date;
  contactName: string;
  contactWhatsapp: string;
  claimedMemberNumber: string | null;
  computedTotalAtSubmit: number;
  ticketPriceApplied: number;
  mandatoryMenuPriceApplied: number;
  mandatoryMenuItemName: string;
  relationsPrimary: { id: string; contactName: string } | null;
  relationsPartners: Array<{ id: string; contactName: string }>;
  ticketRole: TicketRole;
  ticketPriceType: TicketPriceType;
  status: RegistrationStatus;
  attendanceStatus: AttendanceStatus;
  memberValidation: MemberValidation;
  rejectionReason: string | null;
  paymentIssueReason: string | null;
  event: {
    title: string;
    venueName: string;
    kickOffAt: Date;
    ticketMemberPrice: number;
    ticketNonMemberPrice: number;
    menuItems: Array<{ id: string; name: string; price: number }>;
    bankAccount: { bankName: string; accountNumber: string; accountName: string } | null;
  };
  tickets: Array<{
    id: string;
    role: TicketRole;
    fullName: string;
    whatsapp: string | null;
    memberNumber: string | null;
    ticketPriceType: TicketPriceType;
    menuSelections: Array<{ menuItem: { name: string; price: number } }>;
  }>;
  uploads: Array<{
    id: string;
    purpose: UploadPurpose;
    blobUrl: string;
    contentType: string;
    bytes: number;
    width: number | null;
    height: number | null;
    originalFilename: string | null;
    createdAt: Date;
  }>;
  adjustments: Array<{
    id: string;
    type: InvoiceAdjustmentType;
    amount: number;
    status: InvoiceAdjustmentStatus;
    paidAt: Date | null;
    createdAt: Date;
    uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>;
  }>;
};
