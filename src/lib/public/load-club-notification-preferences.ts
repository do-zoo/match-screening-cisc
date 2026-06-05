import { cache } from 'react'

import type { NotificationOutboundMode } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'

export const CLUB_NOTIFICATION_PREFS_KEY = 'default' as const

export type ClubNotificationPrefsVm = {
  outboundMode: NotificationOutboundMode
  outboundLabel: string
  emailAutoOnSubmitReceipt: boolean
  emailAutoOnApprove: boolean
  emailAutoOnReject: boolean
  emailAutoOnPaymentIssue: boolean
  emailAutoOnCancel: boolean
  emailAutoOnRefund: boolean
  emailAttachInvoicePdf: boolean
}

export const loadClubNotificationPreferences = cache(async (): Promise<ClubNotificationPrefsVm> => {
  const row = await prisma.clubNotificationPreferences.findUnique({
    where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
  })
  return {
    outboundMode: row?.outboundMode ?? 'log_only',
    outboundLabel: row?.outboundLabel ?? '',
    emailAutoOnSubmitReceipt: row?.emailAutoOnSubmitReceipt ?? false,
    emailAutoOnApprove: row?.emailAutoOnApprove ?? true,
    emailAutoOnReject: row?.emailAutoOnReject ?? false,
    emailAutoOnPaymentIssue: row?.emailAutoOnPaymentIssue ?? false,
    emailAutoOnCancel: row?.emailAutoOnCancel ?? false,
    emailAutoOnRefund: row?.emailAutoOnRefund ?? false,
    emailAttachInvoicePdf: row?.emailAttachInvoicePdf ?? true,
  }
})
