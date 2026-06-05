import type { Metadata } from 'next'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { ClubBrandingSettingsForm } from '@/components/admin/club-branding-settings-form'

export const metadata: Metadata = { title: 'Branding' }
import { prisma } from '@/lib/db/prisma'
import { CLUB_BRANDING_SINGLETON_KEY } from '@/lib/public/load-club-branding'

export default async function BrandingSettingsPage() {
  const row = await prisma.clubBranding.findUnique({
    where: { singletonKey: CLUB_BRANDING_SINGLETON_KEY },
  })

  return (
    <div className='space-y-6'>
      <div>
        <AdminSettingsBreadcrumb crumbs={[{ label: 'Pengaturan', href: '/admin/settings' }, { label: 'Branding' }]} />
        <h1 className='text-2xl font-semibold tracking-tight'>Branding publik</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
          Nama singkat untuk header situs pengunjung, teks footer polos opsional, dan logo (disimpan sebagai WebP publik
          sama seperti sampul acara).
        </p>
      </div>
      <ClubBrandingSettingsForm
        initialClubName={row?.clubNameNav?.trim() || 'CISC Nobar'}
        initialFooter={row?.footerPlainText ?? ''}
        logoUrl={row?.logoBlobUrl ?? null}
      />
    </div>
  )
}
