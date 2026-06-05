'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TemplateEditorActions(props: {
  templateKey: string
  savePending: boolean
  resetPending: boolean
  canSave: boolean
  saveHiddenFields?: React.ReactNode
  resetHiddenFields?: React.ReactNode
  saveDispatch: (payload: FormData) => void
  resetDispatch: (payload: FormData) => void
  saveHint?: string
  className?: string
}) {
  const pending = props.savePending || props.resetPending

  return (
    <div
      className={cn(
        'bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t px-1 py-4 backdrop-blur',
        props.className,
      )}
    >
      <div className='flex flex-wrap gap-2'>
        <form action={props.saveDispatch}>
          <input type='hidden' name='key' value={props.templateKey} />
          {props.saveHiddenFields}
          <Button type='submit' disabled={pending || !props.canSave}>
            {props.savePending ? <Loader2 className='mr-2 size-4 animate-spin' aria-hidden /> : null}
            Simpan
          </Button>
        </form>
        <form action={props.resetDispatch}>
          <input type='hidden' name='key' value={props.templateKey} />
          {props.resetHiddenFields}
          <Button type='submit' variant='outline' disabled={pending}>
            {props.resetPending ? <Loader2 className='mr-2 size-4 animate-spin' aria-hidden /> : null}
            Reset ke bawaan
          </Button>
        </form>
      </div>
      {props.saveHint ? (
        <p className='text-muted-foreground max-w-md text-xs leading-relaxed'>{props.saveHint}</p>
      ) : null}
    </div>
  )
}
