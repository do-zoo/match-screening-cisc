'use client'

import * as React from 'react'

import { PencilIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IdrAmountInput } from '@/components/ui/idr-amount-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import { Textarea } from '@/components/ui/textarea'
import { FileField } from '@/components/ui/file-field'
import { saveVenueMenu } from '@/lib/actions/admin-venues'
import {
  buildAdminVenueMenuListUrl,
  type VenueMenuListViewMode,
  type VenueMenuLockFilter,
} from '@/lib/admin/admin-venue-menu-list'
import { venueMenuRowMatchesLockFilter, venueMenuRowMatchesSearch } from '@/lib/admin/filter-venue-menu-list'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import type { VenueCatalogUiPayload } from '@/lib/forms/venue-catalog-form-schema'
import { venueMenuOnlyPayloadSchema } from '@/lib/forms/venue-catalog-form-schema'
import { ADMIN_TABLE_PAGE_SIZE, resolveClampedPage } from '@/lib/table/admin-pagination'
import { formatIdr } from '@/lib/utils/format-idr'

function makeClientKey() {
  return crypto.randomUUID()
}

type MenuRow = VenueCatalogUiPayload['items'][number] & {
  clientKey: string
  clearImage?: boolean
}

function menuRowKey(row: MenuRow) {
  return row.id ?? row.clientKey
}

function mapInitialToMenuRows(source: VenueCatalogUiPayload['items']): MenuRow[] {
  return source.map(item => ({
    ...item,
    clientKey: item.clientKey ?? item.id ?? makeClientKey(),
    clearImage: item.clearImage ?? false,
  }))
}

function serverMenuSignature(source: VenueCatalogUiPayload['items']) {
  return JSON.stringify(
    source.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      sortOrder: i.sortOrder,
      description: i.description,
      imageBlobUrl: i.imageBlobUrl,
    })),
  )
}

