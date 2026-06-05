import { prisma } from '@/lib/db/prisma'
import { formatIdr } from '../utils/format-idr'

function escapeCsv(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

/** CSV UTF-8: satu baris per `Registration`, kolom tiket dinamis sesuai ticketQty maksimal. */
export async function generateRegistrationsCsv(eventId: string): Promise<string> {
  const rows = await prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactWhatsapp: true,
      ticketQty: true,
      holderDataMode: true,
      ticketCategory: { select: { name: true } },
      status: true,
      attendanceStatus: true,
      computedTotalAtSubmit: true,
      holders: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          holderName: true,
          claimedMemberNumber: true,
          memberValidation: true,
        },
      },
      tickets: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          sortOrder: true,
          ticketPriceApplied: true,
          assignedHolderId: true,
        },
      },
      adjustments: {
        select: { type: true, amount: true, status: true },
      },
    },
  })

  const maxTickets = rows.reduce((max, r) => Math.max(max, r.tickets.length), 0)

  const ticketHeaders: string[] = []
  for (let n = 1; n <= maxTickets; n++) {
    ticketHeaders.push(
      `Tiket ${n} ID`,
      `Tiket ${n} Holder ID`,
      `Tiket ${n} Nama`,
      `Tiket ${n} Member`,
      `Tiket ${n} Status Member`,
      `Tiket ${n} Harga (IDR)`,
    )
  }

  const headers = [
    'Registration ID',
    'Tanggal daftar',
    'Kategori Tiket',
    'Jumlah Tiket',
    'Mode data peserta',
    'Nama Kontak',
    'No. WA Kontak',
    'Status',
    'Kehadiran',
    'Total (IDR)',
    'Penyesuaian (IDR)',
    ...ticketHeaders,
  ]

  const body = rows.map(r => {
    const adjustmentTotal = r.adjustments.reduce((s, a) => s + a.amount, 0)
    const holderById = Object.fromEntries(r.holders.map(h => [h.id, h]))

    const ticketCols: string[] = []
    for (let n = 0; n < maxTickets; n++) {
      const t = r.tickets[n]
      if (t) {
        const h = holderById[t.assignedHolderId]
        ticketCols.push(
          t.id,
          t.assignedHolderId,
          h?.holderName ?? '',
          h?.claimedMemberNumber ?? '',
          h?.memberValidation ?? '',
          formatIdr(t.ticketPriceApplied),
        )
      } else {
        ticketCols.push('', '', '', '', '', '')
      }
    }

    return [
      r.id,
      new Date(r.createdAt).toLocaleString('id-ID'),
      r.ticketCategory.name,
      String(r.ticketQty),
      r.holderDataMode,
      r.contactName,
      r.contactWhatsapp,
      r.status,
      r.attendanceStatus,
      formatIdr(r.computedTotalAtSubmit),
      adjustmentTotal > 0 ? formatIdr(adjustmentTotal) : '',
      ...ticketCols,
    ]
      .map(String)
      .map(escapeCsv)
      .join(',')
  })

  return [headers.map(escapeCsv).join(','), ...body].join('\r\n')
}
