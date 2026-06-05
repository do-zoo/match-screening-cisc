'use client'

import { useMemo, useState } from 'react'
import { Check, Circle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TokenMeta = { labelId: string }

function filterTokens(tokens: readonly string[], query: string, tokenMeta: Record<string, TokenMeta>) {
  const q = query.trim().toLowerCase()
  if (!q) return [...tokens]
  return tokens.filter(token => {
    const label = tokenMeta[token]?.labelId ?? token
    return token.includes(q) || label.toLowerCase().includes(q)
  })
}

export function EmailTemplateVariableSidebar(props: {
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<string, TokenMeta>
  missingRequired: string[]
  onInsert: (token: string) => void
  disabled?: boolean
  systemOnlyTokens?: readonly string[]
}) {
  const [search, setSearch] = useState('')
  const filteredRequired = useMemo(
    () => filterTokens(props.requiredTokens, search, props.tokenMeta),
    [props.requiredTokens, search, props.tokenMeta],
  )
  const filteredOptional = useMemo(
    () => filterTokens(props.optionalTokens, search, props.tokenMeta),
    [props.optionalTokens, search, props.tokenMeta],
  )

  return (
    <div className='space-y-3 lg:sticky lg:top-4'>
      <div>
        <p className='text-sm font-medium'>Variabel</p>
        <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
          Klik untuk menyisipkan. Centang = sudah dipakai.
        </p>
      </div>
      <Input
        placeholder='Cari variabel…'
        value={search}
        onChange={e => setSearch(e.target.value)}
        disabled={props.disabled}
        className='h-9'
      />
      <div className='max-h-[min(480px,55vh)] space-y-4 overflow-y-auto overscroll-contain pr-1'>
        {filteredRequired.length > 0 ? (
          <div>
            <p className='text-muted-foreground mb-2 text-xs font-medium'>Wajib</p>
            <ul className='space-y-0.5'>
              {filteredRequired.map(token => (
                <VariableRow
                  key={token}
                  token={token}
                  label={props.tokenMeta[token]?.labelId ?? token}
                  included={!props.missingRequired.includes(token)}
                  disabled={props.disabled}
                  onInsert={props.onInsert}
                />
              ))}
            </ul>
          </div>
        ) : null}
        {filteredOptional.length > 0 ? (
          <div>
            <p className='text-muted-foreground mb-2 text-xs font-medium'>Opsional</p>
            <ul className='space-y-0.5'>
              {filteredOptional.map(token => (
                <VariableRow
                  key={token}
                  token={token}
                  label={props.tokenMeta[token]?.labelId ?? token}
                  optional
                  disabled={props.disabled}
                  onInsert={props.onInsert}
                />
              ))}
            </ul>
          </div>
        ) : null}
        {filteredRequired.length === 0 && filteredOptional.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>Tidak ada variabel cocok.</p>
        ) : null}
        {props.systemOnlyTokens && props.systemOnlyTokens.length > 0 ? (
          <div className='border-t pt-3'>
            <p className='text-muted-foreground mb-2 text-xs font-medium'>Hanya di blok sistem</p>
            <ul className='text-muted-foreground space-y-1 text-xs'>
              {props.systemOnlyTokens.map(token => (
                <li key={token}>
                  {props.tokenMeta[token]?.labelId ?? token}{' '}
                  <span className='font-mono'>{`{${token}}`}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function VariableRow(props: {
  token: string
  label: string
  included?: boolean
  optional?: boolean
  disabled?: boolean
  onInsert: (token: string) => void
}) {
  return (
    <li>
      <button
        type='button'
        className={cn(
          'hover:bg-muted/70 focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
          props.optional && 'opacity-90',
        )}
        onClick={() => props.onInsert(props.token)}
        disabled={props.disabled}
      >
        {props.included ? (
          <Check className='text-primary size-4 shrink-0' aria-hidden />
        ) : props.optional ? (
          <Circle className='text-muted-foreground/50 size-4 shrink-0' aria-hidden />
        ) : (
          <Circle className='text-destructive/70 size-4 shrink-0' aria-hidden />
        )}
        <span className='min-w-0 flex-1 truncate font-medium'>{props.label}</span>
        <span className='text-muted-foreground shrink-0 font-mono text-[11px]'>{`{${props.token}}`}</span>
      </button>
    </li>
  )
}
