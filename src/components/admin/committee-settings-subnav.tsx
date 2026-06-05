'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export const COMMITTEE_SETTINGS_NAV = [
  { href: '/admin/settings', label: 'Ringkasan' },
  { href: '/admin/settings/committee', label: 'Komite & admin' },
  { href: '/admin/settings/templates', label: 'Template pesan' },
  { href: '/admin/settings/branding', label: 'Branding' },
  { href: '/admin/settings/notifications', label: 'Notifikasi' },
  { href: '/admin/settings/operations', label: 'Operasional' },
  { href: '/admin/settings/security', label: 'Keamanan' },
] as const

export function CommitteeSettingsSubnav({
  onNavigate,
}: {
  onNavigate?: () => void
} = {}) {
  const pathname = usePathname()
  return (
    <nav aria-label='Submenu pengaturan' className='flex flex-col gap-1'>
      {COMMITTEE_SETTINGS_NAV.map(item => {
        const active =
          item.href === '/admin/settings'
            ? pathname === '/admin/settings'
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-active={active ? '' : undefined}
            className={cn(
              'shrink-0 rounded-md px-2 py-1.5 text-sm transition-colors',
              active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
