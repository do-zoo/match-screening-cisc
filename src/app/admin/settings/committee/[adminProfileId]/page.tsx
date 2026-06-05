import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { AdminRole } from '@prisma/client'

import { AdminSettingsBreadcrumb } from '@/components/admin/admin-settings-breadcrumb'
import { CommitteeAdminDetailTabs } from '@/components/admin/committee-admin-detail-tabs'
import { loadCommitteeAdminDetail } from '@/lib/admin/load-committee-admin-detail'
import { getAdminContext } from '@/lib/auth/admin-context'
import { requireAdminSession } from '@/lib/auth/session'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = { title: 'Detail Admin' }

export default async function CommitteeAdminDetailPage({ params }: { params: Promise<{ adminProfileId: string }> }) {
  const { adminProfileId } = await params

  const session = await requireAdminSession()
  const viewerCtx = await getAdminContext(session.user.id)
  if (!viewerCtx) notFound()

  const detail = await loadCommitteeAdminDetail(adminProfileId)
  if (!detail) notFound()

  return (
    <div className='space-y-6'>
      <div className='space-y-4'>
        <AdminSettingsBreadcrumb
          crumbs={[
            { label: 'Pengaturan', href: '/admin/settings' },
            { label: 'Komite & admin', href: '/admin/settings/committee' },
            { label: detail.displayName },
          ]}
        />
        <div className='flex flex-wrap items-center gap-3'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>{detail.displayName}</h1>
            <p className='text-muted-foreground text-sm'>{detail.email}</p>
          </div>
          <Badge>{detail.role}</Badge>
        </div>
      </div>

      <CommitteeAdminDetailTabs
        detail={detail}
        viewerProfileId={viewerCtx.profileId}
        viewerRole={viewerCtx.role as AdminRole}
      />
    </div>
  )
}
