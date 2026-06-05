import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { EmailTemplateEditForm } from '@/components/admin/email-templates/email-template-edit-form'
import { getEmailTemplateEntry } from '@/lib/email-templates/email-template-catalog'
import { isEmailTemplateKey } from '@/lib/email-templates/is-email-template-key'
import { parseStoredEmailBody } from '@/lib/email-templates/parse-stored-email-body'
import { prisma } from '@/lib/db/prisma'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>
}): Promise<Metadata> {
  const { key } = await params
  if (!isEmailTemplateKey(key)) return { title: 'Edit template email' }
  return { title: `Edit — ${getEmailTemplateEntry(key).labelId}` }
}

export default async function EmailTemplateEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: keyRaw } = await params
  if (!isEmailTemplateKey(keyRaw)) notFound()

  const catalogEntry = getEmailTemplateEntry(keyRaw)
  const dbRow = await prisma.clubEmailTemplate.findUnique({
    where: { key: keyRaw },
    select: { subject: true, body: true },
  })

  const displaySubject = dbRow?.subject ?? catalogEntry.defaultSubject
  const displayBlocks = dbRow
    ? parseStoredEmailBody(keyRaw, dbRow.body)
    : catalogEntry.defaultBlocks
  const isCustomized = dbRow !== null

  return (
    <div className='pb-8'>
      <AdminSettingsBreadcrumb
        crumbs={[
          { label: 'Pengaturan', href: '/admin/settings' },
          { label: 'Template pesan', href: '/admin/settings/templates' },
          { label: 'Email', href: '/admin/settings/templates/email' },
          { label: catalogEntry.labelId },
        ]}
      />

      <EmailTemplateEditForm
        key={`${keyRaw}-${dbRow?.body ?? 'default'}`}
        templateKey={keyRaw}
        catalogEntry={catalogEntry}
        displaySubject={displaySubject}
        displayBlocks={displayBlocks}
        isCustomized={isCustomized}
      />
    </div>
  )
}
