import type { Metadata } from 'next'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { ClubBrandingSettingsForm } from '@/components/admin/club-branding-settings-form'
import { parseClubSocialLinks } from '@/lib/branding/club-social-links'
import { prisma } from '@/lib/db/prisma'
import { CLUB_BRANDING_SINGLETON_KEY } from '@/lib/public/load-club-branding'

export const metadata: Metadata = { title: 'Branding' }

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
          Nama dan logo untuk header situs, serta kontak footer yang dipakai di halaman publik dan email transaksional.
        </p>
      </div>
      <ClubBrandingSettingsForm
        initialClubName={row?.clubNameNav?.trim() || 'CISC Nobar'}
        initialContactEmail={row?.contactEmail ?? ''}
        initialWebsiteUrl={row?.websiteUrl ?? ''}
        initialLocationText={row?.locationText ?? ''}
        initialSocialLinks={parseClubSocialLinks(row?.socialLinks)}
        logoUrl={row?.logoBlobUrl ?? null}
      />
    </div>
  )
}
