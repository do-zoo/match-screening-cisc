'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'

import {
  createTicketCategory,
  deleteTicketCategory,
  toggleTicketCategoryActive,
  updateTicketCategory,
} from '@/lib/actions/admin-ticket-categories'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import { ticketCategorySchema, type TicketCategoryInput } from '@/lib/forms/ticket-category-schema'
import type { EventTicketCategoryRow } from '@/lib/tickets/get-event-ticket-categories'
import { formatIdr } from '@/lib/utils/format-idr'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IdrAmountInput } from '@/components/ui/idr-amount-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DialogState = { type: 'closed' } | { type: 'create' } | { type: 'edit'; category: EventTicketCategoryRow }

export function TicketCategoriesPanel({
  eventId,
  categories: initialCategories,
}: {
  eventId: string
  categories: EventTicketCategoryRow[]
}) {
  const [categories, setCategories] = useState<EventTicketCategoryRow[]>(initialCategories)
  const [dialog, setDialog] = useState<DialogState>({ type: 'closed' })
  const [pending, startTransition] = useTransition()

  const isOpen = dialog.type !== 'closed'
  const mode = dialog.type === 'edit' ? 'edit' : 'create'
  const editingCategory = dialog.type === 'edit' ? dialog.category : null

  const priceLocked = mode === 'edit' && editingCategory !== null && editingCategory.registrationCount > 0

  const form = useForm<TicketCategoryInput>({
    resolver: zodResolver(ticketCategorySchema as never) as Resolver<TicketCategoryInput>,
    defaultValues: {
      name: '',
      regularPrice: 0,
      memberPrice: 0,
      maxQtyPerPerson: null,
      capacity: null,
    },
  })

  function openCreate() {
    form.reset({
      name: '',
      regularPrice: 0,
      memberPrice: 0,
      maxQtyPerPerson: null,
      capacity: null,
    })
    setDialog({ type: 'create' })
  }

  function openEdit(category: EventTicketCategoryRow) {
    form.reset({
      name: category.name,
      regularPrice: category.regularPrice,
      memberPrice: category.memberPrice,
      maxQtyPerPerson: category.maxQtyPerPerson,
      capacity: category.capacity,
    })
    setDialog({ type: 'edit', category })
  }

  function closeDialog() {
    setDialog({ type: 'closed' })
  }

  function handleSubmit(values: TicketCategoryInput) {
    startTransition(async () => {
      if (mode === 'create') {
        const res = await createTicketCategory(eventId, values)
        if (!res.ok) {
          toastActionErr(res, 'Gagal menambah kategori.')
          return
        }
        const newRow: EventTicketCategoryRow = {
          id: res.data.id,
          name: values.name,
          regularPrice: values.regularPrice,
          memberPrice: values.memberPrice,
          maxQtyPerPerson: values.maxQtyPerPerson,
          sortOrder: Math.max(...categories.map(c => c.sortOrder), 0) + 1,
          isActive: true,
          registrationCount: 0,
          capacity: values.capacity,
        }
        setCategories(prev => [...prev, newRow])
        toastCudSuccess('create', 'Kategori berhasil ditambahkan.')
        closeDialog()
      } else if (editingCategory) {
        const res = await updateTicketCategory(editingCategory.id, values)
        if (!res.ok) {
          toastActionErr(res, 'Gagal memperbarui kategori.')
          return
        }
        setCategories(prev =>
          prev.map(c =>
            c.id === editingCategory.id
              ? {
                  ...c,
                  name: values.name,
                  regularPrice: priceLocked ? c.regularPrice : values.regularPrice,
                  memberPrice: priceLocked ? c.memberPrice : values.memberPrice,
                  maxQtyPerPerson: values.maxQtyPerPerson,
                  capacity: values.capacity,
                }
              : c,
          ),
        )
        toastCudSuccess('update', 'Kategori berhasil diperbarui.')
        closeDialog()
      }
    })
  }

  function handleDelete(categoryId: string) {
    startTransition(async () => {
      const res = await deleteTicketCategory(categoryId)
      if (!res.ok) {
        toastActionErr(res, 'Gagal menghapus kategori.')
        return
      }
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      toastCudSuccess('delete', 'Kategori berhasil dihapus.')
    })
  }

  function handleToggleActive(category: EventTicketCategoryRow) {
    startTransition(async () => {
      const next = !category.isActive
      const res = await toggleTicketCategoryActive(category.id, next)
      if (!res.ok) {
        toastActionErr(res, next ? 'Gagal mengaktifkan kategori.' : 'Gagal menonaktifkan kategori.')
        return
      }
      setCategories(prev => prev.map(c => (c.id === category.id ? { ...c, isActive: next } : c)))
      toastCudSuccess('update', next ? 'Kategori diaktifkan.' : 'Kategori dinonaktifkan.')
    })
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <p className='text-muted-foreground text-xs'>
          Kelola kategori tiket untuk acara ini. Harga disimpan sebagai bilangan bulat Rupiah (tanpa desimal).
        </p>
        <Button type='button' size='sm' variant='outline' onClick={openCreate} disabled={pending || !eventId}>
          Tambah kategori
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className='text-muted-foreground rounded-lg border p-4 text-sm'>
          Belum ada kategori tiket. Tambah kategori untuk mulai menerima registrasi.
        </p>
      ) : (
        <div className='overflow-x-auto rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr>
                <th className='px-3 py-2 text-left font-medium'>Nama</th>
                <th className='px-3 py-2 text-right font-medium'>Harga Reguler</th>
                <th className='px-3 py-2 text-right font-medium'>Harga Member</th>
                <th className='px-3 py-2 text-right font-medium'>Maks/Orang</th>
                <th className='px-3 py-2 text-right font-medium'>Registrasi</th>
                <th className='px-3 py-2 text-right font-medium'>Kapasitas</th>
                <th className='px-3 py-2 text-right font-medium'>Aksi</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {categories.map(cat => (
                <tr key={cat.id} className='hover:bg-muted/30'>
                  <td className='px-3 py-2'>
                    <span>{cat.name}</span>
                    {!cat.isActive ? <span className='text-muted-foreground ml-1.5 text-xs'>(nonaktif)</span> : null}
                  </td>
                  <td className='px-3 py-2 text-right font-mono'>{formatIdr(cat.regularPrice)}</td>
                  <td className='px-3 py-2 text-right font-mono'>{formatIdr(cat.memberPrice)}</td>
                  <td className='px-3 py-2 text-right'>{cat.maxQtyPerPerson ?? '—'}</td>
                  <td className='px-3 py-2 text-right'>{cat.registrationCount}</td>
                  <td className='px-3 py-2 text-right'>{cat.capacity ?? '—'}</td>
                  <td className='px-3 py-2'>
                    <div className='flex items-center justify-end gap-1.5'>
                      <Button type='button' size='sm' variant='ghost' disabled={pending} onClick={() => openEdit(cat)}>
                        Edit
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        disabled={pending}
                        onClick={() => handleToggleActive(cat)}
                      >
                        {cat.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      {cat.registrationCount === 0 ? (
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          disabled={pending}
                          className='text-destructive hover:text-destructive'
                          onClick={() => handleDelete(cat.id)}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={open => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Tambah Kategori' : 'Edit Kategori'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            <div className='flex flex-col gap-1'>
              <Label htmlFor='tc-name'>Nama kategori</Label>
              <Input
                id='tc-name'
                {...form.register('name')}
                disabled={pending}
                placeholder='Cth. Tiket Reguler, VIP, …'
              />
              {form.formState.errors.name ? (
                <p className='text-destructive text-xs'>{form.formState.errors.name.message}</p>
              ) : null}
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='flex flex-col gap-1'>
                <Label htmlFor='tc-regular-price'>Harga Reguler</Label>
                <Controller
                  control={form.control}
                  name='regularPrice'
                  render={({ field }) => (
                    <IdrAmountInput
                      id='tc-regular-price'
                      disabled={pending || priceLocked}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                {form.formState.errors.regularPrice ? (
                  <p className='text-destructive text-xs'>{form.formState.errors.regularPrice.message}</p>
                ) : null}
              </div>

              <div className='flex flex-col gap-1'>
                <Label htmlFor='tc-member-price'>Harga Member</Label>
                <Controller
                  control={form.control}
                  name='memberPrice'
                  render={({ field }) => (
                    <IdrAmountInput
                      id='tc-member-price'
                      disabled={pending || priceLocked}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
                {form.formState.errors.memberPrice ? (
                  <p className='text-destructive text-xs'>{form.formState.errors.memberPrice.message}</p>
                ) : null}
              </div>
            </div>

            {priceLocked ? (
              <p className='text-muted-foreground text-xs'>Harga tidak dapat diubah — sudah ada registrasi.</p>
            ) : null}

            <div className='flex flex-col gap-1'>
              <Label htmlFor='tc-capacity'>Kapasitas</Label>
              <Controller
                control={form.control}
                name='capacity'
                render={({ field }) => (
                  <Input
                    id='tc-capacity'
                    type='number'
                    disabled={pending}
                    placeholder='Opsional'
                    value={field.value === null ? '' : field.value}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        field.onChange(null)
                        return
                      }
                      const n = parseInt(raw, 10)
                      field.onChange(Number.isNaN(n) ? null : n)
                    }}
                  />
                )}
              />
              {form.formState.errors.capacity ? (
                <p className='text-destructive text-xs'>{form.formState.errors.capacity.message}</p>
              ) : null}
            </div>

            <div className='flex flex-col gap-1'>
              <Label htmlFor='tc-max-qty'>Maks tiket per orang (opsional)</Label>
              <Controller
                control={form.control}
                name='maxQtyPerPerson'
                render={({ field }) => (
                  <Input
                    id='tc-max-qty'
                    type='number'
                    min={1}
                    disabled={pending}
                    placeholder='Opsional'
                    value={field.value === null ? '' : field.value}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        field.onChange(null)
                        return
                      }
                      const n = parseInt(raw, 10)
                      field.onChange(Number.isNaN(n) ? null : n)
                    }}
                  />
                )}
              />
              {form.formState.errors.maxQtyPerPerson ? (
                <p className='text-destructive text-xs'>{form.formState.errors.maxQtyPerPerson.message}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={closeDialog} disabled={pending}>
                Batal
              </Button>
              <Button type='submit' disabled={pending}>
                {pending ? 'Menyimpan…' : mode === 'create' ? 'Tambah' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
