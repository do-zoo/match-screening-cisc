import type { Metadata } from 'next'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { ClubNotificationPreferencesForm } from '@/components/admin/club-notification-preferences-form'

export const metadata: Metadata = { title: 'Notifikasi' }
import { prisma } from '@/lib/db/prisma'
import { CLUB_NOTIFICATION_PREFS_KEY } from '@/lib/public/load-club-notification-preferences'

export default async function NotificationsSettingsPage() {
  const row = await prisma.clubNotificationPreferences.findUnique({
    where: { singletonKey: CLUB_NOTIFICATION_PREFS_KEY },
  })

  return (
    <div className='space-y-6'>
      <div>
        <AdminSettingsBreadcrumb
          crumbs={[{ label: 'Pengaturan', href: '/admin/settings' }, { label: 'Notifikasi' }]}
        />
        <h1 className='text-2xl font-semibold tracking-tight'>Notifikasi</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
          Preferensi saluran keluar untuk pekerjaan operasional mendatang. Pengiriman transaksional oleh Better Auth
          (mis. tautan magic) tidak diatur di sini.
        </p>
      </div>
      <ClubNotificationPreferencesForm
        initialMode={row?.outboundMode ?? 'log_only'}
        initialLabel={row?.outboundLabel ?? ''}
        initialEmailAuto={{
          emailAutoOnSubmitReceipt: row?.emailAutoOnSubmitReceipt ?? false,
          emailAutoOnApprove: row?.emailAutoOnApprove ?? true,
          emailAutoOnReject: row?.emailAutoOnReject ?? false,
          emailAutoOnPaymentIssue: row?.emailAutoOnPaymentIssue ?? false,
          emailAutoOnCancel: row?.emailAutoOnCancel ?? false,
          emailAutoOnRefund: row?.emailAutoOnRefund ?? false,
          emailAttachInvoicePdf: row?.emailAttachInvoicePdf ?? true,
        }}
      />
    </div>
  )
}
