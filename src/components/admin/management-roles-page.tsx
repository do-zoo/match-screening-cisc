'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ManagementRoleFormDialog } from '@/components/admin/management-role-form-dialog'
import { ManagementRolesAdminTable } from '@/components/admin/management-roles-admin-table'
import { ManagementRolesAdminToolbar } from '@/components/admin/management-roles-admin-toolbar'
import { adminManagementRolesListPreservedQuery } from '@/lib/admin/admin-management-roles-list-url'
import { buildRoleTree, flattenTreeDepthFirst } from '@/lib/management/build-role-tree'
import type { AdminBoardRoleRowVm, BoardRoleAdminFilter } from '@/lib/management/query-admin-board-roles'

type Props = {
  roles: AdminBoardRoleRowVm[]
  allRolesForTree: AdminBoardRoleRowVm[]
  directoryEmpty: boolean
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  filter: BoardRoleAdminFilter
  searchQuery: string
  tabCounts: { all: number; active: number; inactive: number }
}

type EditDialogState = {
  role: AdminBoardRoleRowVm
  mode: 'edit' | 'deactivate'
} | null

export function ManagementRolesPage({
  roles,
  allRolesForTree,
  directoryEmpty,
  pagination,
  filter,
  searchQuery,
  tabCounts,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<EditDialogState>(null)

  const isTreeMode = allRolesForTree.length > 0 && filter === 'all' && searchQuery.trim() === ''

  const treeFlat = useMemo(() => {
    if (!isTreeMode) return []
    const tree = buildRoleTree(allRolesForTree)
    return flattenTreeDepthFirst(tree)
  }, [isTreeMode, allRolesForTree])

  const displayRoles: AdminBoardRoleRowVm[] = useMemo(() => {
    if (!isTreeMode) return roles
    return treeFlat.map(({ node }) => ({
      id: node.id,
      title: node.title,
      sortOrder: node.sortOrder,
      isActive: node.isActive,
      isUnique: node.isUnique,
      parentRoleId: node.parentRoleId,
    }))
  }, [isTreeMode, roles, treeFlat])

  const allRoleOptions = (isTreeMode ? allRolesForTree : roles).map(r => ({
    id: r.id,
    title: r.title,
  }))

  const paginationPreserved = adminManagementRolesListPreservedQuery({ filter, q: searchQuery })

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 pb-10 md:px-6 md:p-6 lg:py-10'>
      <div className='text-sm text-muted-foreground'>
        <Link href='/admin/management' className='hover:text-foreground'>
          ← Kepengurusan
        </Link>
      </div>

      <header className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>Jabatan</h1>
          <p className='text-sm text-muted-foreground'>BoardRole — nama jabatan dan urutan tampil di roster.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className='shrink-0 sm:self-center'>
          <PlusIcon data-icon='inline-start' />
          Tambah jabatan
        </Button>
      </header>

      {directoryEmpty ? (
        <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
          Belum ada jabatan.{' '}
          <button type='button' className='font-medium text-foreground underline-offset-4 hover:underline' onClick={() => setCreateOpen(true)}>
            Tambah jabatan
          </button>{' '}
          untuk memulai.
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          <ManagementRolesAdminToolbar filter={filter} searchQuery={searchQuery} tabCounts={tabCounts} />
          <ManagementRolesAdminTable
            rows={displayRoles}
            isTreeMode={isTreeMode}
            treeFlat={treeFlat}
            pathname='/admin/management/roles'
            preservedQuery={paginationPreserved}
            pagination={isTreeMode ? undefined : pagination}
            onEdit={role => setEditDialog({ role, mode: 'edit' })}
            onDeactivate={role => setEditDialog({ role, mode: 'deactivate' })}
          />
        </div>
      )}

      <ManagementRoleFormDialog
        mode='create'
        open={createOpen}
        onOpenChange={setCreateOpen}
        allRoles={allRoleOptions}
        onSaved={() => router.refresh()}
      />
      {editDialog ? (
        <ManagementRoleFormDialog
          mode='edit'
          open
          onOpenChange={open => {
            if (!open) setEditDialog(null)
          }}
          role={editDialog.role}
          allRoles={allRoleOptions}
          onSaved={() => router.refresh()}
          defaultShowDeactivateConfirm={editDialog.mode === 'deactivate'}
        />
      ) : null}
    </main>
  )
}
