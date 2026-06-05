import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireAdminSession } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Jabatan' }
import { getAdminContext } from '@/lib/auth/admin-context'
import { hasOperationalOwnerParity } from '@/lib/permissions/roles'
import { parseAdminManagementRolesListSearchParams } from '@/lib/admin/admin-management-roles-list-url'
import {
  countBoardRolesByTabForAdmin,
  countBoardRolesForAdmin,
  listAllBoardRolesForAdminTree,
  listBoardRolesForAdmin,
} from '@/lib/management/query-admin-board-roles'
import { ADMIN_TABLE_PAGE_SIZE, resolveClampedPage } from '@/lib/table/admin-pagination'
import { prisma } from '@/lib/db/prisma'
import { ManagementRolesPage } from '@/components/admin/management-roles-page'

export default async function AdminManagementRolesPage({
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
  const { filter, q: qParsed, page: requestedPage } = parseAdminManagementRolesListSearchParams(sp)
  const q = qParsed || undefined

  const totalItems = await countBoardRolesForAdmin({ filter, q })
  const page = resolveClampedPage(requestedPage, totalItems, ADMIN_TABLE_PAGE_SIZE)
  const skip = (page - 1) * ADMIN_TABLE_PAGE_SIZE

  const isTreeMode = filter === 'all' && !q

  const [roles, tabCounts, totalInDb, allRolesForTree] = await Promise.all([
    listBoardRolesForAdmin({
      filter,
      q,
      skip,
      take: ADMIN_TABLE_PAGE_SIZE,
    }),
    countBoardRolesByTabForAdmin({ q }),
    prisma.boardRole.count(),
    isTreeMode ? listAllBoardRolesForAdminTree() : Promise.resolve([]),
  ])

  return (
    <ManagementRolesPage
      roles={roles}
      allRolesForTree={allRolesForTree}
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
