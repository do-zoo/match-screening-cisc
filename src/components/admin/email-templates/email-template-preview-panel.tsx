'use client'

import { Eye, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Lebar pratinjau ≈ lebar email klien umum (600px). */
const EMAIL_PREVIEW_WIDTH_PX = 600

export function EmailTemplatePreviewPanel(props: {
  html: string | null
  pending?: boolean
  subject?: string
}) {
  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Eye className='text-muted-foreground size-4 shrink-0' aria-hidden />
          <h2 className='text-sm font-medium'>Pratinjau email</h2>
        </div>
        <p className='text-muted-foreground text-xs'>Contoh nilai variabel dari katalog</p>
      </div>

      {props.subject ? (
        <p className='text-muted-foreground text-sm'>
          <span className='text-foreground font-medium'>Subjek:</span> {props.subject}
        </p>
      ) : null}

      <div className='overflow-hidden rounded-xl border bg-muted/25 p-4 sm:p-6'>
        <div className='mx-auto w-full' style={{ maxWidth: EMAIL_PREVIEW_WIDTH_PX }}>
          <div
            className={cn(
              'relative overflow-hidden rounded-lg border bg-background shadow-sm',
              (props.pending || props.html) && 'min-h-[min(720px,78vh)]',
            )}
          >
            {props.pending ? (
              <div className='text-muted-foreground flex min-h-[min(720px,78vh)] flex-col items-center justify-center gap-2 p-8 text-sm'>
                <Loader2 className='size-6 animate-spin' aria-hidden />
                Memuat pratinjau…
              </div>
            ) : props.html ? (
              <iframe
                title='Pratinjau template email'
                sandbox=''
                srcDoc={props.html}
                className='bg-background block min-h-[min(720px,78vh)] w-full'
              />
            ) : (
              <p className='text-muted-foreground p-8 text-sm'>Pratinjau belum tersedia.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
