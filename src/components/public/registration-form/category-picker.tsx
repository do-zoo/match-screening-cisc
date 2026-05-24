'use client'

import type { SerializedTicketCategory } from '@/components/public/event-serialization'
import { Button } from '@/components/ui/button'
import { formatIdr } from '@/lib/utils/format-idr'
import { Minus, Plus } from 'lucide-react'

type Props = {
  categories: SerializedTicketCategory[]
  selectedId: string
  onSelect: (id: string) => void
  qty: number
  onQtyChange: (qty: number) => void
  disabled?: boolean
}

export function CategoryPicker({ categories, selectedId, onSelect, qty, onQtyChange, disabled }: Props) {
  const selected = categories.find(c => c.id === selectedId)
  const maxPerPerson = selected?.maxQtyPerPerson ?? 20
  const remainingSlots = selected?.remainingSlots ?? null
  const max = remainingSlots != null ? Math.min(maxPerPerson, remainingSlots) : maxPerPerson

  return (
    <div className='space-y-4'>
      <fieldset>
        <legend className='text-sm font-medium mb-2'>Pilih Kategori Tiket</legend>
        <div className='space-y-2'>
          {categories.map(cat => {
            const isFull = cat.remainingSlots === 0
            return (
              <label
                key={cat.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                  isFull
                    ? 'border-border opacity-50 cursor-not-allowed'
                    : selectedId === cat.id
                      ? 'cursor-pointer border-primary bg-primary/5'
                      : 'cursor-pointer border-border hover:border-primary/50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type='radio'
                  name='ticketCategory'
                  value={cat.id}
                  checked={selectedId === cat.id}
                  onChange={() => !isFull && onSelect(cat.id)}
                  disabled={disabled || isFull}
                  className='mt-0.5'
                />
                <div className='flex-1 min-w-0'>
                  <div className='font-medium flex items-center gap-2'>
                    {cat.name}
                    {isFull && (
                      <span className='text-xs font-normal text-destructive'>Habis</span>
                    )}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Member: {formatIdr(cat.memberPrice)} · Reguler: {formatIdr(cat.regularPrice)}
                  </div>
                  {cat.maxQtyPerPerson && !isFull && (
                    <div className='text-xs text-muted-foreground'>Maks {cat.maxQtyPerPerson} tiket/orang</div>
                  )}
                  {cat.remainingSlots != null && cat.remainingSlots > 0 && (
                    <div className='text-xs text-muted-foreground'>Sisa {cat.remainingSlots} slot</div>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      </fieldset>

      {max > 1 && (
        <div>
          <label className='text-sm font-medium block mb-2'>Jumlah Tiket</label>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='h-9 w-9 shrink-0'
              onClick={() => onQtyChange(Math.max(1, qty - 1))}
              disabled={disabled || qty <= 1}
              aria-label='Kurangi jumlah tiket'
            >
              <Minus className='h-4 w-4' />
            </Button>
            <input
              type='number'
              min={1}
              max={max}
              value={qty}
              onChange={e => {
                const val = Number(e.target.value)
                if (!isNaN(val)) onQtyChange(Math.min(max, Math.max(1, val)))
              }}
              disabled={disabled}
              className='w-14 h-9 rounded-md border border-input bg-background text-center text-sm font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
              aria-label='Jumlah tiket'
            />
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='h-9 w-9 shrink-0'
              onClick={() => onQtyChange(Math.min(max, qty + 1))}
              disabled={disabled || qty >= max}
              aria-label='Tambah jumlah tiket'
            >
              <Plus className='h-4 w-4' />
            </Button>
            <span className='text-xs text-muted-foreground'>Maks {max}</span>
          </div>
        </div>
      )}
    </div>
  )
}
