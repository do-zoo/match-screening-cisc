'use client'

import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'

import { cn } from '@/lib/utils'

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive data-slot='radio-group' className={cn('grid w-full gap-2', className)} {...props} />
}

type RadioGroupItemProps = RadioPrimitive.Root.Props & {
  /** `prominent` — radio lebih besar dan kontras (mis. pilihan menu publik). */
  variant?: 'default' | 'prominent'
}

function RadioGroupItem({ className, variant = 'default', ...props }: RadioGroupItemProps) {
  return (
    <RadioPrimitive.Root
      data-slot='radio-group-item'
      data-variant={variant}
      className={cn(
        'group/radio-group-item peer relative flex aspect-square shrink-0 rounded-full border border-input outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary',
        variant === 'prominent'
          ? 'size-6 border-2 border-muted-foreground/45 bg-background/90 shadow-sm after:absolute after:-inset-x-4 after:-inset-y-4 data-checked:border-primary data-checked:shadow-[0_0_0_3px_hsl(var(--primary)/0.22)] dark:border-muted-foreground/50 dark:bg-background/60 dark:data-checked:shadow-[0_0_0_3px_hsl(var(--primary)/0.28)]'
          : 'size-4 after:absolute after:-inset-x-3 after:-inset-y-2',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot='radio-group-indicator'
        className={cn('flex items-center justify-center', variant === 'prominent' ? 'size-6' : 'size-4')}
      >
        <span
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground',
            variant === 'prominent' ? 'size-2.5' : 'size-2',
          )}
        />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
