'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ManagementMemberFormDialog } from '@/components/admin/management-member-form-dialog'
import { ManagementMembersAdminTable } from '@/components/admin/management-members-admin-table'
import { ManagementMembersAdminToolbar } from '@/components/admin/management-members-admin-toolbar'
import { adminManagementMembersListPreservedQuery } from '@/lib/admin/admin-management-members-list-url'
import type {
  AdminManagementMemberRowVm,
  ManagementMemberAdminFilter,
} from '@/lib/management/query-admin-management-members'

type MasterMemberOption = {
  id: string
  memberNumber: string
  fullName: string
}

type Props = {
  members: AdminManagementMemberRowVm[]
  availableMasterMembers: MasterMemberOption[]
  directoryEmpty: boolean
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  filter: ManagementMemberAdminFilter
  searchQuery: string
  tabCounts: { all: number; linked: number; unlinked: number }
}

type EditDialogState = {
  member: AdminManagementMemberRowVm
  mode: 'edit' | 'delete'
} | null

export function ManagementMembersPage({
  members,
  availableMasterMembers,
  directoryEmpty,
  pagination,
  filter,
  searchQuery,
  tabCounts,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editDialog, setEditDialog] = useState<EditDialogState>(null)

  const paginationPreserved = adminManagementMembersListPreservedQuery({ filter, q: searchQuery })

  function openEdit(member: AdminManagementMemberRowVm) {
    setEditDialog({ member, mode: 'edit' })
  }

  function openDelete(member: AdminManagementMemberRowVm) {
    setEditDialog({ member, mode: 'delete' })
  }

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 pb-10 md:px-6 md:p-6 lg:py-10'>
      <div className='text-sm text-muted-foreground'>
        <Link href='/admin/management' className='hover:text-foreground'>
          ← Kepengurusan
        </Link>
      </div>

      <header className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>Daftar pengurus</h1>
          <p className='text-sm text-muted-foreground'>
            Kode publik dipakai di form pendaftaran acara. Tautkan ke direktori anggota bila nomor member sudah ada.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className='shrink-0 sm:self-center'>
          <PlusIcon data-icon='inline-start' />
          Tambah pengurus
        </Button>
      </header>

      {directoryEmpty ? (
        <div className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
          Belum ada pengurus.{' '}
          <button type='button' className='font-medium text-foreground underline-offset-4 hover:underline' onClick={() => setCreateOpen(true)}>
            Tambah pengurus
          </button>{' '}
          untuk memulai.
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          <ManagementMembersAdminToolbar filter={filter} searchQuery={searchQuery} tabCounts={tabCounts} />
          <ManagementMembersAdminTable
            rows={members}
            pathname='/admin/management/members'
            preservedQuery={paginationPreserved}
            pagination={pagination}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        </div>
      )}

      <ManagementMemberFormDialog
        mode='create'
        open={createOpen}
        onOpenChange={setCreateOpen}
        availableMasterMembers={availableMasterMembers}
        onSaved={() => router.refresh()}
      />
      {editDialog ? (
        <ManagementMemberFormDialog
          mode='edit'
          open
          onOpenChange={open => {
            if (!open) setEditDialog(null)
          }}
          member={editDialog.member}
          availableMasterMembers={availableMasterMembers}
          onSaved={() => router.refresh()}
          defaultShowDeleteConfirm={editDialog.mode === 'delete'}
        />
      ) : null}
    </main>
  )
}
