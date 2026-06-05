import type { Metadata } from 'next'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { ClubEmailTemplatesPanel } from '@/components/admin/club-email-templates-panel'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'

export const metadata: Metadata = { title: 'Template email' }

export default async function EmailTemplatesSettingsPage() {
  const emailInitial = await loadClubEmailTemplates()

  return (
    <div className='space-y-6'>
      <div>
        <AdminSettingsBreadcrumb
          crumbs={[
            { label: 'Pengaturan', href: '/admin/settings' },
            { label: 'Template pesan', href: '/admin/settings/templates' },
            { label: 'Email' },
          ]}
        />
        <h1 className='text-2xl font-semibold tracking-tight'>Template email</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
          Subjek dan isi email transaksional (tagihan kekurangan bayar, magic link masuk admin). Placeholder{' '}
          <code className='text-xs'>{`{snake_case}`}</code> mengikuti kebijakan validasi per jenis templat.
        </p>
      </div>
      <ClubEmailTemplatesPanel initialFromDb={emailInitial} />
    </div>
  )
}