function truncateText(text: string | null | undefined, max: number) {
  if (!text) return '—'
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export function AdminVenueMenuPanel({
  venueId,
  initialItems,
  frozenMenuItemIds = [],
  listQuery,
}: {
  venueId: string
  initialItems: VenueCatalogUiPayload['items']
  frozenMenuItemIds?: string[]
  listQuery: {
    q: string
    view: VenueMenuListViewMode
    page: number
    filter: VenueMenuLockFilter
  }
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [items, setItems] = React.useState<MenuRow[]>(() => mapInitialToMenuRows(initialItems))
  const [imageFiles, setImageFiles] = React.useState<Record<string, File>>({})

  const [itemDialogOpen, setItemDialogOpen] = React.useState(false)
  const [itemDialogMode, setItemDialogMode] = React.useState<'create' | 'edit'>('create')
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [draft, setDraft] = React.useState<MenuRow | null>(null)
  const [draftFileKey, setDraftFileKey] = React.useState<string | null>(null)
  const [menuImageFieldNonce, setMenuImageFieldNonce] = React.useState(0)

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteIndex, setDeleteIndex] = React.useState<number | null>(null)

  const frozenMenuItemIdSet = React.useMemo(() => new Set(frozenMenuItemIds), [frozenMenuItemIds])

  const qNormalized = listQuery.q.trim().toLowerCase()

  const filteredIndexedRows = React.useMemo(() => {
    return items
      .map((row, index) => ({ row, index }))
      .filter(
        ({ row }) =>
          venueMenuRowMatchesSearch(row, qNormalized) &&
          venueMenuRowMatchesLockFilter(row, listQuery.filter, frozenMenuItemIdSet),
      )
  }, [items, qNormalized, listQuery.filter, frozenMenuItemIdSet])

  const totalFiltered = filteredIndexedRows.length
  const displayPage = resolveClampedPage(listQuery.page, totalFiltered, ADMIN_TABLE_PAGE_SIZE)

  const pagedIndexedRows = React.useMemo(() => {
    const start = (displayPage - 1) * ADMIN_TABLE_PAGE_SIZE
    return filteredIndexedRows.slice(start, start + ADMIN_TABLE_PAGE_SIZE)
  }, [filteredIndexedRows, displayPage])

  React.useEffect(() => {
    if (listQuery.page === displayPage) return
    router.replace(
      buildAdminVenueMenuListUrl(venueId, {
        q: listQuery.q,
        view: listQuery.view,
        page: displayPage > 1 ? displayPage : undefined,
        filter: listQuery.filter,
      }),
    )
  }, [listQuery.page, listQuery.q, listQuery.view, listQuery.filter, displayPage, venueId, router])

  const preservedPaginationQuery: Record<string, string | undefined> = {
    ...(listQuery.view === 'table' ? { view: 'tabel' } : {}),
    ...(listQuery.q.trim() ? { q: listQuery.q.trim() } : {}),
    ...(listQuery.filter !== 'all' ? { filter: listQuery.filter } : {}),
  }

  const menuSignature = React.useMemo(() => serverMenuSignature(initialItems), [initialItems])

  const initialItemsRef = React.useRef(initialItems)

  React.useLayoutEffect(() => {
    initialItemsRef.current = initialItems
  }, [initialItems])

  React.useEffect(() => {
    if (itemDialogOpen || deleteOpen) return
    setItems(mapInitialToMenuRows(initialItemsRef.current))
    setImageFiles({})
  }, [menuSignature, venueId, itemDialogOpen, deleteOpen])

  function bumpMenuImageField() {
    setMenuImageFieldNonce(n => n + 1)
  }
  function openCreateDialog() {
    setItemDialogMode('create')
    setEditingIndex(null)
    const key = makeClientKey()
    setDraft({
      clientKey: key,
      name: '',
      description: null,
      imageBlobUrl: null,
      imageBlobPath: null,
      clearImage: false,
      price: 0,
      sortOrder: items.length + 1,
    })
    setDraftFileKey(key)
    bumpMenuImageField()
    setItemDialogOpen(true)
  }

  function openEditDialog(index: number) {
    const row = items[index]
    if (!row) return
    setItemDialogMode('edit')
    setEditingIndex(index)
    const key = menuRowKey(row)
    setDraft({ ...row })
    setDraftFileKey(key)
    bumpMenuImageField()
    setItemDialogOpen(true)
  }

  function closeItemDialog() {
    if (draftFileKey !== null) {
      setImageFiles(prev => {
        const next = { ...prev }
        delete next[draftFileKey]
        return next
      })
    }
    bumpMenuImageField()
    setItemDialogOpen(false)
    setDraft(null)
    setEditingIndex(null)
    setDraftFileKey(null)
  }

  function openDeleteDialog(index: number) {
    setDeleteIndex(index)
    setDeleteOpen(true)
  }

  function closeDeleteDialog() {
    setDeleteOpen(false)
    setDeleteIndex(null)
  }

  async function persistMenu(nextItems: MenuRow[]) {
    const files = imageFiles
    const parsed = venueMenuOnlyPayloadSchema.safeParse({ items: nextItems })
    if (!parsed.success) {
      toast.error('Isi formulir tidak valid.')
      return false
    }

    const formData = new FormData()
    formData.set('payload', JSON.stringify(parsed.data))
    for (const row of parsed.data.items) {
      const key = row.id ?? row.clientKey
      if (!key) continue
      const file = files[key]
      if (file) formData.set(`menuImage:${key}`, file)
    }

    const res = await saveVenueMenu(venueId, formData)
    if (res.ok) {
      toastCudSuccess('update', 'Menu kanonik disimpan.')
      router.refresh()
      return true
    }
    toastActionErr(res)
    return false
  }

  function handleSaveItemDialog() {
    if (!draft || draftFileKey === null) return
    startTransition(async () => {
      const parsedOne = venueMenuOnlyPayloadSchema.safeParse({
        items: [draft],
      })
      if (!parsedOne.success) {
        toast.error('Periksa nama, harga, dan urutan item.')
        return
      }

      let nextItems: MenuRow[]

      if (itemDialogMode === 'create') {
        nextItems = [...items, { ...draft, clientKey: draft.clientKey }]
      } else if (editingIndex !== null) {
        nextItems = items.map((it, i) => (i === editingIndex ? { ...draft } : it))
      } else {
        return
      }

      const okSave = await persistMenu(nextItems)
      if (okSave) closeItemDialog()
    })
  }

  function handleConfirmDelete() {
    if (deleteIndex === null) return
    startTransition(async () => {
      const nextItems = items.filter((_, i) => i !== deleteIndex)
      const okSave = await persistMenu(nextItems)
      if (okSave) closeDeleteDialog()
    })
  }

  const deleteTarget = deleteIndex !== null ? (items[deleteIndex] ?? null) : null
  const deleteFrozen = deleteTarget?.id != null && frozenMenuItemIdSet.has(deleteTarget.id)

  const draftFrozen = draft?.id != null && frozenMenuItemIdSet.has(draft.id)

  return (
    <div className='flex flex-col gap-4 md:p-6'>
      <header className='space-y-2'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
          <h1 className='text-2xl font-semibold tracking-tight'>Menu kanonik</h1>
          <Button
            type='button'
            size='sm'
            className='shrink-0 sm:self-center'
            disabled={pending}
            onClick={openCreateDialog}
          >
            Tambah item
          </Button>
        </div>
        <p className='text-muted-foreground text-sm'>
          Item menu dipakai saat menyusun acara di venue ini. Ubah nama atau harga pada item yang sudah dipakai
          pendaftar akan ditolak.
        </p>
      </header>

      <div className='space-y-4'>
        <AdminListToolbar
          search={{
            inputId: 'admin-venue-menu-search',
            label: 'Cari item menu',
            placeholder: 'Nama, deskripsi, atau angka harga…',
            value: listQuery.q,
            getUrlForQuery: q =>
              buildAdminVenueMenuListUrl(venueId, {
                q,
                view: listQuery.view,
                page: 1,
                filter: listQuery.filter,
              }),
          }}
          viewToggle={{
            mode: listQuery.view,
            tableHref: buildAdminVenueMenuListUrl(venueId, {
              q: listQuery.q,
              view: 'table',
              page: 1,
              filter: listQuery.filter,
            }),
            cardsHref: buildAdminVenueMenuListUrl(venueId, {
              q: listQuery.q,
              view: 'cards',
              page: 1,
              filter: listQuery.filter,
            }),
            disabled: pending,
          }}
          filterSlot={
            <AdminFilterSelect
              id='admin-venue-menu-filter'
              fieldLabel='Nama & harga'
              value={listQuery.filter}
              options={[
                { value: 'all', label: 'Semua item' },
                { value: 'locked', label: 'Terkunci (sudah dipakai)' },
                { value: 'unlocked', label: 'Belum terkunci' },
              ]}
              placeholder='Pilih filter'
              onValueChange={v => {
                router.push(
                  buildAdminVenueMenuListUrl(venueId, {
                    q: listQuery.q,
                    view: listQuery.view,
                    page: 1,
                    filter: v as VenueMenuLockFilter,
                  }),
                )
              }}
            />
          }
        />

        {totalFiltered === 0 ? (
          <p className='text-muted-foreground text-sm'>
            Tidak ada item yang cocok dengan pencarian atau filter. Ubah filter, hapus teks cari, atau tambah item baru.
          </p>
        ) : null}

        {totalFiltered > 0 ? (
          listQuery.view === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className='text-right'>Harga</TableHead>
                  <TableHead className='w-18 text-center'>Urutan</TableHead>
                  <TableHead className='min-w-32'>Deskripsi</TableHead>
                  <TableHead className='w-14'>Gambar</TableHead>
                  <TableHead className='w-34 text-right'>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedIndexedRows.map(({ row, index }) => {
                  const key = menuRowKey(row)
                  const thumb = row.imageBlobUrl ?? null
                  const frozen = row.id ? frozenMenuItemIdSet.has(row.id) : false
                  return (
                    <TableRow key={key}>
                      <TableCell className='max-w-56 font-medium whitespace-normal'>
                        {row.name || <span className='text-muted-foreground'>(tanpa nama)</span>}
                        {frozen ? <span className='text-muted-foreground mt-0.5 block text-xs'>Terkunci</span> : null}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>{formatIdr(row.price)}</TableCell>
                      <TableCell className='text-center tabular-nums'>{row.sortOrder}</TableCell>
                      <TableCell className='max-w-48 whitespace-normal text-muted-foreground'>
                        {truncateText(row.description, 48)}
                      </TableCell>
                      <TableCell>
                        {thumb ? (
                          <div className='border-input relative size-10 overflow-hidden rounded border'>
                            {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau Blob / CDN publik */}
                            <img src={thumb} alt='' className='size-full object-cover' />
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-xs'>—</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            disabled={pending}
                            onClick={() => openEditDialog(index)}
                            aria-label={`Ubah ${row.name || 'item'}`}
                          >
                            <PencilIcon className='size-4' />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            disabled={pending || items.length <= 1 || frozen}
                            onClick={() => openDeleteDialog(index)}
                            aria-label={`Hapus ${row.name || 'item'}`}
                          >
                            <Trash2Icon className='size-4 text-destructive' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2'>
              {pagedIndexedRows.map(({ row, index }) => {
                const key = menuRowKey(row)
                const preview = row.imageBlobUrl ?? null
                const frozen = row.id ? frozenMenuItemIdSet.has(row.id) : false
                return (
                  <div key={key} className='bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-xs'>
                    <div className='flex gap-3'>
                      {preview ? (
                        <div className='border-input relative size-20 shrink-0 overflow-hidden rounded-md border'>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt='' className='size-full object-cover' />
                        </div>
                      ) : (
                        <div className='border-input text-muted-foreground flex size-20 shrink-0 items-center justify-center rounded-md border text-xs'>
                          Tanpa gambar
                        </div>
                      )}
                      <div className='min-w-0 flex-1'>
                        <p className='font-medium leading-snug'>
                          {row.name || <span className='text-muted-foreground'>(tanpa nama)</span>}
                        </p>
                        <p className='text-muted-foreground text-sm tabular-nums'>
                          {formatIdr(row.price)} · urutan {row.sortOrder}
                        </p>
                        {frozen ? (
                          <p className='text-muted-foreground mt-1 text-xs'>
                            Nama & harga terkunci (sudah dipakai pendaftar).
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {row.description ? (
                      <p className='text-muted-foreground line-clamp-3 text-sm'>{row.description}</p>
                    ) : (
                      <p className='text-muted-foreground text-sm italic'>Tanpa deskripsi</p>
                    )}
                    <div className='flex flex-wrap justify-end gap-2 border-t pt-3'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={pending}
                        onClick={() => openEditDialog(index)}
                      >
                        Ubah
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='text-destructive'
                        disabled={pending || items.length <= 1 || frozen}
                        onClick={() => openDeleteDialog(index)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : null}

        {totalFiltered > 0 ? (
          <TablePagination
            pathname={`/admin/venues/${venueId}/menu`}
            preservedQuery={preservedPaginationQuery}
            currentPage={displayPage}
            pageSize={ADMIN_TABLE_PAGE_SIZE}
            totalItems={totalFiltered}
          />
        ) : null}
      </div>

      <Dialog
        open={itemDialogOpen}
        onOpenChange={open => {
          if (!open && !pending) closeItemDialog()
        }}
      >
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-lg' showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{itemDialogMode === 'create' ? 'Item menu baru' : 'Ubah item menu'}</DialogTitle>
            <DialogDescription>
              {draftFrozen
                ? 'Nama dan harga terkunci untuk item ini. Anda masih bisa mengubah urutan tampil, deskripsi, dan gambar.'
                : 'Lengkapi detail item. Perubahan disimpan ke basis data saat Anda menekan Simpan.'}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className='grid gap-4 py-1'>
              <div className='grid gap-2'>
                <Label htmlFor='venue-menu-name'>Nama</Label>
                <Input
                  id='venue-menu-name'
                  value={draft.name}
                  onChange={e => setDraft(d => (d ? { ...d, name: e.target.value } : d))}
                  disabled={pending || draftFrozen}
                />
              </div>
              <div className='grid gap-2 sm:grid-cols-2 sm:gap-3'>
                <div className='grid gap-2'>
                  <Label>Harga</Label>
                  <IdrAmountInput
                    value={draft.price}
                    onValueChange={next => setDraft(d => (d ? { ...d, price: next } : d))}
                    disabled={pending || draftFrozen}
                  />
                </div>
                <div className='grid gap-2'>
                  <Label htmlFor='venue-menu-order'>Urutan</Label>
                  <Input
                    id='venue-menu-order'
                    type='number'
                    min={0}
                    value={draft.sortOrder}
                    onChange={e =>
                      setDraft(d =>
                        d
                          ? {
                              ...d,
                              sortOrder: Number.parseInt(e.target.value || '0', 10),
                            }
                          : d,
                      )
                    }
                    disabled={pending}
                  />
                </div>
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='venue-menu-desc'>Deskripsi</Label>
                <Textarea
                  id='venue-menu-desc'
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={e => setDraft(d => (d ? { ...d, description: e.target.value } : d))}
                  placeholder='Contoh: Kopi susu dingin dengan gula aren.'
                  disabled={pending}
                />
              </div>
              <div className='grid gap-2'>
                <FileField
                  key={`menu-img-${draftFileKey}-${menuImageFieldNonce}`}
                  id={draftFileKey ? `venue-menu-image-${draftFileKey}` : 'venue-menu-image'}
                  label='Gambar menu'
                  description='Opsional. Format JPG, PNG, atau WebP.'
                  accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
                  disabled={pending}
                  existingPreviewUrl={draft && !draft.clearImage ? (draft.imageBlobUrl ?? undefined) : undefined}
                  pickPrompt='Ketuk untuk memilih gambar'
                  replacePrompt='Ganti gambar'
                  onChange={file => {
                    const dk = draftFileKey
                    if (!draft || dk === null) return
                    if (file) {
                      setImageFiles(prev => ({ ...prev, [dk]: file }))
                      setDraft(d => (d ? { ...d, clearImage: false } : d))
                    }
                  }}
                />
                {(draft?.imageBlobUrl && !draft.clearImage) ||
                (draftFileKey !== null && Boolean(imageFiles[draftFileKey])) ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={pending}
                    onClick={() => {
                      const dk = draftFileKey
                      if (dk !== null) {
                        setImageFiles(prev => {
                          const next = { ...prev }
                          delete next[dk]
                          return next
                        })
                      }
                      setDraft(d =>
                        d
                          ? {
                              ...d,
                              imageBlobUrl: null,
                              imageBlobPath: null,
                              clearImage: true,
                            }
                          : d,
                      )
                      bumpMenuImageField()
                    }}
                  >
                    Hapus gambar
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={pending} onClick={closeItemDialog}>
              Batal
            </Button>
            <Button type='button' disabled={pending || !draft} onClick={handleSaveItemDialog}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={open => {
          if (!open && !pending) closeDeleteDialog()
        }}
      >
        <DialogContent className='sm:max-w-md' showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Hapus item menu?</DialogTitle>
            <DialogDescription>
              {deleteTarget ? (
                <>
                  Item <span className='text-foreground font-medium'>{deleteTarget.name || '(tanpa nama)'}</span> akan
                  dihapus dari katalog venue. Tindakan ini tidak bisa dibatalkan setelah disimpan.
                </>
              ) : (
                'Pilih item yang valid.'
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteFrozen ? (
            <p className='text-destructive text-sm'>
              Item ini tidak bisa dihapus karena sudah dipakai acara dengan pendaftaran.
            </p>
          ) : null}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={pending} onClick={closeDeleteDialog}>
              Batal
            </Button>
            <Button
              type='button'
              variant='destructive'
              disabled={pending || deleteIndex === null || deleteFrozen || items.length <= 1}
              onClick={handleConfirmDelete}
            >
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
