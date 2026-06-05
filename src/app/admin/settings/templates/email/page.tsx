import type { Metadata } from 'next'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { EmailTemplatesTable } from '@/components/admin/email-templates/email-templates-table'
import { buildEmailTemplateIndexRows } from '@/lib/email-templates/build-email-template-index-rows'
import { EMAIL_TEMPLATE_KEYS_ORDERED } from '@/lib/email-templates/email-template-catalog'
import { prisma } from '@/lib/db/prisma'
import type { EmailTemplateKey } from '@prisma/client'

export const metadata: Metadata = { title: 'Template email' }

export default async function EmailTemplatesSettingsPage() {
  const rows = await prisma.clubEmailTemplate.findMany({
    select: { key: true, updatedAt: true },
  })

  const customizedKeys = new Set(rows.map(r => r.key as EmailTemplateKey))
  const updatedAtByKey: Partial<Record<EmailTemplateKey, Date>> = {}
  for (const row of rows) {
    updatedAtByKey[row.key as EmailTemplateKey] = row.updatedAt
  }

  const indexRows = buildEmailTemplateIndexRows(customizedKeys, updatedAtByKey)

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
          Subjek dan susunan blok email transaksional (tagihan registrasi, tagihan kekurangan bayar, konfirmasi
          pembayaran, magic link masuk admin). Paragraf memakai placeholder <code className='text-xs'>{`{snake_case}`}</code>{' '}
          dan editor Tiptap.
        </p>
      </div>

      <EmailTemplatesTable rows={indexRows} />

      <p className='text-muted-foreground text-xs'>
        {EMAIL_TEMPLATE_KEYS_ORDERED.length} template — klik Edit untuk mengubah susunan blok dan pratinjau HTML.
      </p>
    </div>
  )
}
