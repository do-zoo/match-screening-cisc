import Link from 'next/link'

import { cn } from '@/lib/utils'

export type AdminSettingsCrumb = {
  label: string
  href?: string
}

export function AdminSettingsBreadcrumb({
  crumbs,
  className,
}: {
  crumbs: AdminSettingsCrumb[]
  className?: string
}) {
  return (
    <nav aria-label='Breadcrumb' className={cn('mb-3 text-sm text-muted-foreground', className)}>
      <ol className='flex flex-wrap items-center gap-x-1.5 gap-y-0.5'>
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className='flex items-center gap-1.5'>
            {i > 0 ? (
              <span className='text-muted-foreground/60' aria-hidden>
                /
              </span>
            ) : null}
            {crumb.href ? (
              <Link href={crumb.href} className='underline underline-offset-4'>
                {crumb.label}
              </Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
