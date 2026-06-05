import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { WaTemplateEditForm } from '@/components/admin/wa-templates/wa-template-edit-form'
import { prisma } from '@/lib/db/prisma'
import { getWaTemplateEntry, isWaTemplateKey } from '@/lib/wa-templates/wa-template-catalog'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>
}): Promise<Metadata> {
  const { key } = await params
  if (!isWaTemplateKey(key)) return { title: 'Edit template' }
  return { title: `Edit — ${getWaTemplateEntry(key).labelId}` }
}

export default async function WhatsappTemplateEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: keyRaw } = await params
  if (!isWaTemplateKey(keyRaw)) notFound()

  const catalogEntry = getWaTemplateEntry(keyRaw)
  const dbRow = await prisma.clubWaTemplate.findUnique({
    where: { key: keyRaw },
    select: { body: true },
  })

  const displayBody = dbRow?.body ?? catalogEntry.defaultBody
  const isCustomized = dbRow !== null

  return (
    <div className='mx-auto max-w-6xl space-y-6 pb-6'>
      <header>
        <AdminSettingsBreadcrumb
          crumbs={[
            { label: 'Pengaturan', href: '/admin/settings' },
            { label: 'Template pesan', href: '/admin/settings/templates' },
            { label: 'WhatsApp', href: '/admin/settings/templates/whatsapp' },
            { label: catalogEntry.labelId },
          ]}
        />
        <h1 className='text-2xl font-semibold tracking-tight'>{catalogEntry.labelId}</h1>
        <p className='text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed'>{catalogEntry.descriptionId}</p>
      </header>

      <WaTemplateEditForm
        key={displayBody}
        templateKey={keyRaw}
        catalogEntry={catalogEntry}
        displayBody={displayBody}
        isCustomized={isCustomized}
      />
    </div>
  )
}
