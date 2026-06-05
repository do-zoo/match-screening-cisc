'use client'

import { contactPlatformFromRegistry } from '@/lib/branding/contact-icon-registry'
import type { ContactPlatformKey } from '@/lib/branding/contact-platform'
import { detectContactPlatform } from '@/lib/branding/contact-platform'
import { brandingIconPublicPath } from '@/lib/branding/branding-icon-url'

export function BrandingFieldIconPreview(props: {
  platform: ContactPlatformKey
  hint?: string | null
}) {
  return (
    <div className='flex items-center gap-2 pt-1'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={brandingIconPublicPath(props.platform)}
        alt=''
        aria-hidden
        width={20}
        height={20}
        className='size-5 shrink-0'
      />
      {props.hint ? <p className='text-muted-foreground text-xs'>{props.hint}</p> : null}
    </div>
  )
}

export function socialIconHintFromUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://')) return null
  const platform = detectContactPlatform(trimmed)
  const label = contactPlatformFromRegistry(platform).defaultLabel
  if (!label) return null
  return `Terdeteksi: ${label}`
}
