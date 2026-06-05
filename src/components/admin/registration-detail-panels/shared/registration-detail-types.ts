import type {
  AttendanceStatus,
  HolderDataMode,
  InvoiceAdjustmentStatus,
  InvoiceAdjustmentType,
  MemberType,
  MemberValidation,
  RegistrationStatus,
  UploadPurpose,
} from '@prisma/client'

export type DetailRegistration = {
  id: string
  createdAt: Date
  contactName: string
  contactWhatsapp: string
  contactEmail: string | null
  computedTotalAtSubmit: number
  status: RegistrationStatus
  attendanceStatus: AttendanceStatus
  rejectionReason: string | null
  paymentIssueReason: string | null
  ticketQty: number
  holderDataMode: HolderDataMode
  ticketCategory: {
    id: string
    name: string
    regularPrice: number
    memberPrice: number
  }
  holders: Array<{
    id: string
    sortOrder: number
    holderName: string
    holderEmail: string | null
    claimedMemberNumber: string | null
    memberValidation: MemberValidation
    memberType: MemberType | null
  }>
  tickets: Array<{
    id: string
    sortOrder: number
    ticketPriceApplied: number
    menuItemName: string | null
    assignedHolderId: string
  }>
  event: {
    id: string
    title: string
    venueName: string
    kickOffAt: Date
    menuItems: Array<{ id: string; name: string; price: number }>
    bankAccount: { bankName: string; accountNumber: string; accountName: string } | null
  }
  uploads: Array<{
    id: string
    purpose: UploadPurpose
    blobUrl: string
    contentType: string
    bytes: number
    width: number | null
    height: number | null
    originalFilename: string | null
    createdAt: Date
    registrationHolderId: string | null
  }>
  adjustments: Array<{
    id: string
    type: InvoiceAdjustmentType
    amount: number
    status: InvoiceAdjustmentStatus
    paidAt: Date | null
    createdAt: Date
    uploads: Array<{ id: string; blobUrl: string; bytes: number; createdAt: Date }>
  }>
}
