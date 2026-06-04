'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DownloadIcon, PlusIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { MemberCsvImportPanel } from '@/components/admin/member-csv-import-panel'
import { MemberDeleteDialog } from '@/components/admin/member-delete-dialog'
import { MemberFormDialog } from '@/components/admin/member-form-dialog'
import { MembersAdminTable } from '@/components/admin/members-admin-table'
import { MembersAdminToolbar } from '@/components/admin/members-admin-toolbar'
import {
  adminMembersListPreservedQuery,
  buildAdminMembersListUrl,
  type MembersActivityFilter,
} from '@/lib/admin/admin-members-list-url'
import type { AdminMasterMemberRowVm } from '@/lib/members/query-admin-master-members'

type Props = {
  rows: AdminMasterMemberRowVm[]
  csvTemplateText: string
  filter: MembersActivityFilter
  searchQuery: string
  tabCounts: { all: number; active: number; inactive: number }
  pagination: {
    page: number
    pageSize: number
    totalItems: number
  }
  isOwner: boolean
}

export function MembersAdminPage({
  rows,
  csvTemplateText,
  filter,
  searchQuery,
  tabCounts,
  pagination,
  isOwner,
}: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<AdminMasterMemberRowVm | null>(null)
  const [memberPendingDelete, setMemberPendingDelete] = useState<AdminMasterMemberRowVm | null>(null)

  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('filter', filter)
    const term = searchQuery.trim()
    if (term) params.set('q', term)
    const qs = params.toString()
    return `/admin/members/export${qs ? `?${qs}` : ''}`
  }, [filter, searchQuery])

  const paginationPreserved = adminMembersListPreservedQuery({ filter, q: searchQuery })

  function refreshRows() {
    router.refresh()
  }

  function handleMemberDeleted(deletedId: string) {
    router.refresh()
    if (editingMember?.id === deletedId) setEditingMember(null)
  }

  return (
    <main className='mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 md:p-6 px-4 md:px-6 py-8 lg:py-10'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>Anggota</h1>
          <p className='text-sm text-muted-foreground'>
            Kelola master anggota, status aktif, dan pengurus. PIC acara diatur per acara (profil admin).
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Link href={exportHref} className={buttonVariants({ variant: 'outline' })}>
            <DownloadIcon data-icon='inline-start' />
            Ekspor CSV
          </Link>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon='inline-start' />
            Tambah anggota
          </Button>
        </div>
      </header>

      <MemberCsvImportPanel csvTemplateText={csvTemplateText} onImported={refreshRows} />

      <div className='flex flex-col gap-4'>
        <MembersAdminToolbar filter={filter} searchQuery={searchQuery} tabCounts={tabCounts} />
        <MembersAdminTable
          rows={rows}
          pathname='/admin/members'
          preservedQuery={paginationPreserved}
          pagination={pagination}
          isOwner={isOwner}
          onEdit={setEditingMember}
          onDelete={setMemberPendingDelete}
        />
      </div>

      <MemberFormDialog mode='create' open={createOpen} onOpenChange={setCreateOpen} onSaved={refreshRows} />
      <MemberFormDialog
        mode='edit'
        open={Boolean(editingMember)}
        onOpenChange={open => {
          if (!open) setEditingMember(null)
        }}
        member={editingMember}
        onSaved={refreshRows}
      />
      <MemberDeleteDialog
        member={memberPendingDelete}
        open={memberPendingDelete !== null}
        onOpenChange={next => {
          if (!next) setMemberPendingDelete(null)
        }}
        onDeleted={handleMemberDeleted}
      />
    </main>
  )
}
