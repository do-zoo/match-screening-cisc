'use client'

import { Check, ClipboardCheck, X } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type TokenMeta = { labelId: string }

export function TemplateChecklistPanel(props: {
  requiredTokens: readonly string[]
  tokenMeta: Record<string, TokenMeta>
  missingRequired: string[]
  invalidTokens: string[]
  emptyMessage?: string
}) {
  const total = props.requiredTokens.length
  const done = total - props.missingRequired.length
  const allOk = props.missingRequired.length === 0 && props.invalidTokens.length === 0

  return (
    <Card className={cn(allOk && total > 0 && 'border-primary/30 bg-primary/3')}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <ClipboardCheck className='text-muted-foreground size-4 shrink-0' aria-hidden />
            <CardTitle className='text-base'>Checklist wajib</CardTitle>
          </div>
          {total > 0 ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                allOk ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              {done}/{total}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {props.emptyMessage ?? 'Tidak ada placeholder wajib.'}
          </p>
        ) : (
          <ul className='space-y-2 text-sm'>
            {props.requiredTokens.map(token => {
              const ok = !props.missingRequired.includes(token)
              return (
                <li key={token} className='flex items-start gap-2.5'>
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                      ok ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive',
                    )}
                    aria-hidden
                  >
                    {ok ? <Check className='size-3' /> : <X className='size-3' />}
                  </span>
                  <span className={cn('leading-snug', ok ? '' : 'text-destructive')}>
                    {props.tokenMeta[token]?.labelId ?? token}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {props.invalidTokens.length > 0 ? (
          <p className='text-destructive mt-3 text-xs leading-relaxed'>
            Placeholder tidak dikenal: {props.invalidTokens.map(t => `{${t}}`).join(', ')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
