import { RegistrationStatus } from '@prisma/client'
import {
  Banknote,
  CircleHelp,
  ClipboardList,
  Receipt,
  Ticket,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { RegistrationStatusBadge } from '@/components/admin/registration-status-badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EventReport } from '@/lib/reports/queries'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'

const fmtNum = new Intl.NumberFormat('id-ID')

const PARTICIPANT_STATUS_ORDER: RegistrationStatus[] = [
  RegistrationStatus.approved,
  RegistrationStatus.pending_review,
  RegistrationStatus.submitted,
  RegistrationStatus.payment_issue,
  RegistrationStatus.rejected,
  RegistrationStatus.cancelled,
  RegistrationStatus.refunded,
]

type StatTone = 'default' | 'featured' | 'success' | 'warning' | 'muted'

function ReportStat({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: StatTone
  icon?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border p-4',
        tone === 'featured' && 'border-primary/25 bg-primary/5 sm:col-span-2 lg:col-span-3',
        tone === 'success' && 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20',
        tone === 'warning' && 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20',
        tone === 'muted' && 'bg-muted/30',
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <dt className='text-xs font-medium leading-snug text-muted-foreground'>{label}</dt>
        {icon ? <span className='text-muted-foreground/70 shrink-0 [&>svg]:size-3.5'>{icon}</span> : null}
      </div>
      <dd
        className={cn(
          'font-semibold tabular-nums tracking-tight',
          tone === 'featured' ? 'text-2xl sm:text-3xl' : 'text-lg',
          typeof value === 'number' ? 'font-sans' : 'font-mono',
        )}
      >
        {value}
      </dd>
      {hint ? <p className='text-xs leading-relaxed text-muted-foreground'>{hint}</p> : null}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground sm:col-span-full'>{children}</p>
  )
}

function FinanceMethodologyNote() {
  return (
    <details className='group sm:col-span-full'>
      <summary className='flex cursor-pointer list-none items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden'>
        <CircleHelp className='size-4 shrink-0' aria-hidden />
        <span className='font-medium text-foreground'>Cara membaca angka keuangan</span>
        <span className='ml-auto text-xs group-open:hidden'>Tampilkan</span>
        <span className='ml-auto hidden text-xs group-open:inline'>Sembunyikan</span>
      </summary>
      <Alert className='mt-3 border-dashed bg-muted/20'>
        <AlertDescription className='space-y-2 text-sm leading-relaxed'>
          <p>
            Semua angka pendapatan hanya menjumlahkan pendaftaran berstatus <strong>disetujui</strong>.
          </p>
          <ul className='list-disc space-y-1 pl-5'>
            <li>
              <strong>Total uang masuk</strong> mengikuti snapshot <code className='text-xs'>computedTotalAtSubmit</code>{' '}
              per pendaftaran. Data lama bisa berupa tiket + menu; pendaftaran baru sudah inklusif menu wajib.
            </li>
            <li>
              <strong>Revenue tiket</strong> menjumlahkan harga tiket tercatat per baris — bisa sama dengan total uang
              masuk bila seluruh snapshot inklusif.
            </li>
            <li>
              <strong>Alokasi menu ke venue</strong> adalah agregat harga acuan menu wajib untuk transfer venue, bukan
              tambahan di atas tiket pada model inklusif.
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </details>
  )
}

export function EventReportParticipantsPanel({ participant }: { participant: EventReport['participant'] }) {
  const statusEntries = PARTICIPANT_STATUS_ORDER.filter(status => (participant.byStatus[status] ?? 0) > 0).map(
    status => ({
      status,
      count: participant.byStatus[status] ?? 0,
    }),
  )

  return (
    <Card>
      <CardHeader className='gap-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <CardTitle className='flex items-center gap-2'>
              <Users className='size-5 text-muted-foreground' aria-hidden />
              Peserta
            </CardTitle>
            <CardDescription>Ringkasan pendaftaran dan pemegang tiket untuk acara ini.</CardDescription>
          </div>
          <div className='rounded-lg border bg-muted/30 px-4 py-3 text-right'>
            <p className='text-xs font-medium text-muted-foreground'>Total pendaftaran</p>
            <p className='text-3xl font-semibold tabular-nums tracking-tight'>{fmtNum.format(participant.total)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        <dl className='grid gap-3 sm:grid-cols-3'>
          <ReportStat label='Member' value={fmtNum.format(participant.memberCount)} tone='muted' />
          <ReportStat label='Non-member' value={fmtNum.format(participant.nonMemberCount)} tone='muted' />
          <ReportStat label='Total pemegang tiket' value={fmtNum.format(participant.holderCount)} tone='muted' />
        </dl>

        {statusEntries.length > 0 ? (
          <div className='space-y-3'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>Per status pendaftaran</p>
            <ul className='grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3'>
              {statusEntries.map(({ status, count }) => (
                <li
                  key={status}
                  className='flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5'
                >
                  <RegistrationStatusBadge status={status} />
                  <span className='text-sm font-semibold tabular-nums'>{fmtNum.format(count)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EventReportFinancePanel({ finance }: { finance: EventReport['finance'] }) {
  const hasUnpaidAdjustments = finance.adjustmentsUnpaidTotal > 0
  const hasRefunds = finance.refundCount > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Banknote className='size-5 text-muted-foreground' aria-hidden />
          Keuangan
        </CardTitle>
        <CardDescription>Pendapatan tercatat dari pendaftaran disetujui, penyesuaian invoice, dan pengembalian.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          <ReportStat
            label='Total uang masuk'
            value={formatIdr(finance.baselineTotal)}
            hint='Snapshot total saat peserta submit (hanya disetujui)'
            tone='featured'
            icon={<TrendingUp aria-hidden />}
          />

          <SectionLabel>Pendapatan & alokasi</SectionLabel>
          <ReportStat
            label='Revenue tiket'
            value={formatIdr(finance.ticketRevenueApproved)}
            tone='success'
            icon={<Ticket aria-hidden />}
          />
          <ReportStat
            label='Alokasi menu ke venue'
            value={formatIdr(finance.menuVenuePayoutApproved)}
            hint='Harga acuan menu wajib untuk transfer venue'
            icon={<UtensilsCrossed aria-hidden />}
          />

          <SectionLabel>Penyesuaian & pengembalian</SectionLabel>
          <ReportStat
            label='Penyesuaian — sudah lunas'
            value={formatIdr(finance.adjustmentsPaidTotal)}
            tone='success'
            icon={<Receipt aria-hidden />}
          />
          <ReportStat
            label='Penyesuaian — belum lunas'
            value={formatIdr(finance.adjustmentsUnpaidTotal)}
            tone={hasUnpaidAdjustments ? 'warning' : 'muted'}
            icon={<Receipt aria-hidden />}
          />
          <ReportStat
            label='Pengembalian dana'
            value={`${fmtNum.format(finance.refundCount)} pendaftaran`}
            tone={hasRefunds ? 'warning' : 'muted'}
          />

          <FinanceMethodologyNote />
        </dl>
      </CardContent>
    </Card>
  )
}

export function EventReportMenuPanel({ menu }: { menu: EventReport['menu'] }) {
  const total = menu.byItem.reduce((sum, item) => sum + item.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <UtensilsCrossed className='size-5 text-muted-foreground' aria-hidden />
          Menu wajib
        </CardTitle>
        <CardDescription>
          {total > 0
            ? `${fmtNum.format(total)} pemilihan menu tercatat dari tiket disetujui.`
            : 'Belum ada data menu per pendaftaran.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {menu.byItem.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Belum ada data menu per pendaftaran.</p>
        ) : (
          <ul className='grid list-none gap-2 p-0 sm:grid-cols-2'>
            {menu.byItem.map(item => (
              <li
                key={item.name}
                className='flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5'
              >
                <span className='text-sm font-medium leading-snug'>{item.name}</span>
                <Badge variant='secondary' className='tabular-nums'>
                  {fmtNum.format(item.count)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function EventReportAttendancePanel({ attendance }: { attendance: EventReport['attendance'] }) {
  const total = attendance.attended + attendance.noShow + attendance.unknown
  const attendedPct = total > 0 ? Math.round((attendance.attended / total) * 100) : 0
  const noShowPct = total > 0 ? Math.round((attendance.noShow / total) * 100) : 0
  const unknownPct = total > 0 ? Math.round((attendance.unknown / total) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <ClipboardList className='size-5 text-muted-foreground' aria-hidden />
          Kehadiran
        </CardTitle>
        <CardDescription>
          {total > 0
            ? `${fmtNum.format(total)} pendaftaran disetujui dengan status kehadiran tercatat.`
            : 'Belum ada catatan kehadiran.'}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        {total > 0 ? (
          <div className='space-y-2'>
            <div className='flex h-2.5 overflow-hidden rounded-full bg-muted'>
              {attendedPct > 0 ? (
                <div
                  className='bg-emerald-500 transition-all'
                  style={{ width: `${attendedPct}%` }}
                  title={`Hadir ${attendedPct}%`}
                />
              ) : null}
              {noShowPct > 0 ? (
                <div
                  className='bg-amber-500 transition-all'
                  style={{ width: `${noShowPct}%` }}
                  title={`Tidak hadir ${noShowPct}%`}
                />
              ) : null}
              {unknownPct > 0 ? (
                <div
                  className='bg-muted-foreground/30 transition-all'
                  style={{ width: `${unknownPct}%` }}
                  title={`Belum dicatat ${unknownPct}%`}
                />
              ) : null}
            </div>
            <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1.5'>
                <span className='size-2 rounded-full bg-emerald-500' aria-hidden />
                Hadir {attendedPct}%
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <span className='size-2 rounded-full bg-amber-500' aria-hidden />
                Tidak hadir {noShowPct}%
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <span className='size-2 rounded-full bg-muted-foreground/30' aria-hidden />
                Belum dicatat {unknownPct}%
              </span>
            </div>
          </div>
        ) : null}

        <dl className='grid gap-3 sm:grid-cols-3'>
          <ReportStat label='Hadir' value={fmtNum.format(attendance.attended)} tone='success' />
          <ReportStat label='Tidak hadir' value={fmtNum.format(attendance.noShow)} tone='warning' />
          <ReportStat label='Belum dicatat' value={fmtNum.format(attendance.unknown)} tone='muted' />
        </dl>
      </CardContent>
    </Card>
  )
}
