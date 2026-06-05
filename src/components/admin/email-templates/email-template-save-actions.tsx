'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function EmailTemplateSaveActions(props: {
  templateKey: string
  subject: string
  bodyJson: string
  savePending: boolean
  resetPending: boolean
  canSave: boolean
  saveDispatch: (payload: FormData) => void
  resetDispatch: (payload: FormData) => void
  size?: 'default' | 'sm'
}) {
  const pending = props.savePending || props.resetPending

  return (
    <div className='flex flex-wrap gap-2'>
      <form action={props.saveDispatch}>
        <input type='hidden' name='key' value={props.templateKey} />
        <input type='hidden' name='subject' value={props.subject} />
        <input type='hidden' name='body' value={props.bodyJson} />
        <Button type='submit' size={props.size} disabled={pending || !props.canSave}>
          {props.savePending ? <Loader2 className='mr-2 size-4 animate-spin' aria-hidden /> : null}
          Simpan
        </Button>
      </form>
      <form action={props.resetDispatch}>
        <input type='hidden' name='key' value={props.templateKey} />
        <Button type='submit' variant='outline' size={props.size} disabled={pending}>
          {props.resetPending ? <Loader2 className='mr-2 size-4 animate-spin' aria-hidden /> : null}
          Reset ke bawaan
        </Button>
      </form>
    </div>
  )
}
