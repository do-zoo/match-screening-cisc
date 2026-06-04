import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  title: string
  description?: string
  headerEnd?: ReactNode
  variant?: 'default' | 'danger'
  children: ReactNode
}

export function OperationSectionShell({
  title,
  description,
  headerEnd,
  variant = 'default',
  children,
}: Props) {
  return (
    <section
      className={cn(
        'rounded-xl border bg-card',
        variant === 'default' && 'border-border/80',
        variant === 'danger' && 'border-destructive/25 bg-destructive/[0.03]',
      )}
    >
      <div className='flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3'>
        <div className='min-w-0 grid gap-0.5'>
          <h3 className='text-sm font-semibold tracking-tight'>{title}</h3>
          {description ? <p className='text-xs leading-relaxed text-muted-foreground'>{description}</p> : null}
        </div>
        {headerEnd ? <div className='shrink-0'>{headerEnd}</div> : null}
      </div>
      <div className='p-4'>{children}</div>
    </section>
  )
}
