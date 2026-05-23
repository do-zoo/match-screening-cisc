'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatIdr } from '@/lib/utils/format-idr'
import { parseIdrDigitsToInt } from '@/lib/utils/idr-input'

export type IdrAmountInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & {
  value: number
  onValueChange: (next: number) => void
}

/**
 * Controlled amount in whole IDR; displays `formatIdr` and accepts pasted/typed Rupiah text.
 */
export function IdrAmountInput({ value, onValueChange, className, disabled, ...rest }: IdrAmountInputProps) {
  return (
    <Input
      {...rest}
      type='text'
      inputMode='numeric'
      autoComplete='off'
      spellCheck={false}
      disabled={disabled}
      className={cn('font-mono tabular-nums', className)}
      value={formatIdr(value)}
      onChange={e => onValueChange(parseIdrDigitsToInt(e.target.value))}
    />
  )
}
