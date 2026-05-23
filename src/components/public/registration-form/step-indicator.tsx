import { cn } from '@/lib/utils'

type StepState = 'active' | 'done' | 'upcoming'

function StepBubble({ n, label, state }: { n: number; label: string; state: StepState }) {
  const isDone = state === 'done'
  const isActive = state === 'active'
  return (
    <div className='flex flex-col items-center gap-1.5'>
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors',
          (isActive || isDone) && 'bg-primary text-primary-foreground',
          state === 'upcoming' && 'border border-border bg-muted text-muted-foreground',
        )}
      >
        {isDone ? '✓' : n}
      </div>
      <span
        className={cn(
          'max-w-20 text-center text-xs',
          (isActive || isDone) ? 'font-medium text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

type Props = { current: 1 | 2 }

export function StepIndicator({ current }: Props) {
  return (
    <nav aria-label='Langkah pendaftaran' className='mb-6 flex items-start justify-center gap-0'>
      <StepBubble n={1} label='Data Peserta' state={current === 1 ? 'active' : 'done'} />
      <div className={cn('mt-4 h-0.5 w-12 shrink-0 transition-colors', current > 1 ? 'bg-primary' : 'bg-border')} />
      <StepBubble n={2} label='Ringkasan & Kirim' state={current === 2 ? 'active' : 'upcoming'} />
    </nav>
  )
}
