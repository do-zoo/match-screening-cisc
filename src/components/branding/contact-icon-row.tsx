import type { ReactNode } from 'react'

import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { brandingIconPublicPath } from '@/lib/branding/branding-icon-url'
import { cn } from '@/lib/utils'

export function ContactIconRow(props: {
  platform: ContactPlatformKey
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-2', props.className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ikon statis kecil */}
      <img
        src={brandingIconPublicPath(props.platform)}
        alt=''
        aria-hidden
        width={20}
        height={20}
        className='mt-0.5 size-5 shrink-0'
      />
      <div className='min-w-0 flex-1'>{props.children}</div>
    </div>
  )
}
