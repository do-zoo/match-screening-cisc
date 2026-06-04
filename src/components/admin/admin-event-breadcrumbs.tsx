'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { pathsMatchRegistrationDetail } from '@/lib/admin/event-registration-detail-path'
import { eventRegistrantsListPath } from '@/lib/admin/event-registrants-paths'
import { cn } from '@/lib/utils'

export function AdminEventBreadcrumbs({ eventId, title }: { eventId: string; title: string }) {
  const pathname = usePathname()
  const isReport =
    pathname === `/admin/events/${eventId}/report` || pathname?.startsWith(`/admin/events/${eventId}/report/`)
  const listPath = eventRegistrantsListPath(eventId)
  const isRegistrantsListExact = pathname === listPath
  const isRegistrationDetail = pathsMatchRegistrationDetail(pathname ?? null, eventId)

  const isEdit = pathname === `/admin/events/${eventId}/edit`

  const crumbs: { label: string; href?: string; current?: boolean }[] = []

  if (isEdit) {
    crumbs.push(
      { label: 'Beranda', href: '/admin' },
      { label: 'Acara', href: '/admin/events' },
      { label: title, href: listPath },
      { label: 'Pengaturan', current: true },
    )
  } else {
    crumbs.push(
      { label: 'Beranda', href: '/admin' },
      {
        label: title,
        href: listPath,
      },
    )

    if (isReport) {
      crumbs.push({ label: 'Laporan', current: true })
    } else if (isRegistrationDetail) {
      crumbs.push({ label: 'Peserta Acara', href: listPath }, { label: 'Detail', current: true })
    } else if (isRegistrantsListExact) {
      crumbs.push({ label: 'Peserta Acara', current: true })
    }
  }

  return (
    <nav aria-label='Breadcrumb'>
      <ol className='flex flex-wrap items-center gap-1 text-sm text-muted-foreground/90'>
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className='flex items-center gap-1'>
            {i > 0 ? (
              <span className='inline-block px-1 text-muted-foreground/50' aria-hidden>
                ›
              </span>
            ) : null}
            {c.href && !c.current ? (
              <Link
                href={c.href}
                className={cn(
                  'max-w-[12rem] truncate font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline md:max-w-md',
                )}
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'max-w-[14rem] truncate font-semibold text-foreground md:max-w-lg',
                  c.current && 'text-foreground',
                )}
                {...(c.current ? { 'aria-current': 'page' as const } : {})}
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
