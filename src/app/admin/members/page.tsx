import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireAdminSession } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Direktori Anggota' }
import { getAdminContext } from '@/lib/auth/admin-context'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { MembersAdminPage } from '@/components/admin/members-admin-page'
import { buildMasterMemberCsvTemplate } from '@/lib/members/master-member-csv-template'
import {
  countMasterMembersByTabForAdmin,
  countMasterMembersForAdmin,
  listMasterMembersForAdmin,
} from '@/lib/members/query-admin-master-members'
import { parseAdminMembersListSearchParams } from '@/lib/admin/admin-members-list-url'
import { ADMIN_TABLE_PAGE_SIZE, resolveClampedPage } from '@/lib/table/admin-pagination'

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireAdminSession()
  const ctx = await getAdminContext(session.user.id)

  if (!ctx || !hasOperationalOwnerParity(ctx.role)) {
    notFound()
  }

  const sp = (await searchParams) ?? {}
  const { filter, q: qParsed, page: requestedPage } = parseAdminMembersListSearchParams(sp)
  const q = qParsed || undefined

  const csvTemplateText = buildMasterMemberCsvTemplate()

  const totalItems = await countMasterMembersForAdmin({ filter, q })
  const page = resolveClampedPage(requestedPage, totalItems, ADMIN_TABLE_PAGE_SIZE)
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE

  const [rows, counts] = await Promise.all([
    listMasterMembersForAdmin({
      filter,
      q,
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
    }),
    countMasterMembersByTabForAdmin({ q }),
  ])

  return (
    <MembersAdminPage
      csvTemplateText={csvTemplateText}
      rows={rows}
      pagination={{
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        totalItems,
      }}
      filter={filter}
      searchQuery={qParsed}
      tabCounts={counts}
      isOwner={ctx.role === 'Owner'}
    />
  )
}
