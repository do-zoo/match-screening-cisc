'use client'

import type { SerializedTicketCategory } from '@/components/public/event-serialization'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatIdr } from '@/lib/utils/format-idr'

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
  const max = selected?.maxQtyPerPerson ?? 20

  return (
    <div className='space-y-4'>
      <fieldset>
        <legend className='text-sm font-medium mb-2'>Pilih Kategori Tiket</legend>
        <div className='space-y-2'>
          {categories.map(cat => (
            <label
              key={cat.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selectedId === cat.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type='radio'
                name='ticketCategory'
                value={cat.id}
                checked={selectedId === cat.id}
                onChange={() => onSelect(cat.id)}
                disabled={disabled}
                className='mt-0.5'
              />
              <div className='flex-1 min-w-0'>
                <div className='font-medium'>{cat.name}</div>
                <div className='text-sm text-muted-foreground'>
                  Member: {formatIdr(cat.memberPrice)} · Reguler: {formatIdr(cat.regularPrice)}
                </div>
                {cat.maxQtyPerPerson && (
                  <div className='text-xs text-muted-foreground'>Maks {cat.maxQtyPerPerson} tiket/orang</div>
                )}
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className='text-sm font-medium'>Jumlah Tiket</label>
        <Select value={qty.toString()} onValueChange={value => onQtyChange(Number(value))}>
          <SelectTrigger className='w-24'>
            <SelectValue placeholder='Pilih Jumlah Tiket' />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: max }, (_, i) => i + 1).map(n => (
              <SelectItem key={n} value={n}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
