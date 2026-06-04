'use client'

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type AdminFilterSelectOption<T extends string> = {
  value: T
  label: string
}

type AdminFilterSelectProps<T extends string> = {
  id: string
  fieldLabel: string
  value: T
  options: AdminFilterSelectOption<T>[]
  /** Jika diisi, angka hanya di daftar opsi (bukan di trigger). */
  counts?: Partial<Record<T, number>>
  placeholder?: string
  triggerClassName?: string
  onValueChange: (value: T) => void
}

export function AdminFilterSelect<T extends string>({
  id,
  fieldLabel,
  value,
  options,
  counts,
  placeholder = 'Pilih…',
  triggerClassName,
  onValueChange,
}: AdminFilterSelectProps<T>) {
  const labelByValue = new Map(options.map(o => [o.value, o.label]))

  return (
    <>
      <Label htmlFor={id} className='text-muted-foreground text-xs'>
        {fieldLabel}
      </Label>
      <Select
        value={value}
        onValueChange={v => {
          if (v == null || v === '') return
          onValueChange(v as T)
        }}
      >
        <SelectTrigger id={id} size='sm' className={cn('w-full min-w-0 sm:w-56', triggerClassName)}>
          <SelectValue placeholder={placeholder}>
            {v => labelByValue.get(v as T) ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(o => {
            const count = counts?.[o.value]
            return (
              <SelectItem key={o.value} value={o.value}>
                <span className='flex w-full min-w-[11rem] items-center justify-between gap-4'>
                  <span>{o.label}</span>
                  {count !== undefined ? (
                    <span className='text-muted-foreground text-xs tabular-nums'>{count}</span>
                  ) : null}
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </>
  )
}
