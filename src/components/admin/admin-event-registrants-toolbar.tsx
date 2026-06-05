'use client'

import { useRouter } from 'next/navigation'

import { AdminFilterSelect } from '@/components/admin/admin-filter-select'
import { AdminListToolbar } from '@/components/admin/admin-list-toolbar'
import { InvoiceEmailBlastDialog } from '@/components/admin/invoice-email-blast-dialog'
import { RegistrationInvoiceEmailBlastDialog } from '@/components/admin/registration-invoice-blast-dialog'
import { buildEventRegistrantsListUrl, type EventRegistrantsTab } from '@/lib/admin/event-registrants-list-url'
import type { EventsIndexViewMode } from '@/lib/admin/events-index-view'

const tabOptions = [
  { value: 'all' as const, label: 'Semua status' },
  { value: 'pending_review' as const, label: 'Menunggu tinjauan' },
  { value: 'submitted' as const, label: 'Terkirim' },
  { value: 'payment_issue' as const, label: 'Masalah pembayaran' },
  { value: 'approved' as const, label: 'Disetujui' },
  { value: 'rejected' as const, label: 'Ditolak' },
  { value: 'closed' as const, label: 'Dibatalkan / refund' },
]

export function AdminEventRegistrantsToolbar({
  eventId,
  tab,
  viewMode,
  searchQuery,
}: {
  eventId: string
  tab: EventRegistrantsTab
  viewMode: EventsIndexViewMode
  searchQuery: string
}) {
  const router = useRouter()

  return (
    <AdminListToolbar
      search={{
        inputId: 'admin-event-registrants-search',
        label: 'Cari peserta',
        placeholder: 'Nama, WhatsApp, atau nomor anggota…',
        value: searchQuery,
        getUrlForQuery: q =>
          buildEventRegistrantsListUrl(eventId, {
            tab,
            view: viewMode,
            q,
            page: 1,
          }),
      }}
      viewToggle={{
        mode: viewMode,
        tableHref: buildEventRegistrantsListUrl(eventId, {
          tab,
          view: 'table',
          q: searchQuery.trim() || undefined,
          page: 1,
        }),
        cardsHref: buildEventRegistrantsListUrl(eventId, {
          tab,
          view: 'cards',
          q: searchQuery.trim() || undefined,
          page: 1,
        }),
      }}
      filterSlot={
        <AdminFilterSelect
          id='admin-event-registrants-tab'
          fieldLabel='Status pendaftaran'
          value={tab}
          options={tabOptions}
          placeholder='Pilih status'
          onValueChange={v => {
            router.push(
              buildEventRegistrantsListUrl(eventId, {
                tab: v as EventRegistrantsTab,
                view: viewMode,
                q: searchQuery.trim() || undefined,
                page: 1,
              }),
            )
          }}
        />
      }
      endSlot={
        <div className='flex flex-wrap items-center gap-2'>
          <RegistrationInvoiceEmailBlastDialog eventId={eventId} tab={tab} searchQuery={searchQuery} />
          <InvoiceEmailBlastDialog eventId={eventId} tab={tab} searchQuery={searchQuery} />
        </div>
      }
    />
  )
}
