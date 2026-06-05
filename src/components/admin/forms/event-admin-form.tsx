'use client'

import * as React from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'

import { abandonDraftEventDescriptionImages } from '@/lib/actions/abandon-draft-event-description-images'
import { createAdminEvent, updateAdminEvent } from '@/lib/actions/admin-events'
import { toastActionErr, toastCudSuccess } from '@/lib/client/cud-notify'
import type { EventIntegritySnapshot } from '@/lib/events/event-edit-guards'
import { findLockedViolations } from '@/lib/events/event-edit-guards'
import {
  adminEventUpsertSchema,
  type AdminEventUpsertInput,
  type LinkedVenueMenuItemDraft,
} from '@/lib/forms/admin-event-form-schema'
import type { MemberAccessMode } from '@prisma/client'

import { TicketCategoriesPanel } from '@/components/admin/event-editor/ticket-categories-panel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FieldGroup } from '@/components/ui/field'
import { FileField } from '@/components/ui/file-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { EventTicketCategoryRow } from '@/lib/tickets/get-event-ticket-categories'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'

const SENSITIVE_ACK_MESSAGE = 'Centang pengakuan untuk mengubah PIC utama atau rekening pembayaran.'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draf',
  active: 'Aktif',
  finished: 'Selesai',
}

export type EventAdminPicOption = { id: string; label: string }

export type VenueOptionForEventAdmin = {
  id: string
  name: string
  menuItems: Array<{
    id: string
    name: string
    price: number
    sortOrder: number
  }>
}

/** Stable fallback so `useWatch` `?? []` does not allocate a fresh array each render. */
const FALLBACK_LINKED_VENUE_MENU_ITEMS: LinkedVenueMenuItemDraft[] = []

export type EventAdminFormProps = {
  mode: 'create' | 'edit'
  eventId?: string
  defaults: AdminEventUpsertInput
  registrationCount?: number
  persistedIntegrity?: EventIntegritySnapshot | null
  /** Admin profiles eligible as event PIC (financial owner). */
  picOptions: EventAdminPicOption[]
  banksByPic: Record<string, Array<{ id: string; label: string }>>
  /** Admin profiles eligible as PIC pembantu (same pool as PIC; PIC excluded in form). */
  helperAdminOptions: EventAdminPicOption[]
  /** Venue aktif + katalog menu kanonik. */
  venueOptions: VenueOptionForEventAdmin[]
  /** Pratinjau sampul yang sudah tersimpan (mode edit). */
  persistedCoverUrl?: string | null
  /** Kategori tiket yang sudah tersimpan (mode edit); kosong untuk mode buat. */
  categories: EventTicketCategoryRow[]
  /** ID acara + token untuk unggah gambar di deskripsi (Buat / Edit). */
  descriptionAssetContext?: { eventId: string; assetToken: string } | null
}

