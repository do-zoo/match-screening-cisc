import type { Metadata } from 'next'
import Link from 'next/link'

import { SettingsTemplatesTabs } from '@/components/admin/settings-templates-tabs'
import { prisma } from '@/lib/db/prisma'
import { loadClubEmailTemplates } from '@/lib/email-templates/load-club-email-templates'
import type { WaTemplateKey } from '@prisma/client'

export const metadata: Metadata = { title: 'Template pesan' }

export default async function TemplatesSettingsPage() {
  const [waRows, emailFromDb] = await Promise.all([
    prisma.clubWaTemplate.findMany({ select: { key: true, body: true } }),
    loadClubEmailTemplates(),
  ])

  const waInitial: Partial<Record<WaTemplateKey, string>> = {}
  for (const row of waRows) {
    waInitial[row.key as WaTemplateKey] = row.body
  }

  return (
    <div className='space-y-6'>
      <div>
        <p className='text-muted-foreground text-sm'>
          <Link href='/admin/settings' className='underline underline-offset-4'>
            Pengaturan
          </Link>
          {' / '}
          <span>Template pesan</span>
        </p>
        <h1 className='text-2xl font-semibold tracking-tight'>Template pesan</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>
          Atur teks WhatsApp untuk tautan admin dan subjek/isi email untuk tagihan kekurangan bayar serta magic link
          masuk.
        </p>
      </div>
      <SettingsTemplatesTabs waInitial={waInitial} emailInitial={emailFromDb} />
    </div>
  )
}
