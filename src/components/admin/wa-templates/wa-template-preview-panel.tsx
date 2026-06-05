'use client'

import { MessageCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function WaTemplatePreviewPanel(props: { text: string }) {
  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <MessageCircle className='text-muted-foreground size-4 shrink-0' aria-hidden />
          <CardTitle className='text-base'>Pratinjau WA</CardTitle>
        </div>
        <CardDescription>Contoh nilai variabel dari katalog.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-xl border bg-[#0b141a] p-3 shadow-inner'>
          <div className='mb-2 flex items-center gap-2 px-1'>
            <div className='flex size-7 items-center justify-center rounded-full bg-[#25d366]/20 text-[#25d366]'>
              <MessageCircle className='size-3.5' aria-hidden />
            </div>
            <div className='min-w-0'>
              <p className='truncate text-xs font-medium text-[#e9edef]'>CISC Admin</p>
              <p className='text-[10px] text-[#8696a0]'>Pratinjau pesan</p>
            </div>
          </div>
          <div className='max-h-[min(360px,45vh)] overflow-y-auto pr-1'>
            <div className='relative max-w-[92%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2 shadow-sm'>
              <pre className='font-[inherit] text-[13px] leading-relaxed whitespace-pre-wrap text-[#e9edef]'>{props.text}</pre>
              <span className='mt-1 block text-right text-[10px] text-[#8696a0] tabular-nums'>12:00</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
