'use client'

import { useMemo, useState } from 'react'
import { Braces } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TokenMeta = { labelId: string; descriptionId?: string }

function filterTokens(tokens: readonly string[], query: string, tokenMeta: Record<string, TokenMeta>) {
  const q = query.trim().toLowerCase()
  if (!q) return [...tokens]
  return tokens.filter(token => {
    const label = tokenMeta[token]?.labelId ?? token
    return token.includes(q) || label.toLowerCase().includes(q)
  })
}

function VariableButton(props: {
  token: string
  label: string
  optional?: boolean
  disabled?: boolean
  onInsert: (token: string) => void
}) {
  return (
    <li>
      <button
        type='button'
        className={cn(
          'hover:bg-muted/80 focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
          props.optional ? 'border-dashed' : 'border-border bg-muted/20',
        )}
        onClick={() => props.onInsert(props.token)}
        disabled={props.disabled}
      >
        <span className='text-sm font-medium'>{props.label}</span>
        <span className='text-muted-foreground mt-0.5 block font-mono text-xs'>{`{${props.token}}`}</span>
      </button>
    </li>
  )
}

export function TemplateVariablePanel(props: {
  requiredTokens: readonly string[]
  optionalTokens: readonly string[]
  tokenMeta: Record<string, TokenMeta>
  onInsert: (token: string) => void
  disabled?: boolean
  footerNote?: React.ReactNode
  description?: string
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
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <Braces className='text-muted-foreground size-4 shrink-0' aria-hidden />
          <CardTitle className='text-base'>Variabel</CardTitle>
        </div>
        <CardDescription>
          {props.description ?? 'Klik untuk menyisipkan di editor yang sedang fokus.'}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Input
          placeholder='Cari variabel…'
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={props.disabled}
          className='h-8 text-sm'
        />
        {filteredRequired.length > 0 ? (
          <div>
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase'>Wajib</p>
            <ul className='space-y-1.5'>
              {filteredRequired.map(token => (
                <VariableButton
                  key={token}
                  token={token}
                  label={props.tokenMeta[token]?.labelId ?? token}
                  disabled={props.disabled}
                  onInsert={props.onInsert}
                />
              ))}
            </ul>
          </div>
        ) : null}
        {filteredOptional.length > 0 ? (
          <div>
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase'>Opsional</p>
            <ul className='space-y-1.5'>
              {filteredOptional.map(token => (
                <VariableButton
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
          <p className='text-muted-foreground py-2 text-center text-sm'>Tidak ada variabel cocok.</p>
        ) : null}
        {props.footerNote}
      </CardContent>
    </Card>
  )
}
