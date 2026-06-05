import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireAdminSession } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Anggota Pengurus' }
import { getAdminContext } from '@/lib/auth/admin-context'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { parseAdminManagementMembersListSearchParams } from '@/lib/admin/admin-management-members-list-url'
import {
  countManagementMembersByTabForAdmin,
  countManagementMembersForAdmin,
  listManagementMembersForAdmin,
} from '@/lib/management/query-admin-management-members'
import { ADMIN_TABLE_PAGE_SIZE, resolveClampedPage } from '@/lib/table/admin-pagination'
import { prisma } from '@/lib/db/prisma'
import { ManagementMembersPage } from '@/components/admin/management-members-page'

export default async function AdminManagementMembersPage({
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
  const { filter, q: qParsed, page: requestedPage } = parseAdminManagementMembersListSearchParams(sp)
  const q = qParsed || undefined

  const totalItems = await countManagementMembersForAdmin({ filter, q })
  const page = resolveClampedPage(requestedPage, totalItems, ADMIN_TABLE_PAGE_SIZE)
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE

  const [members, availableMasterMembers, tabCounts, totalInDb] = await Promise.all([
    listManagementMembersForAdmin({
      filter,
      q,
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
    }),
    prisma.masterMember.findMany({
      where: { isActive: true },
      select: { id: true, memberNumber: true, fullName: true },
      orderBy: { memberNumber: 'asc' },
    }),
    countManagementMembersByTabForAdmin({ q }),
    prisma.managementMember.count(),
  ])

  return (
    <ManagementMembersPage
      members={members}
      availableMasterMembers={availableMasterMembers}
      directoryEmpty={totalInDb === 0}
      pagination={{
        page,
        pageSize: ADMIN_TABLE_PAGE_SIZE,
        totalItems,
      }}
      filter={filter}
      searchQuery={qParsed}
      tabCounts={tabCounts}
    />
  )
}