export function EventAdminForm(props: EventAdminFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rootMessage, setRootMessage] = useState<string | null>(null)
  const [pendingAcknowledge, setPendingAcknowledge] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [createStep, setCreateStep] = useState(0)
  /** Set true tepat sebelum navigasi sukses Buat acara agar pembersihan draf blob tidak jalan. */
  const createSavedRef = useRef(false)
  const abandonDraftEffectGen = useRef(0)
  const submitInFlightRef = useRef(false)

  const registrationCount = props.registrationCount ?? 0
  const persistedIntegrity =
    props.persistedIntegrity ??
    ({
      slug: '',
      venueId: props.defaults.venueId,
      mandatoryMenuItemIds: props.defaults.mandatoryMenuItemIds,
      picAdminProfileId: props.defaults.picAdminProfileId,
      bankAccountId: props.defaults.bankAccountId,
    } satisfies EventIntegritySnapshot)

  const venueOptions = props.venueOptions

  const form = useForm<AdminEventUpsertInput>({
    resolver: zodResolver(adminEventUpsertSchema as never) as Resolver<AdminEventUpsertInput>,
    defaultValues: props.defaults,
  })

  const venueId = useWatch({ control: form.control, name: 'venueId' })

  const currentVenue = useMemo(() => {
    return venueOptions.find(v => v.id === venueId) ?? null
  }, [venueOptions, venueId])

  const picId = useWatch({ control: form.control, name: 'picAdminProfileId' })
  const bankAccountId = useWatch({
    control: form.control,
    name: 'bankAccountId',
  })
  const helpersSelected =
    useWatch({
      control: form.control,
      name: 'helperAdminProfileIds',
    }) ?? []
  const multiCategoryPurchase = useWatch({ control: form.control, name: 'multiCategoryPurchase' }) ?? false
  const requireAllHolderData = useWatch({ control: form.control, name: 'requireAllHolderData' }) ?? true
  const memberAccessMode = (useWatch({ control: form.control, name: 'memberAccessMode' }) ?? 'open') as MemberAccessMode

  const bankChoices = useMemo(() => {
    return props.banksByPic[picId] ?? []
  }, [props.banksByPic, picId])

  const venueComboboxOptions = useMemo(
    () =>
      venueOptions.map(v => ({
        value: v.id,
        label: v.name,
        keywords: v.name,
      })),
    [venueOptions],
  )

  const picComboboxOptions = useMemo(
    () =>
      props.picOptions.map(p => ({
        value: p.id,
        label: p.label,
        keywords: p.label,
      })),
    [props.picOptions],
  )

  const bankComboboxOptions = useMemo(
    () =>
      bankChoices.map(b => ({
        value: b.id,
        label: b.label,
        keywords: b.label,
      })),
    [bankChoices],
  )

  const lockedIntegrityKeys = useMemo(() => {
    return findLockedViolations({
      registrationCount,
      persisted: persistedIntegrity,
      candidate: { venueId },
    })
  }, [registrationCount, persistedIntegrity, venueId])

  const mandatoryMenuLocked = registrationCount > 0

  const setLinkedVenueMenusFromVenueSelection = useCallback(
    (vid: string) => {
      const v = venueOptions.find(o => o.id === vid)
      if (!v) {
        form.setValue('linkedVenueMenuItems', [], { shouldDirty: true })
        return
      }
      const sorted = [...v.menuItems].sort((a, b) => a.sortOrder - b.sortOrder)
      form.setValue(
        'linkedVenueMenuItems',
        sorted.map((m, idx) => ({
          venueMenuItemId: m.id,
          sortOrder: idx,
        })),
        { shouldDirty: true },
      )
    },
    [form, venueOptions],
  )

  const linkedVenueMenus =
    useWatch({ control: form.control, name: 'linkedVenueMenuItems' }) ?? FALLBACK_LINKED_VENUE_MENU_ITEMS

  const mandatoryMenuItemIds = useWatch({ control: form.control, name: 'mandatoryMenuItemIds' }) ?? []

  useEffect(() => {
    const linkedIds = linkedVenueMenus.map(x => x.venueMenuItemId)
    const cur = form.getValues('mandatoryMenuItemIds') ?? []
    const filtered = cur.filter(id => linkedIds.includes(id))
    if (JSON.stringify(cur) !== JSON.stringify(filtered)) {
      form.setValue('mandatoryMenuItemIds', filtered, { shouldDirty: true })
    }
  }, [linkedVenueMenus, form])

  useEffect(() => {
    if (props.mode !== 'create' || !props.descriptionAssetContext) return
    const { eventId, assetToken } = props.descriptionAssetContext
    abandonDraftEffectGen.current += 1
    const genAtRun = abandonDraftEffectGen.current
    return () => {
      queueMicrotask(() => {
        if (abandonDraftEffectGen.current !== genAtRun) return
        if (createSavedRef.current) return
        void abandonDraftEventDescriptionImages(eventId, assetToken).catch(() => {})
      })
    }
  }, [props.mode, props.descriptionAssetContext])

  const submitPayload = useCallback(
    (withAck: boolean) => {
      if (submitInFlightRef.current) return
      submitInFlightRef.current = true
      setRootMessage(null)
      startTransition(async () => {
        try {
          const fd = new FormData()
          const payload: AdminEventUpsertInput = {
            ...form.getValues(),
            acknowledgeSensitiveChanges: withAck,
          }
          fd.set('payload', JSON.stringify(payload))
          if (coverFile && coverFile.size > 0) {
            fd.set('cover', coverFile)
          }
          if (props.mode === 'create' && props.descriptionAssetContext) {
            fd.set('descriptionClientEventId', props.descriptionAssetContext.eventId)
            fd.set('descriptionAssetToken', props.descriptionAssetContext.assetToken)
          }

          const result =
            props.mode === 'create'
              ? await createAdminEvent(undefined, fd)
              : await updateAdminEvent(props.eventId ?? '', undefined, fd)

          if (props.mode === 'edit' && !result.ok && result.rootError === SENSITIVE_ACK_MESSAGE && !withAck) {
            setPendingAcknowledge(true)
            return
          }

          if (!result.ok) {
            toastActionErr(result)
            if (result.rootError) setRootMessage(result.rootError)
            else if (result.fieldErrors && Object.keys(result.fieldErrors).length)
              setRootMessage(Object.values(result.fieldErrors).join(' '))
            return
          }

          if (props.mode === 'create') {
            createSavedRef.current = true
            toastCudSuccess('create', 'Acara berhasil dibuat.')
            router.push(`/admin/events/${result.data.eventId}/edit`)
          } else {
            toastCudSuccess('update', 'Acara berhasil diperbarui.')
            router.refresh()
          }
        } finally {
          submitInFlightRef.current = false
        }
      })
    },
    [coverFile, form, props.eventId, props.mode, props.descriptionAssetContext, router],
  )

  const handleSaveFormSubmit = useCallback(
    (e: React.SubmitEvent<HTMLFormElement>) => {
      void form.handleSubmit(() => submitPayload(false))(e)
    },
    [form, submitPayload],
  )

  // ─── Shared section JSX (evaluated at render time, not sub-components) ───

  const sectionTitle = (
    <section className='space-y-4'>
      <SectionHeading>Dasar acara</SectionHeading>
      <Field label='Judul'>
        <Input {...form.register('title')} disabled={pending} />
      </Field>
    </section>
  )

  const sectionCover = (
    <section className='space-y-2'>
      <FileField
        id='event-hero-cover'
        label={<SectionHeading>Sampul</SectionHeading>}
        description={
          <span className='text-muted-foreground text-sm'>
            {props.mode === 'create'
              ? 'Unggah gambar sampul — wajib untuk acara baru.'
              : 'Unggah gambar baru bila ingin mengganti sampul (opsional).'}{' '}
            Rasio yang direkomendasikan 1200×630.
          </span>
        }
        accept='image/jpeg,image/png,image/webp,image/heic,image/heif'
        disabled={pending}
        existingPreviewUrl={props.persistedCoverUrl ?? null}
        maxSizeBytes={5 * 1024 * 1024}
        pickPrompt='Ketuk untuk memilih sampul'
        replacePrompt='Ganti sampul'
        onChange={f => setCoverFile(f ?? null)}
      />
    </section>
  )

  const sectionSummary = (
    <section className='space-y-4'>
      <SectionHeading>Ringkasan</SectionHeading>
      <Field label='Ringkasan'>
        <Textarea {...form.register('summary')} disabled={pending} className='resize-y' />
      </Field>
    </section>
  )

  const sectionDescription = (
    <section className='space-y-4'>
      <SectionHeading>Deskripsi</SectionHeading>
      <Field label='Konten publik'>
        <Controller
          control={form.control}
          name='descriptionHtml'
          render={({ field }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              disabled={pending}
              descriptionImageUpload={props.descriptionAssetContext ?? null}
            />
          )}
        />
      </Field>
    </section>
  )

  const sectionJadwalRegistrasi = (
    <section className='space-y-4'>
      <SectionHeading>Jadwal registrasi</SectionHeading>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Buka registrasi'>
          <Controller
            control={form.control}
            name='openRegistrationAtIso'
            render={({ field, fieldState }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                disabled={pending}
                aria-invalid={fieldState.invalid}
              />
            )}
          />
        </Field>
        <Field label='Tutup registrasi'>
          <Controller
            control={form.control}
            name='closeRegistrationAtIso'
            render={({ field, fieldState }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                disabled={pending}
                aria-invalid={fieldState.invalid}
              />
            )}
          />
        </Field>
      </div>
    </section>
  )

  const sectionJadwalAcara = (
    <section className='space-y-4'>
      <SectionHeading>Jadwal acara</SectionHeading>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Buka gate'>
          <Controller
            control={form.control}
            name='openGateAtIso'
            render={({ field, fieldState }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                disabled={pending}
                aria-invalid={fieldState.invalid}
              />
            )}
          />
        </Field>
        <Field label='Kick-off acara'>
          <Controller
            control={form.control}
            name='kickOffAtIso'
            render={({ field, fieldState }) => (
              <DateTimePicker
                value={field.value}
                onChange={field.onChange}
                disabled={pending}
                aria-invalid={fieldState.invalid}
              />
            )}
          />
        </Field>
      </div>
    </section>
  )

  const sectionRegistrasi = (
    <section className='space-y-4'>
      <SectionHeading>Registrasi</SectionHeading>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Status acara'>
          <Controller
            control={form.control}
            name='status'
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={v => {
                  if (v != null) field.onChange(v)
                }}
                disabled={pending}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='draft'>Draf</SelectItem>
                  <SelectItem value='active'>Aktif</SelectItem>
                  <SelectItem value='finished'>Selesai</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      <label className='flex items-center gap-2 text-sm'>
        <input type='checkbox' {...form.register('registrationManualClosed')} disabled={pending} />
        Tutup registrasi secara manual (formulir diblokir)
      </label>
    </section>
  )

  const sectionVenue = (
    <section className='space-y-4'>
      <SectionHeading>Venue</SectionHeading>
      <Field label='Venue'>
        <Controller
          control={form.control}
          name='venueId'
          render={({ field }) => (
            <EntityCombobox
              placeholder='Pilih venue'
              value={field.value === '' ? null : field.value}
              onValueChange={next => {
                if (next === null) return
                field.onChange(next)
                setLinkedVenueMenusFromVenueSelection(next)
              }}
              options={venueComboboxOptions}
              disabled={pending || lockedIntegrityKeys.includes('venueId')}
            />
          )}
        />
        {lockedIntegrityKeys.includes('venueId') ? (
          <Muted>Terhubung pada pendaftar — venue tidak dapat diubah.</Muted>
        ) : (
          <p className='text-muted-foreground text-xs'>
            Menu di formulir pengunjung diturunkan dari katalog venue. Ubah nama/harga menu di pengelola venue.
          </p>
        )}
      </Field>
    </section>
  )

  const sectionMenuWajib = (
    <section className='space-y-4'>
      <SectionHeading>Menu wajib (per tiket)</SectionHeading>
      <p className='text-muted-foreground text-xs'>
        Opsional — centang item yang wajib dipilih pengunjung per tiket. Kosongkan semua bila acara tidak mewajibkan
        pemilihan menu.
      </p>
      {linkedVenueMenus.length === 0 ? (
        <p className='text-muted-foreground text-sm'>Pilih venue yang memiliki setidaknya satu item menu kanonik.</p>
      ) : (
        <div className='border-muted bg-card space-y-2 rounded-lg border p-4'>
          <div className='flex flex-col gap-2'>
            {linkedVenueMenus.flatMap(row => {
              const meta = currentVenue?.menuItems.find(mi => mi.id === row.venueMenuItemId)
              if (!meta) return []
              const mid = row.venueMenuItemId
              const checked = mandatoryMenuItemIds.includes(mid)
              return [
                <label
                  key={mid}
                  className='hover:bg-accent/60 flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm'
                >
                  <input
                    type='checkbox'
                    className='mt-1 shrink-0'
                    checked={checked}
                    disabled={pending || mandatoryMenuLocked}
                    onChange={e => {
                      const cur = new Set(form.getValues('mandatoryMenuItemIds') ?? [])
                      if (e.target.checked) {
                        cur.add(mid)
                      } else {
                        cur.delete(mid)
                      }
                      form.setValue('mandatoryMenuItemIds', [...cur], {
                        shouldDirty: true,
                      })
                    }}
                  />
                  <span>
                    <span className='font-medium'>{meta.name}</span>
                    <span className='text-muted-foreground'> · {formatIdr(meta.price)}</span>
                  </span>
                </label>,
              ]
            })}
          </div>
          {mandatoryMenuLocked ? <Muted>Terhubung pada pendaftar — set menu wajib tidak dapat diubah.</Muted> : null}
        </div>
      )}
    </section>
  )

  const sectionMultiCategory = (
    <section className='space-y-3'>
      <SectionHeading>Pembelian lintas kategori</SectionHeading>
      <div className='flex items-center gap-2'>
        <Checkbox
          id='multiCategoryPurchase'
          checked={multiCategoryPurchase}
          onCheckedChange={v => form.setValue('multiCategoryPurchase', Boolean(v))}
        />
        <label htmlFor='multiCategoryPurchase' className='text-sm'>
          Izinkan beli tiket dari beberapa kategori dalam satu transaksi
        </label>
      </div>
    </section>
  )

  const sectionRequireAllHolderData = (
    <section className='space-y-3'>
      <SectionHeading>Data peserta tiket tambahan</SectionHeading>
      <div className='flex items-center gap-2'>
        <Checkbox
          id='requireAllHolderData'
          checked={requireAllHolderData}
          onCheckedChange={v => form.setValue('requireAllHolderData', Boolean(v))}
          disabled={registrationCount > 0}
        />
        <label htmlFor='requireAllHolderData' className='text-sm'>
          Wajibkan data untuk setiap peserta (nama, nomor member)
        </label>
      </div>
      {registrationCount > 0 && <Muted>Tidak dapat diubah setelah ada pendaftar.</Muted>}
      {!requireAllHolderData && registrationCount === 0 && (
        <Muted>
          Jika dinonaktifkan, hanya data pemesan utama yang dikumpulkan. Tiket tambahan mengikuti status keanggotaan
          pemesan utama.
        </Muted>
      )}
    </section>
  )

  const sectionMemberAccess = (
    <section className='space-y-3'>
      <SectionHeading>Akses pendaftaran</SectionHeading>
      {(
        [
          ['open', 'Acara umum'],
          ['tangsel_only', 'Hanya member CISC Tangsel'],
          ['cisc_members', 'Hanya member CISC (Tangsel + regional)'],
        ] as const
      ).map(([value, label]) => (
        <div key={value} className='flex items-center gap-2'>
          <Checkbox
            id={`memberAccessMode-${value}`}
            checked={memberAccessMode === value}
            onCheckedChange={checked => {
              if (checked) form.setValue('memberAccessMode', value, { shouldDirty: true })
            }}
          />
          <label htmlFor={`memberAccessMode-${value}`} className='text-sm'>
            {label}
          </label>
        </div>
      ))}
    </section>
  )

  const sectionPicRekening = (
    <section className='space-y-4'>
      <SectionHeading>PIC &amp; rekening</SectionHeading>
      <FieldGroup className='grid gap-4 sm:grid-cols-2'>
        <Field label='PIC utama'>
          <EntityCombobox
            placeholder='Pilih PIC'
            value={picId === '' ? null : picId}
            onValueChange={next => {
              if (next === null) return
              form.setValue('picAdminProfileId', next, {
                shouldDirty: true,
              })
              const first = props.banksByPic[next]?.[0]?.id ?? ''
              form.setValue('bankAccountId', first, { shouldDirty: true })
            }}
            options={picComboboxOptions}
            disabled={pending}
          />
        </Field>
        <Field label='Rekening pembayaran'>
          <EntityCombobox
            placeholder='Pilih rekening'
            value={bankAccountId === '' ? null : bankAccountId}
            onValueChange={v => {
              if (v === null) return
              form.setValue('bankAccountId', v, { shouldDirty: true })
            }}
            disabled={pending || bankChoices.length === 0}
            options={bankComboboxOptions}
          />
          {bankChoices.length === 0 ? (
            <Muted>Tidak ada rekening aktif untuk PIC ini — tambahkan di pengaturan komite.</Muted>
          ) : null}
        </Field>
      </FieldGroup>

      <Field label={`PIC pembantu (${helpersSelected.length})`}>
        <div className='max-h-40 space-y-1 overflow-y-auto rounded-md border p-3'>
          {props.helperAdminOptions.map(p => {
            const currentHelpers: string[] = form.getValues('helperAdminProfileIds') ?? []
            const checked = currentHelpers.includes(p.id)
            const disabledAsPic = p.id === picId
            return (
              <label
                key={p.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  checked && 'border-primary/40 bg-primary/5',
                  disabledAsPic && 'cursor-not-allowed opacity-50',
                )}
              >
                <input
                  type='checkbox'
                  className='accent-primary'
                  checked={checked}
                  disabled={disabledAsPic || pending}
                  onChange={e => {
                    const prev: string[] = form.getValues('helperAdminProfileIds') ?? []
                    if (e.target.checked) {
                      form.setValue('helperAdminProfileIds', [...prev, p.id], { shouldDirty: true })
                    } else {
                      form.setValue(
                        'helperAdminProfileIds',
                        prev.filter(id => id !== p.id),
                        { shouldDirty: true },
                      )
                    }
                  }}
                />
                {p.label}
              </label>
            )
          })}
        </div>
      </Field>
    </section>
  )

  const errorAlert = rootMessage ? (
    <Alert variant='destructive'>
      <AlertTitle>Gagal menyimpan</AlertTitle>
      <AlertDescription>{rootMessage}</AlertDescription>
    </Alert>
  ) : null

  // ─── Edit mode: Tabs layout ───────────────────────────────────────────────

  const saveEventFormProps = {
    onSubmit: handleSaveFormSubmit,
    className: 'space-y-8' as const,
  }

  if (props.mode === 'edit') {
    return (
      <>
        {errorAlert}
        <Tabs defaultValue='dasar' className='mt-2'>
          <TabsList className='mb-6 w-full sm:w-auto'>
            <TabsTrigger value='dasar'>Dasar</TabsTrigger>
            <TabsTrigger value='tiket'>Harga &amp; Tiket</TabsTrigger>
            <TabsTrigger value='venue'>Venue &amp; Menu</TabsTrigger>
          </TabsList>

          <TabsContent value='dasar' className='space-y-8'>
            <form {...saveEventFormProps}>
              {sectionTitle}
              {sectionCover}
              {sectionSummary}
              {sectionDescription}
              {sectionJadwalRegistrasi}
              {sectionJadwalAcara}
              {sectionRegistrasi}
              <TabSaveRow pending={pending} />
            </form>
          </TabsContent>

          <TabsContent value='tiket' className='space-y-8'>
            <section className='space-y-4'>
              <SectionHeading>Kategori tiket</SectionHeading>
              <TicketCategoriesPanel
                eventId={props.eventId ?? ''}
                categories={props.categories}
                memberAccessMode={memberAccessMode}
              />
            </section>
            <form {...saveEventFormProps}>
              {sectionMemberAccess}
              {sectionMultiCategory}
              {sectionRequireAllHolderData}
              <TabSaveRow pending={pending} />
            </form>
          </TabsContent>

          <TabsContent value='venue' className='space-y-8'>
            <form {...saveEventFormProps}>
              {sectionVenue}
              {sectionMenuWajib}
              {sectionPicRekening}
              <TabSaveRow pending={pending} />
            </form>
          </TabsContent>
        </Tabs>

        <Dialog open={pendingAcknowledge} onOpenChange={setPendingAcknowledge}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfirmasi perubahan sensitif</DialogTitle>
              <DialogDescription>
                Anda mengubah PIC utama atau rekening pembayaran. Pastikan ini disengaja sebelum melanjutkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setPendingAcknowledge(false)}>
                Batal
              </Button>
              <Button
                type='button'
                onClick={() => {
                  setPendingAcknowledge(false)
                  submitPayload(true)
                }}
              >
                Lanjutkan dan simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // ─── Create mode: Stepper layout ─────────────────────────────────────────

  const STEP_LABELS = ['Info Dasar', 'Venue & Pengaturan', 'Tinjauan']

  const values = form.getValues()
  const reviewVenueName = venueOptions.find(v => v.id === values.venueId)?.name ?? '—'
  const reviewPicName = props.picOptions.find(p => p.id === values.picAdminProfileId)?.label ?? '—'
  const reviewBankName =
    (props.banksByPic[values.picAdminProfileId] ?? []).find(b => b.id === values.bankAccountId)?.label ?? '—'
  const reviewHelperNames = (values.helperAdminProfileIds ?? [])
    .map(id => props.helperAdminOptions.find(p => p.id === id)?.label ?? id)
    .join(', ')

  const reviewMandatoryMenuNames = (values.mandatoryMenuItemIds ?? [])
    .map(id => currentVenue?.menuItems.find(m => m.id === id)?.name ?? id)
    .join(', ')

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return '—'
    }
  }

  return (
    <>
      {/* Step indicator */}
      <nav className='mb-8 flex items-center gap-1' aria-label='Langkah pembuatan acara'>
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            <button
              type='button'
              onClick={() => setCreateStep(i)}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                createStep === i
                  ? 'bg-primary text-primary-foreground'
                  : i < createStep
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  createStep === i
                    ? 'bg-primary-foreground/20'
                    : i < createStep
                      ? 'bg-primary/20'
                      : 'border border-current',
                )}
              >
                {i + 1}
              </span>
              <span className='hidden sm:inline'>{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn('h-px flex-1 bg-border', i < createStep && 'bg-primary/40')} />
            )}
          </React.Fragment>
        ))}
      </nav>

      <form onSubmit={handleSaveFormSubmit}>
        {errorAlert}

        {/* Step 0: Info Dasar */}
        {createStep === 0 && (
          <div className='space-y-8'>
            {sectionTitle}
            {sectionCover}
            {sectionSummary}
            {sectionDescription}
            {sectionJadwalRegistrasi}
            {sectionJadwalAcara}
            <div className='flex justify-end gap-3 pb-16 pt-2'>
              <Link href='/admin/events' className={buttonVariants({ variant: 'outline' })}>
                Batal
              </Link>
              <Button type='button' onClick={() => setCreateStep(1)}>
                Lanjut
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Venue & Pengaturan */}
        {createStep === 1 && (
          <div className='space-y-8'>
            {sectionVenue}
            {sectionMenuWajib}
            {sectionMultiCategory}
            {sectionMemberAccess}
            {sectionRequireAllHolderData}
            {sectionRegistrasi}
            {sectionPicRekening}
            <div className='flex justify-between gap-3 pb-16 pt-2'>
              <Button type='button' variant='outline' onClick={() => setCreateStep(0)}>
                Kembali
              </Button>
              <Button type='button' onClick={() => setCreateStep(2)}>
                Lanjut ke Tinjauan
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Tinjauan */}
        {createStep === 2 && (
          <div className='space-y-5'>
            <div>
              <SectionHeading>Tinjauan acara</SectionHeading>
              <p className='text-muted-foreground mt-1 text-sm'>
                Periksa informasi berikut sebelum membuat acara. Kategori tiket dapat ditambahkan setelah acara dibuat.
              </p>
            </div>

            <ReviewSection title='Info Dasar' onEdit={() => setCreateStep(0)}>
              <ReviewRow label='Judul' value={values.title || '—'} />
              <ReviewRow label='Ringkasan' value={values.summary || '—'} />
              <ReviewRow label='Deskripsi' value={values.descriptionHtml ? 'Telah diisi' : 'Belum diisi'} />
              <ReviewRow label='Sampul' value={coverFile?.name ?? 'Belum dipilih'} />
              <ReviewRow label='Buka registrasi' value={fmtDate(values.openRegistrationAtIso)} />
              <ReviewRow label='Tutup registrasi' value={fmtDate(values.closeRegistrationAtIso)} />
              <ReviewRow label='Buka gate' value={fmtDate(values.openGateAtIso)} />
              <ReviewRow label='Kick-off' value={fmtDate(values.kickOffAtIso)} />
            </ReviewSection>

            <ReviewSection title='Venue & Pengaturan' onEdit={() => setCreateStep(1)}>
              <ReviewRow label='Venue' value={reviewVenueName} />
              <ReviewRow label='Menu wajib' value={reviewMandatoryMenuNames || 'Tidak ada'} />
              <ReviewRow label='Lintas kategori' value={values.multiCategoryPurchase ? 'Ya' : 'Tidak'} />
              <ReviewRow label='Status' value={STATUS_LABELS[values.status] ?? values.status} />
              {values.registrationManualClosed ? <ReviewRow label='Tutup manual' value='Ya' /> : null}
              <ReviewRow label='PIC utama' value={reviewPicName} />
              <ReviewRow label='Rekening' value={reviewBankName} />
              {reviewHelperNames ? <ReviewRow label='PIC pembantu' value={reviewHelperNames} /> : null}
            </ReviewSection>

            <div className='flex justify-between gap-3 pb-16 pt-2'>
              <Button type='button' variant='outline' onClick={() => setCreateStep(1)}>
                Kembali
              </Button>
              <Button type='submit' disabled={pending}>
                {pending ? 'Membuat acara…' : 'Buat acara'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className='text-base font-medium'>{children}</h2>
}

function TabSaveRow({ pending }: { pending: boolean }) {
  return (
    <div className='flex justify-end gap-3 pb-10 pt-2'>
      <Button type='submit' disabled={pending}>
        {pending ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className='rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-2.5'>
        <span className='text-sm font-medium'>{title}</span>
        <button
          type='button'
          onClick={onEdit}
          className='text-primary hover:text-primary/70 text-xs font-medium transition-colors'
        >
          Edit
        </button>
      </div>
      <div className='divide-y'>{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex gap-4 px-4 py-2.5'>
      <span className='text-muted-foreground w-36 shrink-0 text-xs'>{label}</span>
      <span className='min-w-0 wrap-break-word text-sm'>{value}</span>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label className='text-sm font-medium'>{label}</Label>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className='text-muted-foreground text-xs'>{children}</p>
}
